import uuid
from datetime import UTC, date, datetime, time
from typing import Any
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.repositories.timings import get_timing_repository
from app.routers.timings import get_timing_service
from app.schemas.common import AppRole
from app.schemas.timings import OutletInfo, OutletType, TimingOverrideCreate, TimingOverrideOut
from app.services.notifications import get_notifier
from app.services.timings import TimingService, describe_override, format_dates, format_time
from tests.conftest import TokenFactory, bearer

TODAY = date(2026, 10, 17)  # Saturday
SECY_ID = uuid.uuid4()
CANTEEN_SECY_ID = uuid.uuid4()
RAJENDRA = uuid.uuid4()
GANGA = uuid.uuid4()
RAJENDRA_MESS = OutletInfo(
    id=uuid.uuid4(), type=OutletType.MESS, bhawan_id=RAJENDRA, name="Rajendra Bhawan Mess"
)
GANGA_MESS = OutletInfo(
    id=uuid.uuid4(), type=OutletType.MESS, bhawan_id=GANGA, name="Ganga Bhawan Mess"
)
NIGHT_CANTEEN = OutletInfo(
    id=uuid.uuid4(),
    type=OutletType.NIGHT_CANTEEN,
    bhawan_id=RAJENDRA,
    name="Rajendra Bhawan Night Canteen",
)
CCD = OutletInfo(id=uuid.uuid4(), type=OutletType.EATERY, bhawan_id=None, name="Cafe Coffee Day")
VENDOR_PHONE = "+919510709195"


class InMemoryTimingRepository:
    def __init__(self) -> None:
        self.outlets = {o.id: o for o in (RAJENDRA_MESS, GANGA_MESS, NIGHT_CANTEEN, CCD)}
        self.roles = {
            (SECY_ID, AppRole.MESS_SECRETARY, RAJENDRA),
            (CANTEEN_SECY_ID, AppRole.BHAWAN_SECRETARY, RAJENDRA),
        }
        self.vendor_outlets = {(VENDOR_PHONE, NIGHT_CANTEEN.id), (VENDOR_PHONE, CCD.id)}
        self.overrides: dict[UUID, TimingOverrideOut] = {}

    async def get_outlet(self, outlet_id: UUID) -> OutletInfo | None:
        return self.outlets.get(outlet_id)

    async def has_bhawan_role(self, user_id: UUID, role: AppRole, bhawan_id: UUID) -> bool:
        return (user_id, role, bhawan_id) in self.roles

    async def vendor_owns_outlet(self, phone_e164: str, outlet_id: UUID) -> bool:
        return (phone_e164, outlet_id) in self.vendor_outlets

    async def create_override(
        self, outlet_id: UUID, body: TimingOverrideCreate, created_by: UUID
    ) -> TimingOverrideOut:
        row = TimingOverrideOut(
            id=uuid.uuid4(),
            outlet_id=outlet_id,
            created_by=created_by,
            created_at=datetime.now(UTC),
            **body.model_dump(exclude={"notify"}),
        )
        self.overrides[row.id] = row
        return row

    async def get_override(self, override_id: UUID) -> TimingOverrideOut | None:
        return self.overrides.get(override_id)

    async def revoke_override(self, override_id: UUID) -> None:
        row = self.overrides[override_id]
        self.overrides[override_id] = row.model_copy(update={"revoked_at": datetime.now(UTC)})


class RecordingNotifier:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def notify_bhawan_residents(self, bhawan_id: UUID, **kwargs: Any) -> None:
        self.calls.append({"bhawan_id": bhawan_id, **kwargs})


@pytest.fixture
def repo(app: FastAPI) -> InMemoryTimingRepository:
    repository = InMemoryTimingRepository()
    app.dependency_overrides[get_timing_repository] = lambda: repository
    app.dependency_overrides[get_timing_service] = lambda: TimingService(repository, lambda: TODAY)
    return repository


@pytest.fixture
def notifier(app: FastAPI) -> RecordingNotifier:
    recorder = RecordingNotifier()
    app.dependency_overrides[get_notifier] = lambda: recorder
    return recorder


@pytest.fixture
def secy(make_token: TokenFactory) -> dict[str, str]:
    return bearer(make_token(sub=SECY_ID, roles=["student", "mess_secretary"]))


def override_body(**changes: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "slot": "breakfast",
        "starts_on": "2026-10-18",
        "ends_on": "2026-10-19",
        "opens_at": "08:00",
        "closes_at": "10:00",
        "reason": "Exam season",
    }
    body.update(changes)
    return {k: v for k, v in body.items() if v is not None}


