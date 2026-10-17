import math
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal
from uuid import UUID

from app.core.auth import CurrentUser
from app.core.errors import ApiError
from app.repositories.complaints import ComplaintRepository
from app.schemas.common import AppRole
from app.schemas.complaints import (
    ComplaintDomain,
    ComplaintOut,
    ComplaintStatus,
    ComplaintTransition,
)

S = ComplaintStatus

# PRD §3D.1 routing.
HANDLER_ROLE: dict[ComplaintDomain, AppRole] = {
    ComplaintDomain.MESS: AppRole.MESS_SECRETARY,
    ComplaintDomain.HOSTEL_CANTEEN: AppRole.BHAWAN_SECRETARY,
    ComplaintDomain.CAMPUS_EATERY: AppRole.ADOSW,
}

# PRD §3D.2. Handlers move the work forward (and may post a progress reply while in progress);
# only the student who raised it can close or reopen it.
HANDLER_TRANSITIONS: dict[ComplaintStatus, frozenset[ComplaintStatus]] = {
    S.OPEN: frozenset({S.IN_PROGRESS}),
    S.REOPENED: frozenset({S.IN_PROGRESS}),
    S.IN_PROGRESS: frozenset({S.IN_PROGRESS, S.AWAITING_CONFIRMATION}),
}
STUDENT_TRANSITIONS: dict[ComplaintStatus, frozenset[ComplaintStatus]] = {
    S.AWAITING_CONFIRMATION: frozenset({S.RESOLVED, S.REOPENED}),
}

STATUS_LABEL: dict[ComplaintStatus, str] = {
    S.OPEN: "Open",
    S.IN_PROGRESS: "In progress",
    S.AWAITING_CONFIRMATION: "Marked fixed — please confirm",
    S.RESOLVED: "Resolved",
    S.REOPENED: "Reopened",
}

ActorRole = Literal["student", "handler"]


@dataclass(frozen=True)
class TransitionResult:
    complaint: ComplaintOut
    actor_role: ActorRole


def utc_now() -> datetime:
    return datetime.now(UTC)


def hours_until(moment: datetime, now: datetime) -> int:
    return max(1, math.ceil((moment - now).total_seconds() / 3600))


