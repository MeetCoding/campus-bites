from datetime import UTC, datetime
from typing import Annotated, Any, Protocol
from uuid import UUID

from fastapi import Depends
from postgrest.exceptions import APIError
from supabase import AsyncClient
from supabase_auth.errors import AuthApiError, AuthWeakPasswordError

from app.core.supabase import get_supabase
from app.schemas.admin import (
    AdminOut,
    BhawanOut,
    EateryOut,
    ProfileSummary,
    RoleAssignmentOut,
    VendorAccount,
    WhitelistEntry,
)
from app.schemas.common import AppRole

UNIQUE_VIOLATION = "23505"
FOREIGN_KEY_VIOLATION = "23503"


class DuplicateError(Exception):
    """A unique constraint rejected the write; `constraint` names which one."""

    def __init__(self, constraint: str) -> None:
        super().__init__(constraint)
        self.constraint = constraint


class InUseError(Exception):
    """A foreign key (or the Bhawan residents check) refused a delete: the row has history."""


class PasscodeRejectedError(Exception):
    """Supabase Auth refused the passcode (its password policy); the message says why."""


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
    async def create_bhawan(self, name: str, slug: str, sort_order: int | None) -> BhawanOut: ...
    async def update_bhawan(
        self, bhawan_id: UUID, name: str | None, sort_order: int | None
    ) -> BhawanOut | None: ...
    async def delete_bhawan(self, bhawan_id: UUID) -> bool: ...
    async def create_eatery(
        self,
        name: str,
        slug: str,
        location_tag: str | None,
        latitude: float | None = None,
        longitude: float | None = None,
        contact_phone: str | None = None,
    ) -> EateryOut: ...
    async def update_eatery(self, eatery_id: UUID, changes: dict[str, Any]) -> EateryOut | None: ...
    async def delete_eatery(self, eatery_id: UUID) -> bool: ...
    async def owner_admin_email(self) -> str | None: ...
    async def list_admins(self) -> list[AdminOut]: ...
    async def add_admin_invite(self, email: str, invited_by: UUID) -> AdminOut: ...
    async def delete_admin_invite(self, email: str) -> bool: ...
    async def delete_user_role(self, user_id: UUID, role: AppRole) -> bool: ...
    async def list_vendor_accounts(self) -> list[tuple[VendorAccount, UUID | None]]: ...
    async def set_vendor_passcode(
        self, phone_e164: str, user_id: UUID | None, passcode: str
    ) -> VendorAccount: ...
    async def get_whitelist_entry(self, entry_id: UUID) -> WhitelistEntry | None: ...
    async def is_master_vendor(self, phone_e164: str) -> bool: ...
    async def make_master_vendor(
        self, phone_e164: str, label: str | None, added_by: UUID
    ) -> int: ...
    async def remove_master_vendor(self, phone_e164: str) -> bool: ...
    async def delete_vendor(self, phone_e164: str) -> tuple[int, UUID | None]: ...
    async def delete_auth_user(self, user_id: UUID) -> None: ...


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


