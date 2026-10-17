from datetime import date, datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RebateStatus(StrEnum):
    """Mirrors the `public.rebate_status` Postgres enum."""

    PENDING_VERIFICATION = "pending_verification"
    BIOMETRIC_CROSS_CHECKED = "biometric_cross_checked"
    APPROVED = "approved"
    REJECTED = "rejected"


class RebateCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    start_date: date
    end_date: date
    reason: str = Field(min_length=10, max_length=500)
    document_path: str | None = Field(
        default=None,
        max_length=300,
        description="Object path in the private `rebate-documents` bucket: {student_id}/…",
    )


class RebateTransition(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    to_status: RebateStatus
    remarks: str | None = Field(default=None, max_length=500)

    @field_validator("remarks")
    @classmethod
    def _blank_is_none(cls, value: str | None) -> str | None:
        return value or None


class RebateOut(BaseModel):
    id: UUID
    student_id: UUID
    bhawan_id: UUID
    start_date: date
    end_date: date
    days: int
    reason: str
    document_path: str | None
    status: RebateStatus
    authority_remarks: str | None
    reviewed_by: UUID | None
    reviewed_at: datetime | None
    created_at: datetime


class RebateRules(BaseModel):
    """The rebate columns of the single-row `app_settings`."""

    min_rebate_days: int
    rebate_backdate_days: int


class StudentProfile(BaseModel):
    id: UUID
    bhawan_id: UUID | None
    full_name: str | None
    email: str | None
