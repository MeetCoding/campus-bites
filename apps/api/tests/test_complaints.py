import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.repositories.complaints import get_complaint_repository
from app.routers.complaints import get_complaint_service
from app.schemas.common import AppRole
from app.schemas.complaints import ComplaintDomain, ComplaintOut, ComplaintRules, ComplaintStatus
from app.services.complaints import (
    HANDLER_TRANSITIONS,
    STUDENT_TRANSITIONS,
    ComplaintService,
)
from app.services.notifications import get_notifier
from tests.conftest import TokenFactory, bearer

NOW = datetime(2026, 10, 18, 12, 0, tzinfo=UTC)
RAJENDRA = uuid.uuid4()
GANGA = uuid.uuid4()
STUDENT = uuid.uuid4()
OTHER_STUDENT = uuid.uuid4()
MESS_SECY = uuid.uuid4()  # Rajendra
GANGA_MESS_SECY = uuid.uuid4()
CANTEEN_SECY = uuid.uuid4()  # Rajendra Bhawan Secretary
ADOSW = uuid.uuid4()
WARDEN = uuid.uuid4()  # Rajendra Mess Authority
REVOKED_SECY = uuid.uuid4()  # JWT still says mess_secretary; DB row deleted

S = ComplaintStatus


class InMemoryComplaintRepository:
    def __init__(self) -> None:
        self.rules = ComplaintRules(
            long_standing_after_hours=48, nudge_eligible_after_hours=168, nudge_cooldown_hours=24
        )
        self.bhawan_roles = {
            (MESS_SECY, AppRole.MESS_SECRETARY, RAJENDRA),
            (GANGA_MESS_SECY, AppRole.MESS_SECRETARY, GANGA),
            (CANTEEN_SECY, AppRole.BHAWAN_SECRETARY, RAJENDRA),
            (WARDEN, AppRole.MESS_AUTHORITY, RAJENDRA),
        }
        self.global_roles = {(ADOSW, AppRole.ADOSW)}
        self.complaints: dict[UUID, ComplaintOut] = {}
        self.events: list[dict[str, Any]] = []
        self.race = False  # simulate a concurrent change between read and write

    async def get(self, complaint_id: UUID) -> ComplaintOut | None:
        return self.complaints.get(complaint_id)

    async def get_rules(self) -> ComplaintRules:
        return self.rules

    async def has_bhawan_role(self, user_id: UUID, role: AppRole, bhawan_id: UUID) -> bool:
        return (user_id, role, bhawan_id) in self.bhawan_roles

    async def has_role(self, user_id: UUID, role: AppRole) -> bool:
        return (user_id, role) in self.global_roles

    async def users_with_role(self, role: AppRole, bhawan_id: UUID | None) -> list[UUID]:
        if bhawan_id is None:
            return [u for u, r in self.global_roles if r is role]
        return [u for u, r, b in self.bhawan_roles if r is role and b == bhawan_id]

    async def transition(
        self,
        complaint_id: UUID,
        from_status: ComplaintStatus,
        to_status: ComplaintStatus,
        actor_id: UUID,
        actor_role: str,
        message: str | None,
        attachment_path: str | None,
    ) -> ComplaintOut | None:
        row = self.complaints[complaint_id]
        if self.race or row.status is not from_status:
            return None
        reopened = to_status is S.REOPENED
        updated = row.model_copy(
            update={
                "status": to_status,
                "opened_at": NOW if reopened else row.opened_at,
                "long_standing_at": None if reopened else row.long_standing_at,
                "escalated_at": None if reopened else row.escalated_at,
            }
        )
        self.complaints[complaint_id] = updated
        self.events.append({"kind": "status", "actor_role": actor_role, "message": message})
        return updated

    async def nudge(self, complaint_id: UUID, student_id: UUID) -> ComplaintOut | None:
        if self.race:
            return None
        row = self.complaints[complaint_id]
        updated = row.model_copy(update={"nudge_count": row.nudge_count + 1, "last_nudged_at": NOW})
        self.complaints[complaint_id] = updated
        return updated

    async def escalate_due(self) -> list[ComplaintOut]:
        due = [
            c
            for c in self.complaints.values()
            if c.status in (S.OPEN, S.IN_PROGRESS, S.REOPENED)
            and c.long_standing_at is None
            and NOW - c.opened_at >= timedelta(hours=self.rules.long_standing_after_hours)
        ]
        for c in due:
            self.complaints[c.id] = c.model_copy(
                update={"long_standing_at": NOW, "escalated_at": NOW}
            )
        return [self.complaints[c.id] for c in due]


