import logging
from typing import Annotated, Any, Literal
from uuid import UUID

import httpx
from fastapi import Depends, Request

from app.core.config import Settings
from app.repositories.push_tokens import PushTokenRepository, get_push_token_repository
from app.services.push import PushMessage, PushReport, PushService, unique_tokens

logger = logging.getLogger(__name__)

# Android notification channels the app creates (apps/mobile/src/features/notifications).
Channel = Literal["mess-updates", "nudges"]


class Notifier:
    """Resolves audiences to device tokens, sends, and prunes dead tokens."""

    def __init__(self, tokens: PushTokenRepository, push: PushService) -> None:
        self._tokens = tokens
        self._push = push

    async def notify_bhawan_residents(
        self,
        bhawan_id: UUID,
        *,
        title: str,
        body: str,
        data: dict[str, Any],
        channel: Channel = "mess-updates",
    ) -> PushReport:
        tokens = await self._tokens.tokens_for_bhawan_residents(bhawan_id)
        report = await self._send(tokens, title, body, data, channel)
        logger.info(
            "Notified bhawan %s: %d sent, %d failed, %d pruned",
            bhawan_id,
            report.sent,
            report.failed,
            len(report.invalid_tokens),
        )
        return report

    async def notify_user(
        self,
        user_id: UUID,
        *,
        title: str,
        body: str,
        data: dict[str, Any],
        channel: Channel = "mess-updates",
    ) -> PushReport:
        """Every device the user is signed in on (e.g. their rebate decision)."""
        tokens = await self._tokens.tokens_for_user(user_id)
        return await self._send(tokens, title, body, data, channel)

    async def _send(
        self, tokens: list[str], title: str, body: str, data: dict[str, Any], channel: Channel
    ) -> PushReport:
        messages = [
            PushMessage(to=token, title=title, body=body, data=data, channel_id=channel)
            for token in unique_tokens(tokens)
        ]
        report = await self._push.send(messages)
        if report.invalid_tokens:
            await self._tokens.delete_tokens(report.invalid_tokens)
        return report


def get_push_service(request: Request) -> PushService:
    """One pooled HTTP client per app instance for Expo Push."""
    service: PushService | None = getattr(request.app.state, "push_service", None)
    if service is None:
        settings: Settings = request.app.state.settings
        token = (
            settings.expo_access_token.get_secret_value() if settings.expo_access_token else None
        )
        service = PushService(httpx.AsyncClient(timeout=15.0), token)
        request.app.state.push_service = service
    return service


def get_notifier(
    tokens: Annotated[PushTokenRepository, Depends(get_push_token_repository)],
    push: Annotated[PushService, Depends(get_push_service)],
) -> Notifier:
    return Notifier(tokens, push)
