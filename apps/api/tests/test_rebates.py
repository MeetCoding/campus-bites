import uuid
from datetime import UTC, date, datetime
from typing import Any
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.repositories.rebates import RebateOverlapError, get_rebate_repository
from app.routers.rebates import get_rebate_service
from app.schemas.common import AppRole
from app.schemas.rebates import RebateOut, RebateRules, RebateStatus, StudentProfile
from app.services.notifications import get_notifier
from app.services.rebates import LEGAL_TRANSITIONS, RebateService, describe_transition
from tests.conftest import TokenFactory, bearer

TODAY = date(2026, 10, 17)  # Saturday
RAJENDRA = uuid.uuid4()
GANGA = uuid.uuid4()
STUDENT_ID = uuid.uuid4()
HOMELESS_ID = uuid.uuid4()  # student who hasn't picked a Bhawan
AUTHORITY_ID = uuid.uuid4()  # Mess Authority, Rajendra
OTHER_AUTHORITY_ID = uuid.uuid4()  # Mess Authority, Ganga


class InMemoryRebateRepository:
    def __init__(self) -> None:
        self.rules = RebateRules(min_rebate_days=3, rebate_backdate_days=0)
        self.profiles = {
            STUDENT_ID: StudentProfile(
                id=STUDENT_ID, bhawan_id=RAJENDRA, full_name="Asha", email="asha@ece.iitr.ac.in"
            ),
            HOMELESS_ID: StudentProfile(
                id=HOMELESS_ID, bhawan_id=None, full_name=None, email="new@ece.iitr.ac.in"
            ),
        }
        self.roles = {
            (AUTHORITY_ID, AppRole.MESS_AUTHORITY, RAJENDRA),
            (OTHER_AUTHORITY_ID, AppRole.MESS_AUTHORITY, GANGA),
        }
        self.rebates: dict[UUID, RebateOut] = {}
        self.race_overlap = False  # simulate a concurrent submit slipping past the pre-check
        self.race_stale = False  # simulate another authority acting first

    async def get_rules(self) -> RebateRules:
        return self.rules

    async def get_profile(self, user_id: UUID) -> StudentProfile | None:
        return self.profiles.get(user_id)

    async def has_overlap(self, student_id: UUID, start: date, end: date) -> bool:
        return any(
            r.student_id == student_id
            and r.status is not RebateStatus.REJECTED
            and r.start_date <= end
            and r.end_date >= start
            for r in self.rebates.values()
        )

    async def create(
        self,
        profile: StudentProfile,
        bhawan_id: UUID,
        start: date,
        end: date,
        reason: str,
        document_path: str | None,
    ) -> RebateOut:
        if self.race_overlap:
            raise RebateOverlapError
        row = RebateOut(
            id=uuid.uuid4(),
            student_id=profile.id,
            bhawan_id=bhawan_id,
            start_date=start,
            end_date=end,
            days=(end - start).days + 1,
            reason=reason,
            document_path=document_path,
            status=RebateStatus.PENDING_VERIFICATION,
            authority_remarks=None,
            reviewed_by=None,
            reviewed_at=None,
            created_at=datetime.now(UTC),
        )
        self.rebates[row.id] = row
        return row

    async def get(self, rebate_id: UUID) -> RebateOut | None:
        return self.rebates.get(rebate_id)

    async def has_bhawan_role(self, user_id: UUID, role: AppRole, bhawan_id: UUID) -> bool:
        return (user_id, role, bhawan_id) in self.roles

    async def transition(
        self,
        rebate_id: UUID,
        from_status: RebateStatus,
        to_status: RebateStatus,
        actor_id: UUID,
        remarks: str | None,
    ) -> RebateOut | None:
        row = self.rebates[rebate_id]
        if self.race_stale or row.status is not from_status:
            return None
        updated = row.model_copy(
            update={
                "status": to_status,
                "reviewed_by": actor_id,
                "reviewed_at": datetime.now(UTC),
                "authority_remarks": remarks,
            }
        )
        self.rebates[rebate_id] = updated
        return updated


