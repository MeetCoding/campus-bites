from datetime import UTC, datetime
from typing import Annotated, Any, Protocol
from uuid import UUID

from fastapi import Depends
from supabase import AsyncClient

from app.core.supabase import get_supabase
from app.schemas.common import AppRole
from app.schemas.timings import OutletInfo, TimingOverrideCreate, TimingOverrideOut

_OVERRIDE_COLUMNS = (
    "id, outlet_id, slot, starts_on, ends_on, is_closed, opens_at, closes_at, reason, "
    "created_by, created_at, revoked_at"
)


class TimingRepository(Protocol):
    async def get_outlet(self, outlet_id: UUID) -> OutletInfo | None: ...
    async def has_bhawan_role(self, user_id: UUID, role: AppRole, bhawan_id: UUID) -> bool: ...
    async def vendor_owns_outlet(self, phone_e164: str, outlet_id: UUID) -> bool: ...
    async def create_override(
        self, outlet_id: UUID, body: TimingOverrideCreate, created_by: UUID
    ) -> TimingOverrideOut: ...
    async def get_override(self, override_id: UUID) -> TimingOverrideOut | None: ...
    async def revoke_override(self, override_id: UUID) -> None: ...


class SupabaseTimingRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    async def get_outlet(self, outlet_id: UUID) -> OutletInfo | None:
        res = await (
            self._db.table("outlets")
            .select("id, type, bhawan_id, name")
            .eq("id", str(outlet_id))
            .execute()
        )
        return OutletInfo(**res.data[0]) if res.data else None

    async def has_bhawan_role(self, user_id: UUID, role: AppRole, bhawan_id: UUID) -> bool:
        res = await (
            self._db.table("role_assignments")
            .select("id")
            .eq("user_id", str(user_id))
            .eq("role", role.value)
            .eq("bhawan_id", str(bhawan_id))
            .limit(1)
            .execute()
        )
        return bool(res.data)

    async def vendor_owns_outlet(self, phone_e164: str, outlet_id: UUID) -> bool:
        res = await (
            self._db.table("whitelisted_vendors")
            .select("id")
            .eq("phone_e164", phone_e164)
            .eq("outlet_id", str(outlet_id))
            .eq("active", True)
            .limit(1)
            .execute()
        )
        return bool(res.data)

    async def create_override(
        self, outlet_id: UUID, body: TimingOverrideCreate, created_by: UUID
    ) -> TimingOverrideOut:
        row: dict[str, Any] = {
            "outlet_id": str(outlet_id),
            "slot": body.slot.value if body.slot else None,
            "starts_on": body.starts_on.isoformat(),
            "ends_on": body.ends_on.isoformat(),
            "is_closed": body.is_closed,
            "opens_at": body.opens_at.isoformat() if body.opens_at else None,
            "closes_at": body.closes_at.isoformat() if body.closes_at else None,
            "reason": body.reason,
            "created_by": str(created_by),
        }
        res = await self._db.table("timing_overrides").insert(row).execute()
        return TimingOverrideOut(**res.data[0])

    async def get_override(self, override_id: UUID) -> TimingOverrideOut | None:
        res = await (
            self._db.table("timing_overrides")
            .select(_OVERRIDE_COLUMNS)
            .eq("id", str(override_id))
            .execute()
        )
        return TimingOverrideOut(**res.data[0]) if res.data else None

    async def revoke_override(self, override_id: UUID) -> None:
        await (
            self._db.table("timing_overrides")
            .update({"revoked_at": datetime.now(UTC).isoformat()})
            .eq("id", str(override_id))
            .is_("revoked_at", "null")
            .execute()
        )


def get_timing_repository(
    client: Annotated[AsyncClient, Depends(get_supabase)],
) -> TimingRepository:
    return SupabaseTimingRepository(client)
