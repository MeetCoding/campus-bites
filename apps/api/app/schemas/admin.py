import re
from datetime import datetime
from typing import Annotated, Literal
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


def _iitr_email(value: str) -> str:
    email = value.lower()
    if not IITR_EMAIL_RE.match(email):
        raise ValueError("Must be an @iitr.ac.in email address.")
    return email


class RoleAssignmentCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: str = Field(description="IITR Google account of a user who has signed in once.")
    role: AssignableRole
    bhawan_id: UUID | None = None

    @field_validator("email")
    @classmethod
    def _iitr(cls, value: str) -> str:
        return _iitr_email(value)

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


Latitude = Annotated[float, Field(ge=-90, le=90)]
Longitude = Annotated[float, Field(ge=-180, le=180)]


def _contact_phone(value: str | None) -> str | None:
    """Public contact number (not a login): blank clears it, anything else is normalised."""
    return normalize_phone(value) if value else None


def _check_pin(latitude: float | None, longitude: float | None) -> None:
    if (latitude is None) != (longitude is None):
        raise ValueError("Send latitude and longitude together (or both null to clear the pin).")


class EateryCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=60)
    location_tag: str | None = Field(default=None, max_length=60)
    latitude: Latitude | None = None
    longitude: Longitude | None = None
    contact_phone: str | None = Field(
        default=None, description="Worker's number shown to students; normalised to E.164."
    )

    @field_validator("location_tag")
    @classmethod
    def _blank_is_none(cls, value: str | None) -> str | None:
        return value or None

    @field_validator("contact_phone")
    @classmethod
    def _normalize_contact(cls, value: str | None) -> str | None:
        return _contact_phone(value)

    @model_validator(mode="after")
    def _pin_complete(self) -> "EateryCreate":
        _check_pin(self.latitude, self.longitude)
        return self


class EateryUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=2, max_length=60)
    location_tag: str | None = Field(
        default=None, max_length=60, description='Send null or "" to clear it.'
    )
    latitude: Latitude | None = Field(
        default=None, description="Map pin; null with longitude clears it."
    )
    longitude: Longitude | None = None
    contact_phone: str | None = Field(
        default=None, description='Worker phone shown to students; null or "" clears it.'
    )

    @field_validator("location_tag")
    @classmethod
    def _blank_is_none(cls, value: str | None) -> str | None:
        return value or None

    @field_validator("contact_phone")
    @classmethod
    def _normalize_contact(cls, value: str | None) -> str | None:
        return _contact_phone(value)

    @model_validator(mode="after")
    def _pin_complete(self) -> "EateryUpdate":
        # A pin moves as a whole: either both fields are sent or neither.
        if ("latitude" in self.model_fields_set) != ("longitude" in self.model_fields_set):
            raise ValueError("Send latitude and longitude together.")
        _check_pin(self.latitude, self.longitude)
        return self


class EateryOut(BaseModel):
    id: UUID
    name: str
    slug: str
    location_tag: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    contact_phone: str | None = None


class AdminCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: str = Field(description="IITR Google account; made admin now or at first sign-in.")

    @field_validator("email")
    @classmethod
    def _iitr(cls, value: str) -> str:
        return _iitr_email(value)


class AdminOut(BaseModel):
    email: str
    full_name: str | None = None
    status: Literal["active", "invited"] = Field(
        description="invited = listed, but hasn't signed in to Campus Bites yet."
    )
    is_owner: bool = False
    created_at: datetime


class VendorAccount(BaseModel):
    phone_e164: str
    has_account: bool
    is_master: bool = Field(default=False, description="Runs every outlet, now and later.")
    passcode_set_at: datetime | None = None
    last_sign_in_at: datetime | None = None


# Six digits, like the app's code field; refuse the guessable ones.
_PASSCODE_RE = re.compile(r"^\d{6}$")
_WEAK_PASSCODES = frozenset({"123456", "654321", "012345", "123123", "121212", "112233"})


class VendorPasscodeSet(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    phone: str = Field(description="A whitelisted vendor phone, any common Indian format.")
    passcode: str = Field(description="Exactly 6 digits.")

    @field_validator("phone")
    @classmethod
    def _normalize_phone(cls, value: str) -> str:
        return normalize_phone(value)

    @field_validator("passcode")
    @classmethod
    def _strong_enough(cls, value: str) -> str:
        if not _PASSCODE_RE.match(value):
            raise ValueError("The passcode must be exactly 6 digits.")
        if len(set(value)) == 1 or value in _WEAK_PASSCODES:
            raise ValueError("That passcode is too easy to guess.")
        return value


class MasterVendorCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    phone: str = Field(description="Any common Indian format; normalised to E.164.")
    label: str | None = Field(default=None, max_length=80)

    @field_validator("phone")
    @classmethod
    def _normalize_phone(cls, value: str) -> str:
        return normalize_phone(value)

    @field_validator("label")
    @classmethod
    def _blank_is_none(cls, value: str | None) -> str | None:
        return value or None


class MasterVendorOut(BaseModel):
    phone_e164: str
    outlets_linked: int = Field(description="Outlets the phone is now whitelisted for.")