class RecordingNotifier:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def notify_user(self, user_id: UUID, **kwargs: Any) -> None:
        self.calls.append({"user_id": user_id, **kwargs})


@pytest.fixture
def repo(app: FastAPI) -> InMemoryRebateRepository:
    repository = InMemoryRebateRepository()
    app.dependency_overrides[get_rebate_repository] = lambda: repository
    app.dependency_overrides[get_rebate_service] = lambda: RebateService(repository, lambda: TODAY)
    return repository


@pytest.fixture
def notifier(app: FastAPI) -> RecordingNotifier:
    recorder = RecordingNotifier()
    app.dependency_overrides[get_notifier] = lambda: recorder
    return recorder


@pytest.fixture
def student(make_token: TokenFactory) -> dict[str, str]:
    return bearer(make_token(sub=STUDENT_ID, roles=["student"]))


@pytest.fixture
def authority(make_token: TokenFactory) -> dict[str, str]:
    return bearer(make_token(sub=AUTHORITY_ID, roles=["mess_authority"]))


def rebate_body(**changes: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "start_date": "2026-10-20",
        "end_date": "2026-10-23",
        "reason": "Going home for Diwali",
    }
    body.update(changes)
    return {k: v for k, v in body.items() if v is not None}


def submit(client: TestClient, headers: dict[str, str], **changes: Any):
    return client.post("/v1/rebates", headers=headers, json=rebate_body(**changes))


def code(response: Any) -> str:
    return response.json()["detail"]["code"]


# ─── Submit (M5.2) ───────────────────────────────────────────────────────────
def test_student_submits_rebate(
    client: TestClient, repo: InMemoryRebateRepository, student: dict[str, str]
) -> None:
    path = f"{STUDENT_ID}/2026-10-17-abc.pdf"
    response = submit(client, student, document_path=path)

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending_verification"
    assert body["days"] == 4
    assert body["bhawan_id"] == str(RAJENDRA)  # from the live profile, not the request
    assert body["document_path"] == path


def test_requires_sign_in(client: TestClient, repo: InMemoryRebateRepository) -> None:
    assert client.post("/v1/rebates", json=rebate_body()).status_code == 401


def test_only_students_apply(
    client: TestClient, repo: InMemoryRebateRepository, authority: dict[str, str]
) -> None:
    response = submit(client, authority)
    assert response.status_code == 403
    assert code(response) == "STUDENTS_ONLY"


def test_bhawan_must_be_set(
    client: TestClient, repo: InMemoryRebateRepository, make_token: TokenFactory
) -> None:
    response = submit(client, bearer(make_token(sub=HOMELESS_ID, roles=["student"])))
    assert response.status_code == 422
    assert code(response) == "REBATE_NO_BHAWAN"


@pytest.mark.parametrize(
    ("changes", "status", "error"),
    [
        ({"start_date": "2026-10-23", "end_date": "2026-10-20"}, 422, "REBATE_INVALID_RANGE"),
        ({"end_date": "2026-10-21"}, 422, "REBATE_TOO_SHORT"),  # 2 days < min 3
        ({"end_date": "2027-06-01"}, 422, "REBATE_TOO_LONG"),
        ({"start_date": "2026-10-16"}, 422, "REBATE_PAST_DATE"),
        ({"document_path": f"{uuid.uuid4()}/someone-else.pdf"}, 422, "REBATE_BAD_DOCUMENT"),
    ],
)
def test_submit_rules(
    client: TestClient,
    repo: InMemoryRebateRepository,
    student: dict[str, str],
    changes: dict[str, Any],
    status: int,
    error: str,
) -> None:
    response = submit(client, student, **changes)
    assert response.status_code == status
    assert code(response) == error


def test_minimum_is_inclusive_and_read_from_settings(
    client: TestClient, repo: InMemoryRebateRepository, student: dict[str, str]
) -> None:
    assert submit(client, student, end_date="2026-10-22").status_code == 201  # exactly 3 days

    repo.rules = RebateRules(min_rebate_days=5, rebate_backdate_days=0)
    response = submit(client, student, start_date="2026-11-01", end_date="2026-11-04")
    assert code(response) == "REBATE_TOO_SHORT"
    assert "5 consecutive days" in response.json()["detail"]["message"]


