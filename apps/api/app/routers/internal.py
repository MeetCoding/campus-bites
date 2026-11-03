import hmac
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header

from app.core.config import Settings, get_settings
from app.core.errors import ApiError
from app.routers.complaints import Service
from app.schemas.complaints import ComplaintDomain, EscalationReport
from app.services.complaints import describe_escalation
from app.services.notifications import Notifier, get_notifier

router = APIRouter(prefix="/internal", tags=["internal"], include_in_schema=False)


def require_internal_secret(
    settings: Annotated[Settings, Depends(get_settings)],
    secret: Annotated[str | None, Header(alias="X-Internal-Secret")] = None,
) -> None:
    """Shared secret with pg_cron (Supabase Vault `internal_cron_secret`); no user JWT here."""
    expected = settings.internal_cron_secret.get_secret_value()
    if secret is None or not hmac.compare_digest(secret.encode(), expected.encode()):
        raise ApiError(401, "INVALID_INTERNAL_SECRET", "Missing or wrong internal secret.")


@router.post(
    "/escalations/run",
    response_model=EscalationReport,
    dependencies=[Depends(require_internal_secret)],
)
async def run_escalations(
    service: Service, notifier: Annotated[Notifier, Depends(get_notifier)]
) -> EscalationReport:
    """48 h sweep, called every 15 min. Idempotent: each complaint is escalated exactly once,
    so running it twice sends one set of notifications."""
    escalated, hours = await service.escalate_due()
    # The audience depends only on (domain, Bhawan), so resolve it once per group rather than
    # running several role queries for every complaint in a large sweep.
    audiences: dict[tuple[ComplaintDomain, UUID | None], list[UUID]] = {}
    for complaint in escalated:
        title, text = describe_escalation(complaint, hours)
        group = (complaint.domain, complaint.bhawan_id)
        if group not in audiences:
            audiences[group] = await service.escalation_audience(complaint)
        # Awaited (not background) so a cron call finishes only after the alerts went out.
        await notifier.notify_users(
            audiences[group],
            title=title,
            body=text,
            data={"type": "complaint", "complaint_id": str(complaint.id)},
            channel="nudges",
            priority="high",
        )
    return EscalationReport(escalated=len(escalated), complaint_ids=[c.id for c in escalated])
