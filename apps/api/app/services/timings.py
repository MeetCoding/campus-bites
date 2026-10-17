from collections.abc import Callable
from datetime import date
from uuid import UUID

from app.core.auth import CurrentUser
from app.core.errors import ApiError
from app.core.time import format_dates, format_time, today_ist
from app.repositories.timings import TimingRepository
from app.schemas.common import AppRole
from app.schemas.timings import (
    OutletInfo,
    OutletType,
    TimingOverrideCreate,
    TimingOverrideOut,
)

CANTEEN_TYPES = {OutletType.DAY_CANTEEN, OutletType.NIGHT_CANTEEN}


def describe_override(outlet: OutletInfo, body: TimingOverrideCreate) -> tuple[str, str]:
    """Push title/body, e.g. 'Rajendra Bhawan Mess: timing change' /
    'Breakfast 8:00 AM – 10:00 AM 18–19 Oct. Exam season'."""
    what = body.slot.value.capitalize() if body.slot else "Hours"
    when = format_dates(body.starts_on, body.ends_on)
    if body.is_closed:
        detail = f"{what} closed {when}"
    else:
        assert body.opens_at is not None and body.closes_at is not None  # noqa: S101 — validated
        detail = f"{what} {format_time(body.opens_at)} – {format_time(body.closes_at)} {when}"
    return f"{outlet.name}: timing change", f"{detail}. {body.reason}"


class TimingService:
    """Mess timing overrides and canteen shift changes (ARCHITECTURE.md §6.1, §6.2)."""

    def __init__(self, repo: TimingRepository, today: Callable[[], date] = today_ist) -> None:
        self._repo = repo
        self._today = today

    async def _ensure_manager(self, user: CurrentUser, outlet: OutletInfo) -> None:
        """Same rule as app.can_manage_outlet() in SQL, re-checked live against the DB."""
        allowed = False
        if outlet.type is OutletType.MESS and outlet.bhawan_id:
            allowed = await self._repo.has_bhawan_role(
                user.id, AppRole.MESS_SECRETARY, outlet.bhawan_id
            )
        else:
            if outlet.type in CANTEEN_TYPES and outlet.bhawan_id:
                allowed = await self._repo.has_bhawan_role(
                    user.id, AppRole.BHAWAN_SECRETARY, outlet.bhawan_id
                )
            if not allowed and user.phone:
                phone = user.phone if user.phone.startswith("+") else f"+{user.phone}"
                allowed = await self._repo.vendor_owns_outlet(phone, outlet.id)
        if not allowed:
            raise ApiError(403, "FORBIDDEN", "You don't manage this outlet.")

    async def create_override(
        self, user: CurrentUser, outlet_id: UUID, body: TimingOverrideCreate
    ) -> tuple[TimingOverrideOut, OutletInfo]:
        outlet = await self._repo.get_outlet(outlet_id)
        if outlet is None:
            raise ApiError(404, "OUTLET_NOT_FOUND", "That outlet does not exist.")
        await self._ensure_manager(user, outlet)

        if body.starts_on < self._today():
            raise ApiError(422, "PAST_DATE", "Overrides can't start in the past.")
        if outlet.type is OutletType.MESS:
            if body.slot is None:
                raise ApiError(422, "SLOT_REQUIRED", "Pick breakfast, lunch or dinner.")
            opens, closes = body.opens_at, body.closes_at
            if opens is not None and closes is not None and closes <= opens:
                raise ApiError(
                    422, "INVALID_WINDOW", "A meal must close after it opens (no overnight meals)."
                )
        elif body.slot is not None:
            raise ApiError(422, "SLOT_NOT_ALLOWED", "Only mess overrides target a meal.")

        created = await self._repo.create_override(outlet.id, body, user.id)
        return created, outlet

    def should_notify(self, outlet: OutletInfo, body: TimingOverrideCreate) -> bool:
        # PRD §3A.1: every mess override is broadcast. Canteens notify on request; eateries have
        # no resident audience.
        if outlet.bhawan_id is None:
            return False
        return outlet.type is OutletType.MESS or body.notify

    async def revoke_override(self, user: CurrentUser, override_id: UUID) -> None:
        override = await self._repo.get_override(override_id)
        if override is None or override.revoked_at is not None:
            raise ApiError(404, "OVERRIDE_NOT_FOUND", "No active override with that id.")
        outlet = await self._repo.get_outlet(override.outlet_id)
        if outlet is None:
            raise ApiError(404, "OUTLET_NOT_FOUND", "That outlet does not exist.")
        await self._ensure_manager(user, outlet)
        await self._repo.revoke_override(override_id)
