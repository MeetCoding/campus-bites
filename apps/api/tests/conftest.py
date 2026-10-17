import os
import time
import uuid
from collections.abc import Callable
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import FastAPI
from fastapi.testclient import TestClient

# app.main builds the app at import time, so the environment must be valid before any import.
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SECRET_KEY", "test-secret-key")
os.environ.setdefault("INTERNAL_CRON_SECRET", "test-cron-secret")
os.environ.setdefault("ENVIRONMENT", "test")

from app.core.auth import TokenVerifier
from app.core.config import Settings
from app.main import create_app

ISSUER = "https://example.supabase.co/auth/v1"
SIGNING_KEY = ec.generate_private_key(ec.SECP256R1())

TokenFactory = Callable[..., str]


@pytest.fixture
def settings() -> Settings:
    return Settings(
        _env_file=None,
        environment="test",
        supabase_url="https://example.supabase.co",
        supabase_secret_key="test-secret-key",
        internal_cron_secret="test-cron-secret",
        cors_origins=["http://localhost:8081"],
    )


@pytest.fixture
def app(settings: Settings) -> FastAPI:
    application = create_app(settings)
    application.state.token_verifier = TokenVerifier(
        jwks_url="unused", issuer=ISSUER, key_resolver=lambda _token: SIGNING_KEY.public_key()
    )
    return application


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    return TestClient(app)


@pytest.fixture
def make_token() -> TokenFactory:
    """Mint a Supabase-shaped access token. Override any claim via kwargs."""

    def factory(
        *,
        sub: uuid.UUID | str | None = None,
        roles: list[str] | None = None,
        key: Any = SIGNING_KEY,
        algorithm: str = "ES256",
        expires_in: int = 3600,
        **claims: Any,
    ) -> str:
        roles = roles if roles is not None else ["student"]
        now = int(time.time())
        payload: dict[str, Any] = {
            "iss": ISSUER,
            "aud": "authenticated",
            "sub": str(sub or uuid.uuid4()),
            "iat": now,
            "exp": now + expires_in,
            "role": "authenticated",
            "email": "someone@ece.iitr.ac.in",
            "phone": "",
            "app_role": roles[0] if roles else None,
            "roles": roles,
            "bhawan_id": None,
            "scope_bhawan_ids": [],
            "outlet_ids": [],
            **claims,
        }
        return jwt.encode(payload, key, algorithm=algorithm)

    return factory


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}