def test_today_allowed_and_backdating_follows_settings(
    client: TestClient, repo: InMemoryRebateRepository, student: dict[str, str]
) -> None:
    assert (
        submit(client, student, start_date="2026-10-17", end_date="2026-10-19").status_code == 201
    )

    repo.rules = RebateRules(min_rebate_days=3, rebate_backdate_days=2)
    too_old = submit(client, student, start_date="2026-10-01", end_date="2026-10-03")
    assert code(too_old) == "REBATE_PAST_DATE"  # 16 days back
    assert "2 days ago" in too_old.json()["detail"]["message"]
    # Two days back is now allowed: it passes the date rules and only hits the 17–19 Oct overlap.
    backdated = submit(client, student, start_date="2026-10-15", end_date="2026-10-17")
    assert code(backdated) == "REBATE_OVERLAP"


def test_reason_is_validated(
    client: TestClient, repo: InMemoryRebateRepository, student: dict[str, str]
) -> None:
    response = submit(client, student, reason="home")
    assert response.status_code == 422


def test_overlap_rejected_but_rejected_rebates_free_their_dates(
    client: TestClient,
    repo: InMemoryRebateRepository,
    notifier: RecordingNotifier,
    student: dict[str, str],
    authority: dict[str, str],
) -> None:
    first = submit(client, student).json()
    overlap = submit(client, student, start_date="2026-10-23", end_date="2026-10-26")
    assert overlap.status_code == 409
    assert code(overlap) == "REBATE_OVERLAP"

    client.post(
        f"/v1/rebates/{first['id']}/transition",
        headers=authority,
        json={"to_status": "rejected", "remarks": "Hostel records show you present."},
    )
    assert (
        submit(client, student, start_date="2026-10-23", end_date="2026-10-26").status_code == 201
    )


def test_concurrent_overlap_caught_by_database(
    client: TestClient, repo: InMemoryRebateRepository, student: dict[str, str]
) -> None:
    repo.race_overlap = True
    response = submit(client, student)
    assert response.status_code == 409
    assert code(response) == "REBATE_OVERLAP"


# ─── Transitions (M5.3) ──────────────────────────────────────────────────────
def make_rebate(repo: InMemoryRebateRepository, status: RebateStatus) -> RebateOut:
    row = RebateOut(
        id=uuid.uuid4(),
        student_id=STUDENT_ID,
        bhawan_id=RAJENDRA,
        start_date=date(2026, 10, 20),
        end_date=date(2026, 10, 23),
        days=4,
        reason="Going home for Diwali",
        document_path=None,
        status=status,
        authority_remarks=None,
        reviewed_by=None,
        reviewed_at=None,
        created_at=datetime.now(UTC),
    )
    repo.rebates[row.id] = row
    return row


def transition(client: TestClient, headers: dict[str, str], rebate_id: UUID, **body: Any):
    return client.post(f"/v1/rebates/{rebate_id}/transition", headers=headers, json=body)


@pytest.mark.parametrize("from_status", list(RebateStatus))
@pytest.mark.parametrize("to_status", list(RebateStatus))
def test_transition_matrix(
    client: TestClient,
    repo: InMemoryRebateRepository,
    notifier: RecordingNotifier,
    authority: dict[str, str],
    from_status: RebateStatus,
    to_status: RebateStatus,
) -> None:
    rebate = make_rebate(repo, from_status)
    response = transition(
        client, authority, rebate.id, to_status=to_status.value, remarks="Checked the register"
    )

    if to_status in LEGAL_TRANSITIONS.get(from_status, frozenset()):
        assert response.status_code == 200
        assert response.json()["status"] == to_status.value
        assert response.json()["reviewed_by"] == str(AUTHORITY_ID)
        assert len(notifier.calls) == 1
    else:
        assert response.status_code == 409
        assert code(response) == "ILLEGAL_TRANSITION"
        assert notifier.calls == []


