import time
import uuid
from typing import Annotated

import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.core.auth import CurrentUser, get_current_user, require_role
from app.schemas.common import AppRole
from tests.conftest import TokenFactory, bearer

SecretaryOrAdmin = require_role(AppRole.MESS_SECRETARY, AppRole.ADMIN)


@pytest.fixture
def probe(app: FastAPI) -> TestClient:
    """Adds two probe routes so auth behaviour is tested independently of feature routers."""

    @app.get("/_probe/me")
    def me(user: Annotated[CurrentUser, Depends(get_current_user)]) -> dict[str, object]:
        return {
            "id": str(user.id),
            "app_role": user.app_role,
            "roles": sorted(user.roles),
            "bhawan_id": str(user.bhawan_id) if user.bhawan_id else None,
            "outlets": len(user.outlet_ids),
            "email": user.email,
            "phone": user.phone,
        }

    @app.get("/_probe/secretary")
    def secretary(user: Annotated[CurrentUser, Depends(SecretaryOrAdmin)]) -> dict[str, str]:
        return {"ok": str(user.id)}

    return TestClient(app)


def test_missing_token_is_401(probe: TestClient) -> None:
    response = probe.get("/_probe/me")

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "NOT_AUTHENTICATED"


def test_valid_token_exposes_claims(probe: TestClient, make_token: TokenFactory) -> None:
    user_id, bhawan = uuid.uuid4(), uuid.uuid4()
    token = make_token(sub=user_id, roles=["student", "mess_secretary"], bhawan_id=str(bhawan))

    body = probe.get("/_probe/me", headers=bearer(token)).json()

    assert body["id"] == str(user_id)
    assert body["roles"] == ["mess_secretary", "student"]
    assert body["bhawan_id"] == str(bhawan)
    assert body["phone"] is None  # empty-string claims become None


def test_vendor_claims(probe: TestClient, make_token: TokenFactory) -> None:
    outlets = [str(uuid.uuid4()) for _ in range(3)]
    token = make_token(roles=["vendor"], email="", phone="919510709195", outlet_ids=outlets)

    body = probe.get("/_probe/me", headers=bearer(token)).json()

    assert body["app_role"] == "vendor"
    assert body["outlets"] == 3
    assert body["email"] is None


def test_unknown_roles_are_dropped(probe: TestClient, make_token: TokenFactory) -> None:
    token = make_token(roles=["student", "superuser"], app_role="superuser")

    body = probe.get("/_probe/me", headers=bearer(token)).json()

    assert body["roles"] == ["student"]
    assert body["app_role"] is None


def test_expired_token_is_401(probe: TestClient, make_token: TokenFactory) -> None:
    # Beyond the 60 s clock-skew leeway.
    response = probe.get("/_probe/me", headers=bearer(make_token(expires_in=-120)))

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "TOKEN_EXPIRED"


def test_small_clock_skew_is_tolerated(probe: TestClient, make_token: TokenFactory) -> None:
    """Found in the M6 end-to-end run: this host's clock was 9 s behind Supabase Auth, so a
    freshly issued token looked "issued in the future" and was rejected."""
    issued_ahead = int(time.time()) + 20
    token = make_token(iat=issued_ahead, nbf=issued_ahead)

    assert probe.get("/_probe/me", headers=bearer(token)).status_code == 200


@pytest.mark.parametrize(
    "overrides",
    [
        {"key": ec.generate_private_key(ec.SECP256R1())},  # forged signature
        {"aud": "anon"},
        {"iss": "https://evil.example/auth/v1"},
        {"key": "a-shared-secret-that-is-at-least-32-bytes!", "algorithm": "HS256"},  # alg swap
    ],
    ids=["forged", "wrong-audience", "wrong-issuer", "hs256-alg-confusion"],
)
def test_untrusted_tokens_are_401(
    probe: TestClient, make_token: TokenFactory, overrides: dict[str, object]
) -> None:
    response = probe.get("/_probe/me", headers=bearer(make_token(**overrides)))

    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "INVALID_TOKEN"


def test_garbage_token_is_401(probe: TestClient) -> None:
    response = probe.get("/_probe/me", headers=bearer("not.a.jwt"))

    assert response.status_code == 401


def test_require_role_allows_any_listed_role(probe: TestClient, make_token: TokenFactory) -> None:
    token = make_token(roles=["student", "mess_secretary"])

    assert probe.get("/_probe/secretary", headers=bearer(token)).status_code == 200


def test_require_role_rejects_others(probe: TestClient, make_token: TokenFactory) -> None:
    response = probe.get("/_probe/secretary", headers=bearer(make_token(roles=["student"])))

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "FORBIDDEN"