class RecordingNotifier:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def notify_users(self, user_ids: list[UUID], **kwargs: Any) -> None:
        self.calls.append({"user_ids": user_ids, **kwargs})


@pytest.fixture
def repo(app: FastAPI) -> InMemoryComplaintRepository:
    repository = InMemoryComplaintRepository()
    app.dependency_overrides[get_complaint_repository] = lambda: repository
    app.dependency_overrides[get_complaint_service] = lambda: ComplaintService(
        repository, lambda: NOW
    )
    return repository


@pytest.fixture
def notifier(app: FastAPI) -> RecordingNotifier:
    recorder = RecordingNotifier()
    app.dependency_overrides[get_notifier] = lambda: recorder
    return recorder


def make_complaint(
    repo: InMemoryComplaintRepository,
    status: ComplaintStatus = S.OPEN,
    domain: ComplaintDomain = ComplaintDomain.MESS,
    age: timedelta = timedelta(hours=1),
    **changes: Any,
) -> ComplaintOut:
    bhawan = None if domain is ComplaintDomain.CAMPUS_EATERY else RAJENDRA
    assignee = {
        ComplaintDomain.MESS: AppRole.MESS_SECRETARY,
        ComplaintDomain.HOSTEL_CANTEEN: AppRole.BHAWAN_SECRETARY,
        ComplaintDomain.CAMPUS_EATERY: AppRole.ADOSW,
    }[domain]
    row = ComplaintOut(
        id=uuid.uuid4(),
        created_by=STUDENT,
        outlet_id=uuid.uuid4(),
        bhawan_id=bhawan,
        domain=domain,
        assignee_role=assignee,
        category="food_quality",
        title="Milk diluted at breakfast",
        status=status,
        opened_at=NOW - age,
        resolved_at=None,
        nudge_count=0,
        last_nudged_at=None,
        long_standing_at=None,
        escalated_at=None,
        created_at=NOW - age,
    )
    row = row.model_copy(update=changes)
    repo.complaints[row.id] = row
    return row


def token(make_token: TokenFactory, user: UUID, *roles: str) -> dict[str, str]:
    return bearer(make_token(sub=user, roles=list(roles)))


def act(client: TestClient, headers: dict[str, str], complaint: ComplaintOut, **body: Any):
    return client.post(f"/v1/complaints/{complaint.id}/transition", headers=headers, json=body)


def code(response: Any) -> str:
    return response.json()["detail"]["code"]


# ─── M6.4 state machine: every (actor, from, to) ─────────────────────────────
ACTORS = {
    "complainant": (STUDENT, ("student",)),
    "other_student": (OTHER_STUDENT, ("student",)),
    "handler": (MESS_SECY, ("student", "mess_secretary")),
    "other_bhawan_handler": (GANGA_MESS_SECY, ("student", "mess_secretary")),
    "revoked_handler": (REVOKED_SECY, ("student", "mess_secretary")),
}


