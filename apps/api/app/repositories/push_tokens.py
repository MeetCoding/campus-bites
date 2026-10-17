from typing import Annotated, Protocol
from uuid import UUID

from fastapi import Depends
from supabase import AsyncClient

from app.core.supabase import get_supabase


class PushTokenRepository(Protocol):
    async def tokens_for_bhawan_residents(self, bhawan_id: UUID) -> list[str]: ...
    async def tokens_for_users(self, user_ids: list[UUID]) -> list[str]: ...
    async def delete_tokens(self, tokens: set[str]) -> None: ...


class SupabasePushTokenRepository:
    def __init__(self, client: AsyncClient) -> None:
        self._db = client

    async def tokens_for_bhawan_residents(self, bhawan_id: UUID) -> list[str]:
        res = await (
            self._db.table("push_tokens")
            .select("expo_token, profiles!inner(bhawan_id)")
            .eq("profiles.bhawan_id", str(bhawan_id))
            .execute()
        )
        return [row["expo_token"] for row in res.data]

    async def tokens_for_users(self, user_ids: list[UUID]) -> list[str]:
        res = await (
            self._db.table("push_tokens")
            .select("expo_token")
            .in_("user_id", [str(u) for u in user_ids])
            .execute()
        )
        return [row["expo_token"] for row in res.data]

    async def delete_tokens(self, tokens: set[str]) -> None:
        if tokens:
            await self._db.table("push_tokens").delete().in_("expo_token", list(tokens)).execute()


def get_push_token_repository(
    client: Annotated[AsyncClient, Depends(get_supabase)],
) -> PushTokenRepository:
    return SupabasePushTokenRepository(client)
