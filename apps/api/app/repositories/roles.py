from uuid import UUID

from supabase import AsyncClient

from app.schemas.common import AppRole


class SupabaseRoleChecks:
    """Live (not JWT) scope checks shared by every service-role repository.

    Same rules as the SQL helpers app.has_bhawan_role() / app.can_manage_outlet(), so a removed
    secretary, authority or vendor loses access immediately rather than at token expiry.
    """

    _db: AsyncClient

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

    async def has_role(self, user_id: UUID, role: AppRole) -> bool:
        """Campus-wide roles (adosw, admin): any assignment of that role."""
        res = await (
            self._db.table("role_assignments")
            .select("id")
            .eq("user_id", str(user_id))
            .eq("role", role.value)
            .limit(1)
            .execute()
        )
        return bool(res.data)

    async def users_with_role(self, role: AppRole, bhawan_id: UUID | None) -> list[UUID]:
        """Who to notify: holders of `role` for a Bhawan, or campus-wide when bhawan_id is None."""
        query = self._db.table("role_assignments").select("user_id").eq("role", role.value)
        query = (
            query.is_("bhawan_id", "null")
            if bhawan_id is None
            else query.eq("bhawan_id", str(bhawan_id))
        )
        res = await query.execute()
        return [UUID(row["user_id"]) for row in res.data]

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