def post(client: TestClient, outlet: OutletInfo, headers: dict[str, str], body: dict[str, Any]):
    return client.post(f"/v1/outlets/{outlet.id}/timing-overrides", headers=headers, json=body)


# ─── Formatting ──────────────────────────────────────────────────────────────
@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (time(7, 30), "7:30 AM"),
        (time(0, 5), "12:05 AM"),
        (time(12, 0), "12:00 PM"),
        (time(21, 30), "9:30 PM"),
    ],
)
def test_format_time(value: time, expected: str) -> None:
    assert format_time(value) == expected


def test_format_dates() -> None:
    assert format_dates(date(2026, 10, 18), date(2026, 10, 18)) == "on Sun 18 Oct"
    assert format_dates(date(2026, 10, 18), date(2026, 10, 19)) == "18–19 Oct"
    assert format_dates(date(2026, 10, 30), date(2026, 11, 2)) == "30 Oct – 2 Nov"


def test_describe_override() -> None:
    title, body = describe_override(RAJENDRA_MESS, TimingOverrideCreate(**override_body()))
    assert title == "Rajendra Bhawan Mess: timing change"
    assert body == "Breakfast 8:00 AM – 10:00 AM 18–19 Oct. Exam season"

    _, closed = describe_override(
        RAJENDRA_MESS,
        TimingOverrideCreate(
            **override_body(is_closed=True, opens_at=None, closes_at=None, reason="Diwali")
        ),
    )
    assert closed == "Breakfast closed 18–19 Oct. Diwali"


# ─── Mess overrides ──────────────────────────────────────────────────────────
def test_secretary_creates_mess_override_and_residents_are_notified(
    client: TestClient,
    repo: InMemoryTimingRepository,
    notifier: RecordingNotifier,
    secy: dict[str, str],
) -> None:
    response = post(client, RAJENDRA_MESS, secy, override_body(notify=False))

    assert response.status_code == 201
    body = response.json()
    assert body["notified"] is True  # mess overrides always broadcast, notify flag ignored
    assert body["created_by"] == str(SECY_ID)
    assert len(notifier.calls) == 1
    call = notifier.calls[0]
    assert call["bhawan_id"] == RAJENDRA
    assert call["title"] == "Rajendra Bhawan Mess: timing change"
    assert call["data"]["override_id"] == body["id"]


def test_secretary_cannot_override_another_bhawan(
    client: TestClient,
    repo: InMemoryTimingRepository,
    notifier: RecordingNotifier,
    secy: dict[str, str],
) -> None:
    response = post(client, GANGA_MESS, secy, override_body())

    assert response.status_code == 403
    assert notifier.calls == []


def test_student_cannot_override(
    client: TestClient,
    repo: InMemoryTimingRepository,
    notifier: RecordingNotifier,
    make_token: TokenFactory,
) -> None:
    response = post(client, RAJENDRA_MESS, bearer(make_token()), override_body())

    assert response.status_code == 403


@pytest.mark.parametrize(
    ("changes", "code"),
    [
        ({"starts_on": "2026-10-16", "ends_on": "2026-10-16"}, "PAST_DATE"),
        ({"slot": None}, "SLOT_REQUIRED"),
        ({"opens_at": "22:00", "closes_at": "01:00"}, "INVALID_WINDOW"),
    ],
)
def test_mess_rules(
    client: TestClient,
    repo: InMemoryTimingRepository,
    notifier: RecordingNotifier,
    secy: dict[str, str],
    changes: dict[str, Any],
    code: str,
) -> None:
    response = post(client, RAJENDRA_MESS, secy, override_body(**changes))

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == code
    assert notifier.calls == []


@pytest.mark.parametrize(
    "changes",
    [
        {"ends_on": "2026-10-10"},  # before start
        {"ends_on": "2027-03-01"},  # > 120 days
        {"opens_at": None},  # open without both times
        {"is_closed": True},  # closed with times
        {"opens_at": "08:00", "closes_at": "08:00"},
        {"reason": "no"},
    ],
)
def test_schema_validation(
    client: TestClient,
    repo: InMemoryTimingRepository,
    notifier: RecordingNotifier,
    secy: dict[str, str],
    changes: dict[str, Any],
) -> None:
    assert post(client, RAJENDRA_MESS, secy, override_body(**changes)).status_code == 422


