from typing import Annotated, Protocol
from uuid import UUID

from fastapi import Depends
from supabase import AsyncClient

from app.core.supabase import get_supabase
from app.repositories.roles import SupabaseRoleChecks
from app.schemas.common import AppRole
from app.schemas.complaints import ComplaintOut, ComplaintRules, ComplaintStatus

_COLUMNS = (
    "id, created_by, outlet_id, bhawan_id, domain, assignee_role, category, title, status, "
    "opened_at, resolved_at, nudge_count, last_nudged_at, long_standing_at, escalated_at, "
    "created_at"
)


def _rows(data: object) -> list[ComplaintOut]:
    return [ComplaintOut(**row) for row in data] if isinstance(data, list) else []


class ComplaintRepository(Protocol):
    async def get(self, complaint_id: UUID) -> ComplaintOut | None: ...
    async def get_rules(self) -> ComplaintRules: ...
    async def has_bhawan_role(self, user_id: UUID, role: AppRole, bhawan_id: UUID) -> bool: ...
    async def has_role(self, user_id: UUID, role: AppRole) -> bool: ...
    async def users_with_role(self, role: AppRole, bhawan_id: UUID | None) -> list[UUID]: ...
    async def transition(
        self,
        complaint_id: UUID,
        from_status: ComplaintStatus,
        to_status: ComplaintStatus,
        actor_id: UUID,
        actor_role: str,
        message: str | None,
        attachment_path: str | None,
    ) -> ComplaintOut | None: ...
    async def nudge(self, complaint_id: UUID, student_id: UUID) -> ComplaintOut | None: ...
    async def escalate_due(self) -> list[ComplaintOut]: ...


class SupabaseComplaintRepository(SupabaseRoleChecks):
    """Writes go through service-role-only RPCs (migration 011) so each change and its audit
    event commit together and every precondition is checked in the same UPDATE."""

    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    async def get(self, complaint_id: UUID) -> ComplaintOut | None:
        res = await (
            self._db.table("complaints").select(_COLUMNS).eq("id", str(complaint_id)).execute()
        )
        return ComplaintOut(**res.data[0]) if res.data else None

    async def get_rules(self) -> ComplaintRules:
        res = await (
            self._db.table("app_settings")
            .select("long_standing_after_hours, nudge_eligible_after_hours, nudge_cooldown_hours")
            .limit(1)
            .execute()
        )
        return ComplaintRules(**res.data[0])

    async def transition(
        self,
        complaint_id: UUID,
        from_status: ComplaintStatus,
        to_status: ComplaintStatus,
        actor_id: UUID,
        actor_role: str,
        message: str | None,
        attachment_path: str | None,
    ) -> ComplaintOut | None:
        res = await self._db.rpc(
            "complaint_transition",
            {
                "p_complaint": str(complaint_id),
                "p_from": from_status.value,
                "p_to": to_status.value,
                "p_actor": str(actor_id),
                "p_actor_role": actor_role,
                "p_message": message,
                "p_attachment": attachment_path,
            },
        ).execute()
        rows = _rows(res.data)
        return rows[0] if rows else None

    async def nudge(self, complaint_id: UUID, student_id: UUID) -> ComplaintOut | None:
        res = await self._db.rpc(
            "complaint_nudge", {"p_complaint": str(complaint_id), "p_student": str(student_id)}
        ).execute()
        rows = _rows(res.data)
        return rows[0] if rows else None

    async def escalate_due(self) -> list[ComplaintOut]:
        res = await self._db.rpc("complaint_escalate_due", {}).execute()
        return _rows(res.data)


def get_complaint_repository(
    client: Annotated[AsyncClient, Depends(get_supabase)],
) -> ComplaintRepository:
    return SupabaseComplaintRepository(client)
