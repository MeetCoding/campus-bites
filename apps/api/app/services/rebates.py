from collections.abc import Callable
from datetime import date, timedelta
from uuid import UUID

from app.core.auth import CurrentUser
from app.core.errors import ApiError
from app.repositories.rebates import RebateOverlapError, RebateRepository
from app.schemas.common import AppRole
from app.schemas.rebates import RebateCreate, RebateOut, RebateStatus, RebateTransition
from app.services.timings import format_dates, today_ist

MAX_REBATE_DAYS = 180  # sanity cap; mirrors rebate_applications_dates

# PRD §3A.4: Pending Verification → Biometric Cross-Checked → Approved / Rejected (with remarks).
# Rejection is allowed before the cross-check too (e.g. a reason that doesn't qualify).
LEGAL_TRANSITIONS: dict[RebateStatus, frozenset[RebateStatus]] = {
    RebateStatus.PENDING_VERIFICATION: frozenset(
        {RebateStatus.BIOMETRIC_CROSS_CHECKED, RebateStatus.REJECTED}
    ),
    RebateStatus.BIOMETRIC_CROSS_CHECKED: frozenset({RebateStatus.APPROVED, RebateStatus.REJECTED}),
}


def describe_transition(rebate: RebateOut) -> tuple[str, str]:
    """Push title/body for the student, e.g. 'Rebate approved' / 'Your rebate for 20–23 Oct…'."""
    when = format_dates(rebate.start_date, rebate.end_date)
    subject = f"Your mess rebate for {when} ({rebate.days} days)"
    if rebate.status is RebateStatus.BIOMETRIC_CROSS_CHECKED:
        return "Rebate verified", f"{subject} passed the biometric cross-check. Awaiting approval."
    if rebate.status is RebateStatus.APPROVED:
        return "Rebate approved", f"{subject} was approved."
    return "Rebate rejected", f"{subject} was rejected: {rebate.authority_remarks}"


class RebateService:
    """Mess rebate submission and authority workflow (ARCHITECTURE.md §3.2, §5.8)."""

    def __init__(self, repo: RebateRepository, today: Callable[[], date] = today_ist) -> None:
        self._repo = repo
        self._today = today

    async def submit(self, user: CurrentUser, body: RebateCreate) -> RebateOut:
        if not user.has_role(AppRole.STUDENT):
            raise ApiError(403, "STUDENTS_ONLY", "Only students can apply for a mess rebate.")
        profile = await self._repo.get_profile(user.id)
        if profile is None or profile.bhawan_id is None:
            raise ApiError(422, "REBATE_NO_BHAWAN", "Choose your Bhawan before applying.")

        if body.end_date < body.start_date:
            raise ApiError(422, "REBATE_INVALID_RANGE", "The end date is before the start date.")
        rules = await self._repo.get_rules()
        days = (body.end_date - body.start_date).days + 1
        if days < rules.min_rebate_days:
            raise ApiError(
                422,
                "REBATE_TOO_SHORT",
                f"A rebate must cover at least {rules.min_rebate_days} consecutive days.",
            )
        if days > MAX_REBATE_DAYS:
            raise ApiError(
                422, "REBATE_TOO_LONG", f"A rebate can cover at most {MAX_REBATE_DAYS} days."
            )
        earliest = self._today() - timedelta(days=rules.rebate_backdate_days)
        if body.start_date < earliest:
            raise ApiError(
                422,
                "REBATE_PAST_DATE",
                "A rebate can't start in the past."
                if rules.rebate_backdate_days == 0
                else f"A rebate can start at most {rules.rebate_backdate_days} days ago.",
            )
        if body.document_path is not None and not body.document_path.startswith(f"{user.id}/"):
            raise ApiError(422, "REBATE_BAD_DOCUMENT", "Upload the document again and retry.")

        overlap = ApiError(
            409, "REBATE_OVERLAP", "These dates overlap a rebate you've already applied for."
        )
        if await self._repo.has_overlap(user.id, body.start_date, body.end_date):
            raise overlap
        try:
            return await self._repo.create(
                profile,
                profile.bhawan_id,
                body.start_date,
                body.end_date,
                body.reason,
                body.document_path,
            )
        except RebateOverlapError as exc:
            raise overlap from exc

    async def transition(
        self, user: CurrentUser, rebate_id: UUID, body: RebateTransition
    ) -> RebateOut:
        if not user.has_role(AppRole.MESS_AUTHORITY):
            raise ApiError(403, "FORBIDDEN", "Only the Mess Authority can review rebates.")
        rebate = await self._repo.get(rebate_id)
        if rebate is None:
            raise ApiError(404, "REBATE_NOT_FOUND", "No rebate application with that id.")
        # Live check (not the JWT): a removed authority loses access immediately.
        if not await self._repo.has_bhawan_role(user.id, AppRole.MESS_AUTHORITY, rebate.bhawan_id):
            raise ApiError(403, "FORBIDDEN", "This application belongs to another Bhawan.")
        if body.to_status not in LEGAL_TRANSITIONS.get(rebate.status, frozenset()):
            raise ApiError(
                409,
                "ILLEGAL_TRANSITION",
                f"Can't move a {rebate.status.value} application to {body.to_status.value}.",
            )
        if body.to_status is RebateStatus.REJECTED and not body.remarks:
            raise ApiError(422, "REMARKS_REQUIRED", "Give the student a reason for rejecting.")

        updated = await self._repo.transition(
            rebate_id, rebate.status, body.to_status, user.id, body.remarks
        )
        if updated is None:
            raise ApiError(
                409, "REBATE_STALE", "Someone else just updated this application. Refresh."
            )
        return updated
