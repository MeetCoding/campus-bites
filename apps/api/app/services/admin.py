import re
from uuid import UUID

from app.core.auth import CurrentUser
from app.core.errors import ApiError
from app.repositories.admin import (
    AdminRepository,
    DuplicateError,
    InUseError,
    PasscodeRejectedError,
)
from app.schemas.admin import (
    AdminCreate,
    AdminOut,
    BhawanCreate,
    BhawanOut,
    BhawanUpdate,
    EateryCreate,
    EateryOut,
    EateryUpdate,
    RoleAssignmentCreate,
    RoleAssignmentOut,
    VendorAccount,
    VendorPasscodeSet,
    WhitelistCreate,
    WhitelistEntry,
)
from app.schemas.common import AppRole

MESS_SECRETARY_CONSTRAINT = "role_assignments_one_mess_secy"


def slugify(name: str, *, drop_suffix: str | None = None) -> str:
    """ "Rajendra Bhawan" → "rajendra" (with drop_suffix="bhawan"); "Cafe Coffee Day" →
    "cafe-coffee-day". Matches the seed's slugs, which outlet slugs are built from."""
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    if drop_suffix and slug.endswith(f"-{drop_suffix}"):
        slug = slug.removesuffix(f"-{drop_suffix}")
    if not slug:
        raise ApiError(422, "INVALID_NAME", "The name needs at least one letter or digit.")
    return slug


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

    # ─── Campus master list ──────────────────────────────────────────────────
    async def create_bhawan(self, actor: CurrentUser, body: BhawanCreate) -> BhawanOut:
        await self._ensure_admin(actor)
        slug = slugify(body.name, drop_suffix="bhawan")
        try:
            return await self._repo.create_bhawan(body.name, slug, body.sort_order)
        except DuplicateError as exc:
            raise ApiError(
                409, "BHAWAN_DUPLICATE", "A Bhawan with this name already exists."
            ) from exc

    async def update_bhawan(
        self, actor: CurrentUser, bhawan_id: UUID, body: BhawanUpdate
    ) -> BhawanOut:
        await self._ensure_admin(actor)
        if body.name is None and body.sort_order is None:
            raise ApiError(422, "NOTHING_TO_UPDATE", "Change the name or the position.")
        try:
            bhawan = await self._repo.update_bhawan(bhawan_id, body.name, body.sort_order)
        except DuplicateError as exc:
            raise ApiError(
                409, "BHAWAN_DUPLICATE", "A Bhawan with this name already exists."
            ) from exc
        if bhawan is None:
            raise ApiError(404, "BHAWAN_NOT_FOUND", "That Bhawan does not exist.")
        return bhawan

    async def delete_bhawan(self, actor: CurrentUser, bhawan_id: UUID) -> None:
        await self._ensure_admin(actor)
        try:
            deleted = await self._repo.delete_bhawan(bhawan_id)
        except InUseError as exc:
            raise ApiError(
                409,
                "BHAWAN_IN_USE",
                "Students live in this Bhawan or it has rebate / complaint history, "
                "so it can't be removed.",
            ) from exc
        if not deleted:
            raise ApiError(404, "BHAWAN_NOT_FOUND", "That Bhawan does not exist.")

    async def create_eatery(self, actor: CurrentUser, body: EateryCreate) -> EateryOut:
        await self._ensure_admin(actor)
        try:
            return await self._repo.create_eatery(
                body.name, slugify(body.name), body.location_tag, body.latitude, body.longitude
            )
        except DuplicateError as exc:
            raise ApiError(
                409, "EATERY_DUPLICATE", "An outlet with this name already exists."
            ) from exc

    async def update_eatery(
        self, actor: CurrentUser, eatery_id: UUID, body: EateryUpdate
    ) -> EateryOut:
        await self._ensure_admin(actor)
        # Only the fields the admin sent: an explicit null clears the location tag or the pin.
        changes = body.model_dump(include=body.model_fields_set)
        if changes.get("name", "") is None:
            del changes["name"]
        if not changes:
            raise ApiError(422, "NOTHING_TO_UPDATE", "Change the name or the location.")
        eatery = await self._repo.update_eatery(eatery_id, changes)
        if eatery is None:
            raise ApiError(404, "EATERY_NOT_FOUND", "That eatery does not exist.")
        return eatery

    async def delete_eatery(self, actor: CurrentUser, eatery_id: UUID) -> None:
        await self._ensure_admin(actor)
        try:
            deleted = await self._repo.delete_eatery(eatery_id)
        except InUseError as exc:
            raise ApiError(
                409,
                "EATERY_IN_USE",
                "This eatery has complaint history, so it can't be removed.",
            ) from exc
        if not deleted:
            raise ApiError(404, "EATERY_NOT_FOUND", "That eatery does not exist.")

    # ─── Admins (web console) ────────────────────────────────────────────────
    async def list_admins(self, actor: CurrentUser) -> list[AdminOut]:
        await self._ensure_admin(actor)
        return await self._repo.list_admins()

    async def add_admin(self, actor: CurrentUser, body: AdminCreate) -> AdminOut:
        """Admin right away if they have signed in before; otherwise an invite that
        handle_new_user redeems at their first Google sign-in."""
        await self._ensure_admin(actor)
        profile = await self._repo.find_profile_by_email(body.email)
        try:
            if profile is None:
                return await self._repo.add_admin_invite(body.email, actor.id)
            assignment = await self._repo.add_role_assignment(
                profile.id, AppRole.ADMIN, None, actor.id
            )
        except DuplicateError as exc:
            raise ApiError(409, "ADMIN_DUPLICATE", "This email is already an admin.") from exc
        return AdminOut(
            email=body.email,
            full_name=profile.full_name,
            status="active",
            is_owner=body.email == await self._repo.owner_admin_email(),
            created_at=assignment.created_at,
        )

    async def remove_admin(self, actor: CurrentUser, email: str) -> None:
        await self._ensure_admin(actor)
        email = email.strip().lower()
        if email == await self._repo.owner_admin_email():
            raise ApiError(409, "OWNER_ADMIN", "The owner's admin access can't be removed.")
        profile = await self._repo.find_profile_by_email(email)
        if profile is not None and profile.id == actor.id:
            raise ApiError(
                409, "CANNOT_REMOVE_OWN_ADMIN", "Ask another admin to remove your admin role."
            )
        removed = await self._repo.delete_admin_invite(email)
        if profile is not None:
            removed = await self._repo.delete_user_role(profile.id, AppRole.ADMIN) or removed
        if not removed:
            raise ApiError(404, "ADMIN_NOT_FOUND", "That email isn't an admin.")

    # ─── Vendor passcodes ────────────────────────────────────────────────────
    async def list_vendor_accounts(self, actor: CurrentUser) -> list[VendorAccount]:
        await self._ensure_admin(actor)
        return [account for account, _ in await self._repo.list_vendor_accounts()]

    async def set_vendor_passcode(
        self, actor: CurrentUser, body: VendorPasscodeSet
    ) -> VendorAccount:
        """Vendors sign in with phone + passcode (a Supabase password). Only whitelisted
        phones get an account, so the passcode alone never grants access to an outlet."""
        await self._ensure_admin(actor)
        accounts = {a.phone_e164: user_id for a, user_id in await self._repo.list_vendor_accounts()}
        if body.phone not in accounts:
            raise ApiError(
                404,
                "VENDOR_NOT_WHITELISTED",
                "Assign this number to an outlet before setting its passcode.",
            )
        try:
            return await self._repo.set_vendor_passcode(
                body.phone, accounts[body.phone], body.passcode
            )
        except PasscodeRejectedError as exc:
            raise ApiError(422, "PASSCODE_REJECTED", f"Supabase refused it: {exc}") from exc