@pytest.mark.parametrize("actor", list(ACTORS))
@pytest.mark.parametrize("from_status", list(S))
@pytest.mark.parametrize("to_status", list(S))
def test_transition_matrix(
    client: TestClient,
    repo: InMemoryComplaintRepository,
    notifier: RecordingNotifier,
    make_token: TokenFactory,
    actor: str,
    from_status: ComplaintStatus,
    to_status: ComplaintStatus,
) -> None:
    complaint = make_complaint(repo, from_status)
    user, roles = ACTORS[actor]
    response = act(
        client, token(make_token, user, *roles), complaint, to_status=to_status, message="Update"
    )

    handler_ok = to_status in HANDLER_TRANSITIONS.get(from_status, frozenset())
    student_ok = to_status in STUDENT_TRANSITIONS.get(from_status, frozenset())
    if actor == "handler" and handler_ok:
        assert response.status_code == 200
        assert notifier.calls[0]["user_ids"] == [STUDENT]  # the other party
    elif actor == "complainant" and student_ok:
        assert response.status_code == 200
        assert notifier.calls[0]["user_ids"] == [MESS_SECY]
    else:
        assert response.status_code in (403, 409)
        assert notifier.calls == []
        if actor in ("other_student", "other_bhawan_handler", "revoked_handler"):
            assert code(response) == "FORBIDDEN"
        elif actor == "complainant" and handler_ok:
            assert code(response) == "ONLY_HANDLER"
        elif actor == "handler" and student_ok:
            assert code(response) == "ONLY_COMPLAINANT"
        else:
            assert code(response) == "ILLEGAL_TRANSITION"


@pytest.mark.parametrize(
    ("domain", "user", "roles"),
    [
        (ComplaintDomain.HOSTEL_CANTEEN, CANTEEN_SECY, ("student", "bhawan_secretary")),
        (ComplaintDomain.CAMPUS_EATERY, ADOSW, ("adosw",)),
    ],
)
def test_routing_to_each_handler(
    client: TestClient,
    repo: InMemoryComplaintRepository,
    notifier: RecordingNotifier,
    make_token: TokenFactory,
    domain: ComplaintDomain,
    user: UUID,
    roles: tuple[str, ...],
) -> None:
    complaint = make_complaint(repo, S.OPEN, domain)
    headers = token(make_token, user, *roles)
    assert (
        act(client, headers, complaint, to_status="in_progress", message="On it").status_code == 200
    )

    # A Mess Secretary can't act on canteen or eatery complaints.
    other = make_complaint(repo, S.OPEN, domain)
    mess = token(make_token, MESS_SECY, "student", "mess_secretary")
    assert act(client, mess, other, to_status="in_progress", message="x").status_code == 403


def test_full_lifecycle_with_reopen(
    client: TestClient,
    repo: InMemoryComplaintRepository,
    notifier: RecordingNotifier,
    make_token: TokenFactory,
) -> None:
    complaint = make_complaint(repo, S.OPEN, age=timedelta(hours=60), long_standing_at=NOW)
    secy = token(make_token, MESS_SECY, "student", "mess_secretary")
    student = token(make_token, STUDENT, "student")

    assert (
        act(
            client, secy, complaint, to_status="in_progress", message="Supplier changed"
        ).status_code
        == 200
    )
    assert (
        act(
            client, secy, complaint, to_status="in_progress", message="Update: testing milk"
        ).status_code
        == 200
    )
    proof = f"{MESS_SECY}/2026-10-18-proof.jpg"
    assert (
        act(
            client, secy, complaint, to_status="awaiting_confirmation", attachment_path=proof
        ).status_code
        == 200
    )
    reopened = act(client, student, complaint, to_status="reopened", message="Still watery").json()
    assert reopened["status"] == "reopened"
    assert reopened["long_standing_at"] is None  # 48 h clock restarts
    assert (
        act(client, secy, complaint, to_status="in_progress", message="Second fix").status_code
        == 200
    )
    act(client, secy, complaint, to_status="awaiting_confirmation")
    assert act(client, student, complaint, to_status="resolved").json()["status"] == "resolved"
    assert [c["title"] for c in notifier.calls][-1] == "Complaint confirmed resolved"


