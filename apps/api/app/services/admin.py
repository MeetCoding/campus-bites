from uuid import UUID

from app.core.auth import CurrentUser
from app.core.errors import ApiError
from app.repositories.admin import AdminRepository, DuplicateError
from app.schemas.admin import (
    RoleAssignmentCreate,
    RoleAssignmentOut,
    WhitelistCreate,
    WhitelistEntry,
)
from app.schemas.common import AppRole

MESS_SECRETARY_CONSTRAINT = "role_assignments_one_mess_secy"


class AdminService:
    """Vendor whitelist and role management. Every call re-checks admin rights in the DB,
    so a revoked admin loses access immediately rather than when their JWT expires."""

    def __init__(self, repo: AdminRepository) -> None:
        self._repo = repo

    async def _ensure_admin(self, actor: CurrentUser) -> None:
        if not await self._repo.user_has_role(actor.id, AppRole.ADMIN):
            raise ApiError(403, "FORBIDDEN", "Admin access has been revoked.")

    # ─── Vendor whitelist ────────────────────────────────────────────────────
    async def list_whitelist(self, actor: CurrentUser) -> list[WhitelistEntry]:
        await self._ensure_admin(actor)
        return await self._repo.list_whitelist()

    async def add_whitelist(self, actor: CurrentUser, body: WhitelistCreate) -> WhitelistEntry:
        await self._ensure_admin(actor)
        if not await self._repo.outlet_exists(body.outlet_id):
            raise ApiError(404, "OUTLET_NOT_FOUND", "That outlet does not exist.")
        try:
            return await self._repo.add_whitelist(body.phone, body.outlet_id, body.label, actor.id)
        except DuplicateError as exc:
            raise ApiError(
                409, "WHITELIST_DUPLICATE", "This number is already linked to that outlet."
            ) from exc

    async def remove_whitelist(self, actor: CurrentUser, entry_id: UUID) -> None:
        await self._ensure_admin(actor)
        if not await self._repo.delete_whitelist(entry_id):
            raise ApiError(404, "WHITELIST_NOT_FOUND", "Whitelist entry not found.")

    # ─── Role assignments ────────────────────────────────────────────────────
    async def list_role_assignments(self, actor: CurrentUser) -> list[RoleAssignmentOut]:
        await self._ensure_admin(actor)
        return await self._repo.list_role_assignments()

    async def assign_role(
        self, actor: CurrentUser, body: RoleAssignmentCreate
    ) -> RoleAssignmentOut:
        await self._ensure_admin(actor)
        profile = await self._repo.find_profile_by_email(body.email)
        if profile is None:
            raise ApiError(
                404,
                "USER_NOT_FOUND",
                "No account with that email yet. Ask them to sign in to Campus Bites once.",
            )
        if body.bhawan_id is not None and not await self._repo.bhawan_exists(body.bhawan_id):
            raise ApiError(404, "BHAWAN_NOT_FOUND", "That Bhawan does not exist.")
        try:
            return await self._repo.add_role_assignment(
                profile.id, AppRole(body.role), body.bhawan_id, actor.id
            )
        except DuplicateError as exc:
            if MESS_SECRETARY_CONSTRAINT in exc.constraint:
                raise ApiError(
                    409,
                    "MESS_SECRETARY_EXISTS",
                    "This Bhawan already has a Mess Secretary. Remove them first.",
                ) from exc
            raise ApiError(409, "ROLE_DUPLICATE", "This user already has that role.") from exc

    async def revoke_role(self, actor: CurrentUser, assignment_id: UUID) -> None:
        await self._ensure_admin(actor)
        assignment = await self._repo.get_role_assignment(assignment_id)
        if assignment is None:
            raise ApiError(404, "ROLE_ASSIGNMENT_NOT_FOUND", "Role assignment not found.")
        if assignment.user_id == actor.id and assignment.role is AppRole.ADMIN:
            raise ApiError(
                409, "CANNOT_REMOVE_OWN_ADMIN", "Ask another admin to remove your admin role."
            )
        await self._repo.delete_role_assignment(assignment_id)
