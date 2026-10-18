from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.common import BHAWAN_SCOPED_ROLES, IITR_EMAIL_RE, AppRole
from app.services.phone import normalize_phone

AssignableRole = Literal["mess_secretary", "bhawan_secretary", "mess_authority", "adosw", "admin"]


class WhitelistCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    phone: str = Field(description="Any common Indian format; normalised to E.164.")
    outlet_id: UUID
    label: str | None = Field(default=None, max_length=80)

    @field_validator("phone")
    @classmethod
    def _normalize_phone(cls, value: str) -> str:
        return normalize_phone(value)


class WhitelistEntry(BaseModel):
    id: UUID
    phone_e164: str
    outlet_id: UUID
    outlet_name: str | None = None
    label: str | None = None
    active: bool
    created_at: datetime


class RoleAssignmentCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: str = Field(description="IITR Google account of a user who has signed in once.")
    role: AssignableRole
    bhawan_id: UUID | None = None

    @field_validator("email")
    @classmethod
    def _iitr_email(cls, value: str) -> str:
        email = value.lower()
        if not IITR_EMAIL_RE.match(email):
            raise ValueError("Must be an @iitr.ac.in email address.")
        return email

    @model_validator(mode="after")
    def _scope_matches_role(self) -> "RoleAssignmentCreate":
        scoped = AppRole(self.role) in BHAWAN_SCOPED_ROLES
        if scoped and self.bhawan_id is None:
            raise ValueError(f"{self.role} must be assigned to a Bhawan.")
        if not scoped and self.bhawan_id is not None:
            raise ValueError(f"{self.role} is campus-wide; omit bhawan_id.")
        return self


class RoleAssignmentOut(BaseModel):
    id: UUID
    user_id: UUID
    email: str | None = None
    full_name: str | None = None
    role: AppRole
    bhawan_id: UUID | None = None
    bhawan_name: str | None = None
    created_at: datetime


class ProfileSummary(BaseModel):
    id: UUID
    email: str | None = None
    full_name: str | None = None


class BhawanCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=3, max_length=60, description="e.g. Kasturba Bhawan")
    sort_order: int | None = Field(default=None, ge=0, description="Defaults to the end.")


class BhawanUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=3, max_length=60)
    sort_order: int | None = Field(default=None, ge=0)


class BhawanOut(BaseModel):
    id: UUID
    name: str
    slug: str
    sort_order: int


class EateryCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=60)
    location_tag: str | None = Field(default=None, max_length=60)

    @field_validator("location_tag")
    @classmethod
    def _blank_is_none(cls, value: str | None) -> str | None:
        return value or None


class EateryUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=2, max_length=60)
    location_tag: str | None = Field(
        default=None, max_length=60, description='Send null or "" to clear it.'
    )

    @field_validator("location_tag")
    @classmethod
    def _blank_is_none(cls, value: str | None) -> str | None:
        return value or None


class EateryOut(BaseModel):
    id: UUID
    name: str
    slug: str
    location_tag: str | None = None