def test_reply_required_to_start_work(
    client: TestClient,
    repo: InMemoryComplaintRepository,
    notifier: RecordingNotifier,
    make_token: TokenFactory,
) -> None:
    complaint = make_complaint(repo, S.OPEN)
    secy = token(make_token, MESS_SECY, "student", "mess_secretary")
    response = act(client, secy, complaint, to_status="in_progress", message="   ")
    assert response.status_code == 422
    assert code(response) == "MESSAGE_REQUIRED"


def test_attachment_must_be_the_actors_own(
    client: TestClient,
    repo: InMemoryComplaintRepository,
    notifier: RecordingNotifier,
    make_token: TokenFactory,
) -> None:
    complaint = make_complaint(repo, S.IN_PROGRESS)
    secy = token(make_token, MESS_SECY, "student", "mess_secretary")
    response = act(
        client,
        secy,
        complaint,
        to_status="awaiting_confirmation",
        attachment_path=f"{STUDENT}/x.jpg",
    )
    assert code(response) == "BAD_ATTACHMENT"


def test_concurrent_change_is_stale(
    client: TestClient,
    repo: InMemoryComplaintRepository,
    notifier: RecordingNotifier,
    make_token: TokenFactory,
) -> None:
    complaint = make_complaint(repo, S.AWAITING_CONFIRMATION)
    repo.race = True
    response = act(client, token(make_token, STUDENT, "student"), complaint, to_status="resolved")
    assert response.status_code == 409
    assert code(response) == "COMPLAINT_STALE"
    assert notifier.calls == []


def test_unknown_complaint_and_sign_in(
    client: TestClient, repo: InMemoryComplaintRepository, make_token: TokenFactory
) -> None:
    missing = client.post(
        f"/v1/complaints/{uuid.uuid4()}/transition",
        headers=token(make_token, STUDENT, "student"),
        json={"to_status": "resolved"},
    )
    assert code(missing) == "COMPLAINT_NOT_FOUND"
    assert client.post(f"/v1/complaints/{uuid.uuid4()}/nudge").status_code == 401


# ─── M6.5 nudge ──────────────────────────────────────────────────────────────
def nudge(client: TestClient, headers: dict[str, str], complaint: ComplaintOut):
    return client.post(f"/v1/complaints/{complaint.id}/nudge", headers=headers)


def test_nudge_after_seven_days_notifies_handlers_high_priority(
    client: TestClient,
    repo: InMemoryComplaintRepository,
    notifier: RecordingNotifier,
    make_token: TokenFactory,
) -> None:
    complaint = make_complaint(
        repo, S.IN_PROGRESS, ComplaintDomain.HOSTEL_CANTEEN, timedelta(days=8)
    )
    response = nudge(client, token(make_token, STUDENT, "student"), complaint)

    assert response.status_code == 200
    assert response.json()["nudge_count"] == 1
    call = notifier.calls[0]
    assert call["user_ids"] == [CANTEEN_SECY]
    assert call["priority"] == "high" and call["channel"] == "nudges"
    assert call["title"] == "Nudge: unresolved complaint (nudged 1 times)"


@pytest.mark.parametrize(
    ("age", "last_nudged", "status", "expected"),
    [
        (timedelta(days=6, hours=23), None, S.OPEN, "NUDGE_TOO_EARLY"),
        (timedelta(days=8), timedelta(hours=23), S.OPEN, "NUDGE_COOLDOWN"),
        (timedelta(days=8), None, S.RESOLVED, "COMPLAINT_RESOLVED"),
    ],
)
def test_nudge_rules(
    client: TestClient,
    repo: InMemoryComplaintRepository,
    notifier: RecordingNotifier,
    make_token: TokenFactory,
    age: timedelta,
    last_nudged: timedelta | None,
    status: ComplaintStatus,
    expected: str,
) -> None:
    complaint = make_complaint(
        repo, status, age=age, last_nudged_at=None if last_nudged is None else NOW - last_nudged
    )
    response = nudge(client, token(make_token, STUDENT, "student"), complaint)
    assert response.status_code == 409
    assert code(response) == expected
    assert notifier.calls == []