def _raise_in_use(exc: APIError) -> None:
    if exc.code == FOREIGN_KEY_VIOLATION:
        raise InUseError(exc.message or "") from exc


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

    # ─── Campus master list ──────────────────────────────────────────────────
    async def create_bhawan(self, name: str, slug: str, sort_order: int | None) -> BhawanOut:
        try:
            res = await self._db.rpc(
                "admin_create_bhawan",
                {"p_name": name, "p_slug": slug, "p_sort_order": sort_order},
            ).execute()
        except APIError as exc:
            _raise_duplicate(exc)
            raise
        return BhawanOut(**res.data[0])

    async def update_bhawan(
        self, bhawan_id: UUID, name: str | None, sort_order: int | None
    ) -> BhawanOut | None:
        try:
            res = await self._db.rpc(
                "admin_update_bhawan",
                {"p_id": str(bhawan_id), "p_name": name, "p_sort_order": sort_order},
            ).execute()
        except APIError as exc:
            _raise_duplicate(exc)
            raise
        return BhawanOut(**res.data[0]) if res.data else None

    async def delete_bhawan(self, bhawan_id: UUID) -> bool:
        try:
            res = await self._db.rpc("admin_delete_bhawan", {"p_id": str(bhawan_id)}).execute()
        except APIError as exc:
            _raise_in_use(exc)
            raise
        return bool(res.data)

    async def create_eatery(
        self,
        name: str,
        slug: str,
        location_tag: str | None,
        latitude: float | None = None,
        longitude: float | None = None,
        contact_phone: str | None = None,
    ) -> EateryOut:
        try:
            res = await (
                self._db.table("outlets")
                .insert(
                    {
                        "type": "eatery",
                        "name": name,
                        "slug": slug,
                        "location_tag": location_tag,
                        "latitude": latitude,
                        "longitude": longitude,
                        "contact_phone": contact_phone,
                    }
                )
                .execute()
            )
        except APIError as exc:
            _raise_duplicate(exc)
            raise
        return EateryOut(**res.data[0])

    async def update_eatery(self, eatery_id: UUID, changes: dict[str, Any]) -> EateryOut | None:
        res = await (
            self._db.table("outlets")
            .update(changes)
            .eq("id", str(eatery_id))
            .eq("type", "eatery")
            .execute()
        )
        return EateryOut(**res.data[0]) if res.data else None

    async def delete_eatery(self, eatery_id: UUID) -> bool:
        try:
            res = await (
                self._db.table("outlets")
                .delete()
                .eq("id", str(eatery_id))
                .eq("type", "eatery")
                .execute()
            )
        except APIError as exc:
            _raise_in_use(exc)
            raise
        return bool(res.data)

    # ─── Admins ──────────────────────────────────────────────────────────────
    async def owner_admin_email(self) -> str | None:
        res = await self._db.table("app_settings").select("owner_admin_email").single().execute()
        return res.data["owner_admin_email"]

    async def list_admins(self) -> list[AdminOut]:
        owner = await self.owner_admin_email()
        active = await (
            self._db.table("role_assignments")
            .select("created_at, profiles!role_assignments_user_id_fkey(email, full_name)")
            .eq("role", AppRole.ADMIN.value)
            .order("created_at")
            .execute()
        )
        invites = await (
            self._db.table("admin_invites")
            .select("email, created_at")
            .order("created_at")
            .execute()
        )
        admins = [
            AdminOut(
                email=row["profiles"]["email"],
                full_name=row["profiles"]["full_name"],
                status="active",
                is_owner=row["profiles"]["email"] == owner,
                created_at=row["created_at"],
            )
            for row in active.data
            if (row.get("profiles") or {}).get("email")
        ]
        admins += [
            AdminOut(**row, status="invited", is_owner=row["email"] == owner)
            for row in invites.data
        ]
        return admins

    async def add_admin_invite(self, email: str, invited_by: UUID) -> AdminOut:
        try:
            res = await (
                self._db.table("admin_invites")
                .insert({"email": email, "invited_by": str(invited_by)})
                .execute()
            )
        except APIError as exc:
            _raise_duplicate(exc)
            raise
        return AdminOut(**res.data[0], status="invited")

    async def delete_admin_invite(self, email: str) -> bool:
        res = await self._db.table("admin_invites").delete().eq("email", email).execute()
        return bool(res.data)

    async def delete_user_role(self, user_id: UUID, role: AppRole) -> bool:
        res = await (
            self._db.table("role_assignments")
            .delete()
            .eq("user_id", str(user_id))
            .eq("role", role.value)
            .execute()
        )
        return bool(res.data)

    # ─── Vendor sign-in accounts ─────────────────────────────────────────────
    async def list_vendor_accounts(self) -> list[tuple[VendorAccount, UUID | None]]:
        res = await self._db.rpc("admin_vendor_accounts").execute()
        return [
            (
                VendorAccount(**row, has_account=row["user_id"] is not None),
                UUID(row["user_id"]) if row["user_id"] else None,
            )
            for row in res.data
        ]

    async def set_vendor_passcode(
        self, phone_e164: str, user_id: UUID | None, passcode: str
    ) -> VendorAccount:
        set_at = datetime.now(UTC)
        app_metadata = {"passcode_set_at": set_at.isoformat()}
        try:
            if user_id is None:
                res = await self._db.auth.admin.create_user(
                    {
                        "phone": phone_e164,
                        "password": passcode,
                        "phone_confirm": True,
                        "app_metadata": app_metadata,
                    }
                )
            else:
                # GoTrue merges app_metadata keys, so the provider fields are kept.
                res = await self._db.auth.admin.update_user_by_id(
                    str(user_id), {"password": passcode, "app_metadata": app_metadata}
                )
        except AuthWeakPasswordError as exc:
            raise PasscodeRejectedError(exc.message) from exc
        except AuthApiError as exc:
            if exc.code == "weak_password":
                raise PasscodeRejectedError(exc.message) from exc
            raise
        last_sign_in = res.user.last_sign_in_at
        return VendorAccount(
            phone_e164=phone_e164,
            has_account=True,
            passcode_set_at=set_at,
            last_sign_in_at=last_sign_in,
        )

    # ─── Master vendors / deleting vendors ───────────────────────────────────
    async def get_whitelist_entry(self, entry_id: UUID) -> WhitelistEntry | None:
        res = await (
            self._db.table("whitelisted_vendors")
            .select(_WHITELIST_COLUMNS)
            .eq("id", str(entry_id))
            .execute()
        )
        return _whitelist_entry(res.data[0]) if res.data else None

    async def is_master_vendor(self, phone_e164: str) -> bool:
        res = await (
            self._db.table("master_vendors")
            .select("phone_e164")
            .eq("phone_e164", phone_e164)
            .execute()
        )
        return bool(res.data)

    async def make_master_vendor(self, phone_e164: str, label: str | None, added_by: UUID) -> int:
        res = await self._db.rpc(
            "admin_make_master_vendor",
            {"p_phone": phone_e164, "p_label": label, "p_added_by": str(added_by)},
        ).execute()
        return int(res.data)

    async def remove_master_vendor(self, phone_e164: str) -> bool:
        res = await self._db.table("master_vendors").delete().eq("phone_e164", phone_e164).execute()
        return bool(res.data)

    async def delete_vendor(self, phone_e164: str) -> tuple[int, UUID | None]:
        res = await self._db.rpc("admin_delete_vendor", {"p_phone": phone_e164}).execute()
        row = res.data[0]
        return row["removed_links"], UUID(row["user_id"]) if row["user_id"] else None

    async def delete_auth_user(self, user_id: UUID) -> None:
        # Profiles cascade; history rows keep a null actor (every FK is cascade / set null).
        await self._db.auth.admin.delete_user(str(user_id))


def get_admin_repository(
    client: Annotated[AsyncClient, Depends(get_supabase)],
) -> AdminRepository:
    return SupabaseAdminRepository(client)
