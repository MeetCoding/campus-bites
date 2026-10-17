from typing import Annotated, Any, Protocol
from uuid import UUID

from fastapi import Depends
from postgrest.exceptions import APIError
from supabase import AsyncClient

from app.core.supabase import get_supabase
from app.schemas.admin import ProfileSummary, RoleAssignmentOut, WhitelistEntry
from app.schemas.common import AppRole

UNIQUE_VIOLATION = "23505"


class DuplicateError(Exception):
    """A unique constraint rejected the write; `constraint` names which one."""

    def __init__(self, constraint: str) -> None:
        super().__init__(constraint)
        self.constraint = constraint


class AdminRepository(Protocol):
    async def user_has_role(self, user_id: UUID, role: AppRole) -> bool: ...
    async def outlet_exists(self, outlet_id: UUID) -> bool: ...
    async def bhawan_exists(self, bhawan_id: UUID) -> bool: ...
    async def list_whitelist(self) -> list[WhitelistEntry]: ...
    async def add_whitelist(
        self, phone_e164: str, outlet_id: UUID, label: str | None, added_by: UUID
    ) -> WhitelistEntry: ...
    async def delete_whitelist(self, entry_id: UUID) -> bool: ...
    async def find_profile_by_email(self, email: str) -> ProfileSummary | None: ...
    async def list_role_assignments(self) -> list[RoleAssignmentOut]: ...
    async def get_role_assignment(self, assignment_id: UUID) -> RoleAssignmentOut | None: ...
    async def add_role_assignment(
        self, user_id: UUID, role: AppRole, bhawan_id: UUID | None, assigned_by: UUID
    ) -> RoleAssignmentOut: ...
    async def delete_role_assignment(self, assignment_id: UUID) -> bool: ...


_WHITELIST_COLUMNS = "id, phone_e164, outlet_id, label, active, created_at, outlets(name)"
_ROLE_COLUMNS = (
    "id, user_id, role, bhawan_id, created_at, "
    "profiles!role_assignments_user_id_fkey(email, full_name), bhawans(name)"
)


def _whitelist_entry(row: dict[str, Any]) -> WhitelistEntry:
    return WhitelistEntry(**row, outlet_name=(row.get("outlets") or {}).get("name"))


def _role_assignment(row: dict[str, Any]) -> RoleAssignmentOut:
    profile = row.get("profiles") or {}
    return RoleAssignmentOut(
        **row,
        email=profile.get("email"),
        full_name=profile.get("full_name"),
        bhawan_name=(row.get("bhawans") or {}).get("name"),
    )


def _raise_duplicate(exc: APIError) -> None:
    if exc.code == UNIQUE_VIOLATION:
        raise DuplicateError(exc.message or "") from exc


class SupabaseAdminRepository:
    """Admin data access through the service-role client (RLS bypassed — callers are admins)."""

    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    async def user_has_role(self, user_id: UUID, role: AppRole) -> bool:
        res = await (
            self._db.table("role_assignments")
            .select("id")
            .eq("user_id", str(user_id))
            .eq("role", role.value)
            .limit(1)
            .execute()
        )
        return bool(res.data)

    async def outlet_exists(self, outlet_id: UUID) -> bool:
        res = await self._db.table("outlets").select("id").eq("id", str(outlet_id)).execute()
        return bool(res.data)

    async def bhawan_exists(self, bhawan_id: UUID) -> bool:
        res = await self._db.table("bhawans").select("id").eq("id", str(bhawan_id)).execute()
        return bool(res.data)

    async def list_whitelist(self) -> list[WhitelistEntry]:
        res = await (
            self._db.table("whitelisted_vendors")
            .select(_WHITELIST_COLUMNS)
            .order("phone_e164")
            .order("created_at")
            .execute()
        )
        return [_whitelist_entry(row) for row in res.data]

    async def add_whitelist(
        self, phone_e164: str, outlet_id: UUID, label: str | None, added_by: UUID
    ) -> WhitelistEntry:
        try:
            res = await (
                self._db.table("whitelisted_vendors")
                .insert(
                    {
                        "phone_e164": phone_e164,
                        "outlet_id": str(outlet_id),
                        "label": label,
                        "added_by": str(added_by),
                    }
                )
                .execute()
            )
        except APIError as exc:
            _raise_duplicate(exc)
            raise
        row = await (
            self._db.table("whitelisted_vendors")
            .select(_WHITELIST_COLUMNS)
            .eq("id", res.data[0]["id"])
            .single()
            .execute()
        )
        return _whitelist_entry(row.data)

    async def delete_whitelist(self, entry_id: UUID) -> bool:
        res = await self._db.table("whitelisted_vendors").delete().eq("id", str(entry_id)).execute()
        return bool(res.data)

    async def find_profile_by_email(self, email: str) -> ProfileSummary | None:
        res = await (
            self._db.table("profiles")
            .select("id, email, full_name")
            .eq("email", email.lower())
            .limit(1)
            .execute()
        )
        return ProfileSummary(**res.data[0]) if res.data else None

    async def list_role_assignments(self) -> list[RoleAssignmentOut]:
        res = await (
            self._db.table("role_assignments")
            .select(_ROLE_COLUMNS)
            .order("role")
            .order("created_at")
            .execute()
        )
        return [_role_assignment(row) for row in res.data]

    async def get_role_assignment(self, assignment_id: UUID) -> RoleAssignmentOut | None:
        res = await (
            self._db.table("role_assignments")
            .select(_ROLE_COLUMNS)
            .eq("id", str(assignment_id))
            .execute()
        )
        return _role_assignment(res.data[0]) if res.data else None

    async def add_role_assignment(
        self, user_id: UUID, role: AppRole, bhawan_id: UUID | None, assigned_by: UUID
    ) -> RoleAssignmentOut:
        try:
            res = await (
                self._db.table("role_assignments")
                .insert(
                    {
                        "user_id": str(user_id),
                        "role": role.value,
                        "bhawan_id": str(bhawan_id) if bhawan_id else None,
                        "assigned_by": str(assigned_by),
                    }
                )
                .execute()
            )
        except APIError as exc:
            _raise_duplicate(exc)
            raise
        created = await self.get_role_assignment(UUID(res.data[0]["id"]))
        assert created is not None  # noqa: S101 — just inserted with the service role
        return created

    async def delete_role_assignment(self, assignment_id: UUID) -> bool:
        res = await (
            self._db.table("role_assignments").delete().eq("id", str(assignment_id)).execute()
        )
        return bool(res.data)


def get_admin_repository(
    client: Annotated[AsyncClient, Depends(get_supabase)],
) -> AdminRepository:
    return SupabaseAdminRepository(client)