def test_nudge_cooldown_message_counts_down(
    client: TestClient,
    repo: InMemoryComplaintRepository,
    notifier: RecordingNotifier,
    make_token: TokenFactory,
) -> None:
    complaint = make_complaint(
        repo, age=timedelta(days=9), last_nudged_at=NOW - timedelta(hours=20)
    )
    response = nudge(client, token(make_token, STUDENT, "student"), complaint)
    assert response.json()["detail"]["message"] == "You can nudge again in 4 h."
    repo.complaints[complaint.id] = complaint.model_copy(
        update={"last_nudged_at": NOW - timedelta(hours=24)}
    )
    assert nudge(client, token(make_token, STUDENT, "student"), complaint).status_code == 200


def test_only_complainant_nudges(
    client: TestClient,
    repo: InMemoryComplaintRepository,
    notifier: RecordingNotifier,
    make_token: TokenFactory,
) -> None:
    complaint = make_complaint(repo, age=timedelta(days=8))
    response = nudge(client, token(make_token, OTHER_STUDENT, "student"), complaint)
    assert response.status_code == 403
    assert code(response) == "ONLY_COMPLAINANT"


def test_double_tap_yields_one_nudge(
    client: TestClient,
    repo: InMemoryComplaintRepository,
    notifier: RecordingNotifier,
    make_token: TokenFactory,
) -> None:
    complaint = make_complaint(repo, age=timedelta(days=8))
    headers = token(make_token, STUDENT, "student")
    assert nudge(client, headers, complaint).status_code == 200
    # Second tap: either the pre-check (last_nudged_at now set) or the DB conditional UPDATE
    # (simulated here by race=True) stops it.
    second = nudge(client, headers, complaint)
    assert code(second) == "NUDGE_COOLDOWN"
    repo.complaints[complaint.id] = repo.complaints[complaint.id].model_copy(
        update={"last_nudged_at": None}
    )
    repo.race = True
    assert code(nudge(client, headers, complaint)) == "NUDGE_COOLDOWN"
    assert len(notifier.calls) == 1


# ─── M6.6 escalation sweep ───────────────────────────────────────────────────
SECRET = {"X-Internal-Secret": "test-cron-secret"}


def test_escalation_requires_the_internal_secret(
    client: TestClient, repo: InMemoryComplaintRepository, notifier: RecordingNotifier
) -> None:
    assert client.post("/internal/escalations/run").status_code == 401
    wrong = client.post("/internal/escalations/run", headers={"X-Internal-Secret": "nope"})
    assert wrong.status_code == 401
    assert code(wrong) == "INVALID_INTERNAL_SECRET"


def test_escalation_runs_once_and_alerts_handlers_and_warden(
    client: TestClient, repo: InMemoryComplaintRepository, notifier: RecordingNotifier
) -> None:
    canteen = make_complaint(repo, S.OPEN, ComplaintDomain.HOSTEL_CANTEEN, timedelta(hours=49))
    eatery = make_complaint(repo, S.IN_PROGRESS, ComplaintDomain.CAMPUS_EATERY, timedelta(hours=50))
    make_complaint(repo, S.OPEN, age=timedelta(hours=47))  # not yet
    make_complaint(repo, S.AWAITING_CONFIRMATION, age=timedelta(hours=90))  # handler did their part

    first = client.post("/internal/escalations/run", headers=SECRET)
    assert first.status_code == 200
    assert first.json()["escalated"] == 2
    assert set(first.json()["complaint_ids"]) == {str(canteen.id), str(eatery.id)}
    audiences = {tuple(c["user_ids"]) for c in notifier.calls}
    assert audiences == {(CANTEEN_SECY, WARDEN), (ADOSW,)}
    assert all(c["priority"] == "high" for c in notifier.calls)
    assert notifier.calls[0]["body"].endswith("has been unresolved for 48 h and is now escalated.")

    second = client.post("/internal/escalations/run", headers=SECRET)
    assert second.json()["escalated"] == 0
    assert len(notifier.calls) == 2  # running twice sends one notification set