def test_closed_meal_override(
    client: TestClient,
    repo: InMemoryTimingRepository,
    notifier: RecordingNotifier,
    secy: dict[str, str],
) -> None:
    response = post(
        client,
        RAJENDRA_MESS,
        secy,
        override_body(is_closed=True, opens_at=None, closes_at=None, reason="Diwali"),
    )

    assert response.status_code == 201
    assert response.json()["is_closed"] is True
    assert "closed" in notifier.calls[0]["body"]


def test_unknown_outlet_is_404(
    client: TestClient,
    repo: InMemoryTimingRepository,
    notifier: RecordingNotifier,
    secy: dict[str, str],
) -> None:
    response = client.post(
        f"/v1/outlets/{uuid.uuid4()}/timing-overrides", headers=secy, json=override_body()
    )

    assert response.status_code == 404


# ─── Canteen shift changes (used by M4) ──────────────────────────────────────
def test_vendor_changes_overnight_canteen_shift_without_notifying(
    client: TestClient,
    repo: InMemoryTimingRepository,
    notifier: RecordingNotifier,
    make_token: TokenFactory,
) -> None:
    vendor = bearer(make_token(roles=["vendor"], email="", phone="919510709195"))

    response = post(
        client,
        NIGHT_CANTEEN,
        vendor,
        override_body(
            slot=None, opens_at="02:00", closes_at="14:00", reason="New shift cycle", notify=False
        ),
    )

    assert response.status_code == 201
    assert response.json()["notified"] is False
    assert notifier.calls == []


def test_bhawan_secretary_can_notify_canteen_change(
    client: TestClient,
    repo: InMemoryTimingRepository,
    notifier: RecordingNotifier,
    make_token: TokenFactory,
) -> None:
    headers = bearer(make_token(sub=CANTEEN_SECY_ID, roles=["student", "bhawan_secretary"]))

    response = post(
        client,
        NIGHT_CANTEEN,
        headers,
        override_body(slot=None, opens_at="22:30", closes_at="10:30"),
    )

    assert response.status_code == 201
    assert len(notifier.calls) == 1
    # The app opens the canteen (not the Mess Hub) when the alert is tapped.
    assert notifier.calls[0]["data"]["outlet_type"] == "night_canteen"


def test_canteen_override_cannot_target_a_meal(
    client: TestClient,
    repo: InMemoryTimingRepository,
    notifier: RecordingNotifier,
    make_token: TokenFactory,
) -> None:
    vendor = bearer(make_token(roles=["vendor"], email="", phone="+919510709195"))

    response = post(client, NIGHT_CANTEEN, vendor, override_body())

    assert response.json()["detail"]["code"] == "SLOT_NOT_ALLOWED"


def test_eatery_changes_never_broadcast(
    client: TestClient,
    repo: InMemoryTimingRepository,
    notifier: RecordingNotifier,
    make_token: TokenFactory,
) -> None:
    vendor = bearer(make_token(roles=["vendor"], email="", phone="+919510709195"))

    response = post(
        client, CCD, vendor, override_body(slot=None, opens_at="10:00", closes_at="23:00")
    )

    assert response.status_code == 201
    assert response.json()["notified"] is False
    assert notifier.calls == []


def test_mess_secretary_cannot_change_canteen(
    client: TestClient,
    repo: InMemoryTimingRepository,
    notifier: RecordingNotifier,
    secy: dict[str, str],
) -> None:
    response = post(client, NIGHT_CANTEEN, secy, override_body(slot=None))

    assert response.status_code == 403


# ─── Revoking ────────────────────────────────────────────────────────────────
def test_revoke_override(
    client: TestClient,
    repo: InMemoryTimingRepository,
    notifier: RecordingNotifier,
    secy: dict[str, str],
) -> None:
    created = post(client, RAJENDRA_MESS, secy, override_body()).json()

    first = client.delete(f"/v1/timing-overrides/{created['id']}", headers=secy)
    second = client.delete(f"/v1/timing-overrides/{created['id']}", headers=secy)

    assert first.status_code == 204
    assert repo.overrides[UUID(created["id"])].revoked_at is not None
    assert second.status_code == 404


def test_only_managers_revoke(
    client: TestClient,
    repo: InMemoryTimingRepository,
    notifier: RecordingNotifier,
    secy: dict[str, str],
    make_token: TokenFactory,
) -> None:
    created = post(client, RAJENDRA_MESS, secy, override_body()).json()

    response = client.delete(f"/v1/timing-overrides/{created['id']}", headers=bearer(make_token()))

    assert response.status_code == 403
