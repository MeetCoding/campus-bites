from datetime import UTC, date, datetime
from typing import Annotated, Protocol
from uuid import UUID

from fastapi import Depends
from postgrest.exceptions import APIError
from supabase import AsyncClient

from app.core.supabase import get_supabase
from app.repositories.roles import SupabaseRoleChecks
from app.schemas.common import AppRole
from app.schemas.rebates import RebateOut, RebateRules, RebateStatus, StudentProfile

EXCLUSION_VIOLATION = "23P01"  # rebate_applications_no_overlap

_COLUMNS = (
    "id, student_id, bhawan_id, start_date, end_date, days, reason, document_path, status, "
    "authority_remarks, reviewed_by, reviewed_at, created_at"
)


class RebateOverlapError(Exception):
    """The exclusion constraint caught an overlap the pre-check missed (concurrent submit)."""


class RebateRepository(Protocol):
    async def get_rules(self) -> RebateRules: ...
    async def get_profile(self, user_id: UUID) -> StudentProfile | None: ...
    async def has_overlap(self, student_id: UUID, start: date, end: date) -> bool: ...
    async def create(
        self,
        profile: StudentProfile,
        bhawan_id: UUID,
        start: date,
        end: date,
        reason: str,
        document_path: str | None,
    ) -> RebateOut: ...
    async def get(self, rebate_id: UUID) -> RebateOut | None: ...
    async def has_bhawan_role(self, user_id: UUID, role: AppRole, bhawan_id: UUID) -> bool: ...
    async def transition(
        self,
        rebate_id: UUID,
        from_status: RebateStatus,
        to_status: RebateStatus,
        actor_id: UUID,
        remarks: str | None,
    ) -> RebateOut | None: ...


class SupabaseRebateRepository(SupabaseRoleChecks):
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    async def get_rules(self) -> RebateRules:
        res = await (
            self._db.table("app_settings")
            .select("min_rebate_days, rebate_backdate_days")
            .limit(1)
            .execute()
        )
        return RebateRules(**res.data[0])

    async def get_profile(self, user_id: UUID) -> StudentProfile | None:
        res = await (
            self._db.table("profiles")
            .select("id, bhawan_id, full_name, email")
            .eq("id", str(user_id))
            .execute()
        )
        return StudentProfile(**res.data[0]) if res.data else None

    async def has_overlap(self, student_id: UUID, start: date, end: date) -> bool:
        res = await (
            self._db.table("rebate_applications")
            .select("id")
            .eq("student_id", str(student_id))
            .neq("status", RebateStatus.REJECTED.value)
            .lte("start_date", end.isoformat())
            .gte("end_date", start.isoformat())
            .limit(1)
            .execute()
        )
        return bool(res.data)

    async def create(
        self,
        profile: StudentProfile,
        bhawan_id: UUID,
        start: date,
        end: date,
        reason: str,
        document_path: str | None,
    ) -> RebateOut:
        row = {
            "student_id": str(profile.id),
            "bhawan_id": str(bhawan_id),
            "student_name": profile.full_name,
            "student_email": profile.email,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "reason": reason,
            "document_path": document_path,
        }
        try:
            res = await self._db.table("rebate_applications").insert(row).execute()
        except APIError as exc:
            if exc.code == EXCLUSION_VIOLATION:
                raise RebateOverlapError from exc
            raise
        created = await self.get(UUID(res.data[0]["id"]))
        assert created is not None  # noqa: S101 — just inserted with the service role
        return created

    async def get(self, rebate_id: UUID) -> RebateOut | None:
        res = await (
            self._db.table("rebate_applications")
            .select(_COLUMNS)
            .eq("id", str(rebate_id))
            .execute()
        )
        return RebateOut(**res.data[0]) if res.data else None

    async def transition(
        self,
        rebate_id: UUID,
        from_status: RebateStatus,
        to_status: RebateStatus,
        actor_id: UUID,
        remarks: str | None,
    ) -> RebateOut | None:
        # Conditional update: only applies if nobody else moved the application meanwhile.
        # The rebate_events row is written by a trigger in the same statement.
        res = await (
            self._db.table("rebate_applications")
            .update(
                {
                    "status": to_status.value,
                    "reviewed_by": str(actor_id),
                    "reviewed_at": datetime.now(UTC).isoformat(),
                    "authority_remarks": remarks,
                }
            )
            .eq("id", str(rebate_id))
            .eq("status", from_status.value)
            .execute()
        )
        if not res.data:
            return None
        return await self.get(rebate_id)


def get_rebate_repository(
    client: Annotated[AsyncClient, Depends(get_supabase)],
) -> RebateRepository:
    return SupabaseRebateRepository(client)
