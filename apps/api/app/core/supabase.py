import asyncio

from fastapi import Request
from supabase import AsyncClient, acreate_client

from app.core.config import Settings

_lock = asyncio.Lock()


async def get_supabase(request: Request) -> AsyncClient:
    """Service-role client (bypasses RLS). Created lazily once per app instance.

    Only FastAPI may hold this key; every caller must be authorised before using it.
    """
    client: AsyncClient | None = getattr(request.app.state, "supabase", None)
    if client is None:
        async with _lock:
            client = getattr(request.app.state, "supabase", None)
            if client is None:
                settings: Settings = request.app.state.settings
                client = await acreate_client(
                    str(settings.supabase_url).rstrip("/"),
                    settings.supabase_secret_key.get_secret_value(),
                )
                request.app.state.supabase = client
    return client
