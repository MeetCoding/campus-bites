import json
import uuid

import httpx
import pytest

from app.services.notifications import Notifier
from app.services.push import EXPO_RECEIPTS_URL, EXPO_SEND_URL, PushMessage, PushService


def token(n: int) -> str:
    return f"ExponentPushToken[{n}]"


def make_service(handler: httpx.MockTransport, access_token: str | None = None) -> PushService:
    return PushService(httpx.AsyncClient(transport=handler), access_token)


async def test_batches_of_100_and_parses_tickets() -> None:
    batches: list[list[dict[str, object]]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == EXPO_SEND_URL
        body = json.loads(request.content)
        batches.append(body)
        tickets = []
        for message in body:
            if message["to"] == token(5):
                tickets.append(
                    {"status": "error", "details": {"error": "DeviceNotRegistered"}, "message": "x"}
                )
            elif message["to"] == token(6):
                tickets.append({"status": "error", "details": {"error": "MessageRateExceeded"}})
            else:
                tickets.append({"status": "ok", "id": f"ticket-{message['to']}"})
        return httpx.Response(200, json={"data": tickets})

    service = make_service(httpx.MockTransport(handler))
    messages = [PushMessage(to=token(i), title="t", body="b") for i in range(250)]

    report = await service.send(messages)

    assert [len(b) for b in batches] == [100, 100, 50]
    assert report.sent == 248
    assert report.failed == 2
    assert report.invalid_tokens == {token(5)}
    assert report.tickets[f"ticket-{token(0)}"] == token(0)


async def test_channel_priority_and_auth_header_are_sent() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["auth"] = request.headers.get("authorization")
        seen["message"] = json.loads(request.content)[0]
        return httpx.Response(200, json={"data": [{"status": "ok", "id": "t1"}]})

    service = make_service(httpx.MockTransport(handler), access_token="expo-secret")
    await service.send(
        [PushMessage(to=token(1), title="t", body="b", priority="high", channel_id="nudges")]
    )

    assert seen["auth"] == "Bearer expo-secret"
    message = seen["message"]
    assert isinstance(message, dict)
    assert message["channelId"] == "nudges"
    assert message["priority"] == "high"


async def test_http_failure_is_reported_not_raised() -> None:
    service = make_service(httpx.MockTransport(lambda _r: httpx.Response(503)))

    report = await service.send([PushMessage(to=token(1), title="t", body="b")])

    assert report.sent == 0
    assert report.failed == 1


async def test_receipts_flag_unregistered_devices() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == EXPO_RECEIPTS_URL
        assert json.loads(request.content) == {"ids": ["a", "b"]}
        return httpx.Response(
            200,
            json={
                "data": {
                    "a": {"status": "ok"},
                    "b": {"status": "error", "details": {"error": "DeviceNotRegistered"}},
                }
            },
        )

    service = make_service(httpx.MockTransport(handler))

    invalid = await service.invalid_tokens_from_receipts({"a": token(1), "b": token(2)})

    assert invalid == {token(2)}


class FakeTokens:
    def __init__(self, tokens: list[str]) -> None:
        self.tokens = tokens
        self.deleted: set[str] = set()

    async def tokens_for_bhawan_residents(self, bhawan_id: uuid.UUID) -> list[str]:
        return self.tokens

    async def tokens_for_user(self, user_id: uuid.UUID) -> list[str]:
        return self.tokens

    async def delete_tokens(self, tokens: set[str]) -> None:
        self.deleted |= tokens


@pytest.mark.parametrize("channel", ["mess-updates", "nudges"])
async def test_notifier_dedupes_and_prunes(channel: str) -> None:
    sent_to: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        sent_to.extend(m["to"] for m in body)
        return httpx.Response(
            200,
            json={
                "data": [
                    {"status": "error", "details": {"error": "DeviceNotRegistered"}}
                    if m["to"] == token(2)
                    else {"status": "ok", "id": m["to"]}
                    for m in body
                ]
            },
        )

    tokens = FakeTokens([token(1), token(2), token(1)])
    notifier = Notifier(tokens, make_service(httpx.MockTransport(handler)))

    report = await notifier.notify_bhawan_residents(
        uuid.uuid4(),
        title="t",
        body="b",
        data={},
        channel=channel,  # type: ignore[arg-type]
    )

    assert sent_to == [token(1), token(2)]
    assert tokens.deleted == {token(2)}
    assert report.sent == 1


async def test_notify_user_sends_to_each_device_once() -> None:
    sent_to: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        sent_to.extend(m["to"] for m in body)
        return httpx.Response(200, json={"data": [{"status": "ok", "id": m["to"]} for m in body]})

    notifier = Notifier(
        FakeTokens([token(1), token(1), token(3)]), make_service(httpx.MockTransport(handler))
    )
    report = await notifier.notify_user(uuid.uuid4(), title="Rebate approved", body="b", data={})

    assert sent_to == [token(1), token(3)]
    assert report.sent == 2