def test_full_lifecycle_notifies_student_each_step(
    client: TestClient,
    repo: InMemoryRebateRepository,
    notifier: RecordingNotifier,
    authority: dict[str, str],
) -> None:
    rebate = make_rebate(repo, RebateStatus.PENDING_VERIFICATION)
    assert (
        transition(client, authority, rebate.id, to_status="biometric_cross_checked").status_code
        == 200
    )
    assert transition(client, authority, rebate.id, to_status="approved").status_code == 200

    assert [c["user_id"] for c in notifier.calls] == [STUDENT_ID, STUDENT_ID]
    assert [c["title"] for c in notifier.calls] == ["Rebate verified", "Rebate approved"]
    assert notifier.calls[1]["body"] == "Your mess rebate for 20–23 Oct (4 days) was approved."
    assert notifier.calls[1]["data"] == {
        "type": "rebate",
        "rebate_id": str(rebate.id),
        "status": "approved",
    }


def test_reject_requires_remarks(
    client: TestClient,
    repo: InMemoryRebateRepository,
    notifier: RecordingNotifier,
    authority: dict[str, str],
) -> None:
    rebate = make_rebate(repo, RebateStatus.BIOMETRIC_CROSS_CHECKED)
    for remarks in (None, "   "):
        response = transition(client, authority, rebate.id, to_status="rejected", remarks=remarks)
        assert response.status_code == 422
        assert code(response) == "REMARKS_REQUIRED"

    response = transition(
        client, authority, rebate.id, to_status="rejected", remarks="Biometric shows meals taken"
    )
    assert response.status_code == 200
    assert notifier.calls[0]["body"].endswith("was rejected: Biometric shows meals taken")


def test_only_the_bhawans_mess_authority(
    client: TestClient,
    repo: InMemoryRebateRepository,
    student: dict[str, str],
    make_token: TokenFactory,
) -> None:
    rebate = make_rebate(repo, RebateStatus.PENDING_VERIFICATION)

    as_student = transition(client, student, rebate.id, to_status="rejected", remarks="nope")
    assert as_student.status_code == 403

    other = bearer(make_token(sub=OTHER_AUTHORITY_ID, roles=["mess_authority"]))
    response = transition(client, other, rebate.id, to_status="biometric_cross_checked")
    assert response.status_code == 403

    # JWT still says mess_authority, but the role was removed in the DB.
    revoked = bearer(make_token(sub=uuid.uuid4(), roles=["mess_authority"]))
    assert (
        transition(client, revoked, rebate.id, to_status="biometric_cross_checked").status_code
        == 403
    )


def test_unknown_rebate(
    client: TestClient, repo: InMemoryRebateRepository, authority: dict[str, str]
) -> None:
    response = transition(client, authority, uuid.uuid4(), to_status="approved")
    assert response.status_code == 404
    assert code(response) == "REBATE_NOT_FOUND"


def test_concurrent_review_is_stale(
    client: TestClient,
    repo: InMemoryRebateRepository,
    notifier: RecordingNotifier,
    authority: dict[str, str],
) -> None:
    rebate = make_rebate(repo, RebateStatus.PENDING_VERIFICATION)
    repo.race_stale = True
    response = transition(client, authority, rebate.id, to_status="biometric_cross_checked")
    assert response.status_code == 409
    assert code(response) == "REBATE_STALE"
    assert notifier.calls == []


def test_describe_transition_rejected() -> None:
    rebate = RebateOut(
        id=uuid.uuid4(),
        student_id=STUDENT_ID,
        bhawan_id=RAJENDRA,
        start_date=date(2026, 10, 30),
        end_date=date(2026, 11, 2),
        days=4,
        reason="x" * 10,
        document_path=None,
        status=RebateStatus.REJECTED,
        authority_remarks="Present at dinner",
        reviewed_by=AUTHORITY_ID,
        reviewed_at=datetime.now(UTC),
        created_at=datetime.now(UTC),
    )
    assert describe_transition(rebate) == (
        "Rebate rejected",
        "Your mess rebate for 30 Oct – 2 Nov (4 days) was rejected: Present at dinner",
    )
