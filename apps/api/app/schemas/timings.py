from datetime import date, datetime, time, timedelta
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

MAX_OVERRIDE_SPAN = timedelta(days=120)  # mirrors timing_overrides_dates


class MealSlot(StrEnum):
    BREAKFAST = "breakfast"
    LUNCH = "lunch"
    DINNER = "dinner"


class OutletType(StrEnum):
    MESS = "mess"
    DAY_CANTEEN = "day_canteen"
    NIGHT_CANTEEN = "night_canteen"
    EATERY = "eatery"


class TimingOverrideCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    slot: MealSlot | None = Field(
        default=None, description="Required for a mess; omit for canteens."
    )
    starts_on: date
    ends_on: date
    is_closed: bool = False
    opens_at: time | None = None
    closes_at: time | None = None
    reason: str = Field(min_length=3, max_length=200)
    notify: bool = Field(default=True, description="Mess overrides always notify residents.")

    @model_validator(mode="after")
    def _consistent(self) -> "TimingOverrideCreate":
        if self.ends_on < self.starts_on:
            raise ValueError("End date must be on or after the start date.")
        if self.ends_on - self.starts_on > MAX_OVERRIDE_SPAN:
            raise ValueError("An override can cover at most 120 days.")
        if self.is_closed:
            if self.opens_at is not None or self.closes_at is not None:
                raise ValueError("Leave the times empty when marking it closed.")
        else:
            if self.opens_at is None or self.closes_at is None:
                raise ValueError("Give both an opening and a closing time.")
            if self.opens_at == self.closes_at:
                raise ValueError("Opening and closing times must differ.")
        return self


class TimingOverrideOut(BaseModel):
    id: UUID
    outlet_id: UUID
    slot: MealSlot | None
    starts_on: date
    ends_on: date
    is_closed: bool
    opens_at: time | None
    closes_at: time | None
    reason: str
    created_by: UUID | None
    created_at: datetime
    revoked_at: datetime | None = None
    notified: bool = False


class OutletInfo(BaseModel):
    id: UUID
    type: OutletType
    bhawan_id: UUID | None
    name: str
