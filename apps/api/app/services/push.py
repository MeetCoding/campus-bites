import logging
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from typing import Any, Literal

import httpx
from pydantic import BaseModel, ConfigDict

logger = logging.getLogger(__name__)

EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send"
EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts"
SEND_BATCH_SIZE = 100  # Expo limit per request
RECEIPT_BATCH_SIZE = 1000  # Expo limit per request
DEVICE_NOT_REGISTERED = "DeviceNotRegistered"


class PushMessage(BaseModel):
    """One Expo push message (https://docs.expo.dev/push-notifications/sending-notifications/)."""

    model_config = ConfigDict(populate_by_name=True)

    to: str
    title: str
    body: str
    data: dict[str, Any] = {}
    priority: Literal["default", "normal", "high"] = "default"
    channel_id: str | None = None
    sound: Literal["default"] | None = "default"

    def to_expo(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "to": self.to,
            "title": self.title,
            "body": self.body,
            "data": self.data,
            "priority": self.priority,
            "sound": self.sound,
        }
        if self.channel_id:
            payload["channelId"] = self.channel_id
        return payload


@dataclass
class PushReport:
    sent: int = 0
    failed: int = 0
    # Expo ticket id → device token, for a later receipt check (DeviceNotRegistered can also
    # arrive only in receipts).
    tickets: dict[str, str] = field(default_factory=dict)
    invalid_tokens: set[str] = field(default_factory=set)


class PushService:
    """Thin Expo Push client: batching, ticket parsing, receipt checks. Never raises on
    delivery problems — a failed notification must not fail the request that triggered it."""

    def __init__(self, http: httpx.AsyncClient, access_token: str | None = None) -> None:
        self._http = http
        self._headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if access_token:
            self._headers["Authorization"] = f"Bearer {access_token}"

    async def send(self, messages: Sequence[PushMessage]) -> PushReport:
        report = PushReport()
        for start in range(0, len(messages), SEND_BATCH_SIZE):
            batch = messages[start : start + SEND_BATCH_SIZE]
            try:
                response = await self._http.post(
                    EXPO_SEND_URL, json=[m.to_expo() for m in batch], headers=self._headers
                )
                response.raise_for_status()
                tickets = response.json().get("data", [])
            except (httpx.HTTPError, ValueError) as exc:
                logger.warning("Expo push batch failed: %s", exc)
                report.failed += len(batch)
                continue

            for message, ticket in zip(batch, tickets, strict=False):
                if ticket.get("status") == "ok":
                    report.sent += 1
                    if ticket.get("id"):
                        report.tickets[ticket["id"]] = message.to
                else:
                    report.failed += 1
                    if (ticket.get("details") or {}).get("error") == DEVICE_NOT_REGISTERED:
                        report.invalid_tokens.add(message.to)
        return report

    async def invalid_tokens_from_receipts(self, tickets: dict[str, str]) -> set[str]:
        """Check receipts (call ≥15 min after sending) and return tokens to prune."""
        invalid: set[str] = set()
        ids = list(tickets)
        for start in range(0, len(ids), RECEIPT_BATCH_SIZE):
            chunk = ids[start : start + RECEIPT_BATCH_SIZE]
            try:
                response = await self._http.post(
                    EXPO_RECEIPTS_URL, json={"ids": chunk}, headers=self._headers
                )
                response.raise_for_status()
                receipts: dict[str, Any] = response.json().get("data", {})
            except (httpx.HTTPError, ValueError) as exc:
                logger.warning("Expo receipt check failed: %s", exc)
                continue
            for ticket_id, receipt in receipts.items():
                details = receipt.get("details") or {}
                if (
                    receipt.get("status") == "error"
                    and details.get("error") == DEVICE_NOT_REGISTERED
                ):
                    invalid.add(tickets[ticket_id])
        return invalid


def unique_tokens(tokens: Iterable[str]) -> list[str]:
    return list(dict.fromkeys(tokens))