class ComplaintService:
    """Complaint state machine, nudges and the 48 h escalation sweep (ARCHITECTURE.md §6.6)."""

    def __init__(self, repo: ComplaintRepository, now: Callable[[], datetime] = utc_now) -> None:
        self._repo = repo
        self._now = now

    async def _get(self, complaint_id: UUID) -> ComplaintOut:
        complaint = await self._repo.get(complaint_id)
        if complaint is None:
            raise ApiError(404, "COMPLAINT_NOT_FOUND", "No complaint with that id.")
        return complaint

    async def is_handler(self, user: CurrentUser, complaint: ComplaintOut) -> bool:
        """JWT role first (cheap), then a live DB check so a removed secretary loses access."""
        role = HANDLER_ROLE[complaint.domain]
        if not user.has_role(role):
            return False
        if complaint.bhawan_id is None:
            return await self._repo.has_role(user.id, role)
        return await self._repo.has_bhawan_role(user.id, role, complaint.bhawan_id)

    async def handler_ids(self, complaint: ComplaintOut) -> list[UUID]:
        return await self._repo.users_with_role(HANDLER_ROLE[complaint.domain], complaint.bhawan_id)

    async def escalation_audience(self, complaint: ComplaintOut) -> list[UUID]:
        """Handlers plus, for Bhawan complaints, the Bhawan's Warden office (Mess Authority)."""
        audience = await self.handler_ids(complaint)
        if complaint.bhawan_id is not None:
            audience += await self._repo.users_with_role(
                AppRole.MESS_AUTHORITY, complaint.bhawan_id
            )
        return list(dict.fromkeys(audience))

    async def transition(
        self, user: CurrentUser, complaint_id: UUID, body: ComplaintTransition
    ) -> TransitionResult:
        complaint = await self._get(complaint_id)
        is_owner = complaint.created_by == user.id
        is_handler = await self.is_handler(user, complaint)
        handler_ok = body.to_status in HANDLER_TRANSITIONS.get(complaint.status, frozenset())
        student_ok = body.to_status in STUDENT_TRANSITIONS.get(complaint.status, frozenset())

        actor_role: ActorRole
        if handler_ok and is_handler:
            actor_role = "handler"
        elif student_ok and is_owner:
            actor_role = "student"
        elif not is_owner and not is_handler:
            raise ApiError(403, "FORBIDDEN", "This complaint isn't yours to act on.")
        elif student_ok:
            raise ApiError(
                403, "ONLY_COMPLAINANT", "Only the student who raised it can confirm or reopen."
            )
        elif handler_ok:
            raise ApiError(403, "ONLY_HANDLER", "Only the assigned secretary or ADoSW can do this.")
        else:
            raise ApiError(
                409,
                "ILLEGAL_TRANSITION",
                f"Can't move a {complaint.status.value} complaint to {body.to_status.value}.",
            )

        if actor_role == "handler" and body.to_status is S.IN_PROGRESS and not body.message:
            raise ApiError(422, "MESSAGE_REQUIRED", "Reply with what is being done about it.")
        if body.attachment_path is not None and not body.attachment_path.startswith(f"{user.id}/"):
            raise ApiError(422, "BAD_ATTACHMENT", "Upload the photo again and retry.")

        updated = await self._repo.transition(
            complaint.id,
            complaint.status,
            body.to_status,
            user.id,
            actor_role,
            body.message,
            body.attachment_path,
        )
        if updated is None:
            raise ApiError(
                409, "COMPLAINT_STALE", "Someone else just updated this complaint. Refresh."
            )
        return TransitionResult(updated, actor_role)

    async def nudge(self, user: CurrentUser, complaint_id: UUID) -> ComplaintOut:
        complaint = await self._get(complaint_id)
        if complaint.created_by != user.id:
            raise ApiError(403, "ONLY_COMPLAINANT", "Only the student who raised it can nudge.")
        if complaint.status is S.RESOLVED:
            raise ApiError(409, "COMPLAINT_RESOLVED", "This complaint is already resolved.")

        rules = await self._repo.get_rules()
        now = self._now()
        eligible_at = complaint.created_at + timedelta(hours=rules.nudge_eligible_after_hours)
        if now < eligible_at:
            raise ApiError(
                409,
                "NUDGE_TOO_EARLY",
                f"You can nudge {rules.nudge_eligible_after_hours // 24} days after raising it "
                f"(in {hours_until(eligible_at, now)} h).",
            )
        if complaint.last_nudged_at is not None:
            next_at = complaint.last_nudged_at + timedelta(hours=rules.nudge_cooldown_hours)
            if now < next_at:
                raise ApiError(
                    409,
                    "NUDGE_COOLDOWN",
                    f"You can nudge again in {hours_until(next_at, now)} h.",
                )

        # The RPC re-checks every condition in one UPDATE, so a double tap nudges once.
        nudged = await self._repo.nudge(complaint.id, user.id)
        if nudged is None:
            raise ApiError(409, "NUDGE_COOLDOWN", "Already nudged — try again later.")
        return nudged

    async def escalate_due(self) -> tuple[list[ComplaintOut], int]:
        """Marks newly long-standing complaints (once each); returns them and the threshold."""
        rules = await self._repo.get_rules()
        return await self._repo.escalate_due(), rules.long_standing_after_hours


def describe_for_student(complaint: ComplaintOut, message: str | None) -> tuple[str, str]:
    title = f"Complaint: {STATUS_LABEL[complaint.status]}"
    body = f"“{complaint.title}”" + (f" — {message}" if message else "")
    return title, body


def describe_for_handlers(complaint: ComplaintOut, message: str | None) -> tuple[str, str]:
    verb = "confirmed resolved" if complaint.status is S.RESOLVED else "reopened"
    body = f"The student {verb} “{complaint.title}”" + (f": {message}" if message else ".")
    return f"Complaint {verb}", body


def describe_nudge(complaint: ComplaintOut) -> tuple[str, str]:
    return (
        f"Nudge: unresolved complaint (nudged {complaint.nudge_count} times)",
        f"“{complaint.title}” is still {STATUS_LABEL[complaint.status].lower()}.",
    )


def describe_escalation(complaint: ComplaintOut, hours: int) -> tuple[str, str]:
    return (
        "LONG-STANDING ISSUE",
        f"“{complaint.title}” has been unresolved for {hours} h and is now escalated.",
    )
