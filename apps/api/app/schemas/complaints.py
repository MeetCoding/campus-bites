from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import AppRole


class ComplaintStatus(StrEnum):
    """Mirrors the `public.complaint_status` Postgres enum."""

    OPEN = "open"
    IN_PROGRESS = "in_progress"
    AWAITING_CONFIRMATION = "awaiting_confirmation"
    RESOLVED = "resolved"
    REOPENED = "reopened"


class ComplaintDomain(StrEnum):
    MESS = "mess"
    HOSTEL_CANTEEN = "hostel_canteen"
    CAMPUS_EATERY = "campus_eatery"


class ComplaintTransition(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    to_status: ComplaintStatus
    message: str | None = Field(default=None, max_length=1000)
    attachment_path: str | None = Field(
        default=None,
        max_length=300,
        description="Proof photo in `complaint-attachments`: {actor_id}/…",
    )

    @field_validator("message", "attachment_path")
    @classmethod
    def _blank_is_none(cls, value: str | None) -> str | None:
        return value or None


class ComplaintOut(BaseModel):
    id: UUID
    created_by: UUID
    outlet_id: UUID
    bhawan_id: UUID | None
    domain: ComplaintDomain
    assignee_role: AppRole
    category: str
    title: str
    status: ComplaintStatus
    opened_at: datetime
    resolved_at: datetime | None
    nudge_count: int
    last_nudged_at: datetime | None
    long_standing_at: datetime | None
    escalated_at: datetime | None
    created_at: datetime


class ComplaintRules(BaseModel):
    """The complaint columns of the single-row `app_settings`."""

    long_standing_after_hours: int
    nudge_eligible_after_hours: int
    nudge_cooldown_hours: int


class EscalationReport(BaseModel):
    escalated: int
    complaint_ids: list[UUID]
