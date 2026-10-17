import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.main import create_app


def test_healthz_ok(client: TestClient) -> None:
    response = client.get("/healthz")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "environment": "test"}


def test_cors_allows_configured_origin(client: TestClient) -> None:
    response = client.get("/healthz", headers={"Origin": "http://localhost:8081"})

    assert response.headers["access-control-allow-origin"] == "http://localhost:8081"


def test_cors_rejects_unknown_origin(client: TestClient) -> None:
    response = client.get("/healthz", headers={"Origin": "https://evil.example"})

    assert "access-control-allow-origin" not in response.headers


def test_docs_hidden_in_production(settings: Settings) -> None:
    prod = TestClient(create_app(settings.model_copy(update={"environment": "production"})))

    assert prod.get("/docs").status_code == 404
    assert prod.get("/openapi.json").status_code == 404


def test_jwks_url_derived_from_supabase_url(settings: Settings) -> None:
    assert settings.supabase_jwks_url == "https://example.supabase.co/auth/v1/.well-known/jwks.json"


def test_secrets_are_required(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)

    with pytest.raises(ValidationError):
        Settings(_env_file=None)  # type: ignore[call-arg]


def test_secrets_not_leaked_in_repr(settings: Settings) -> None:
    assert "test-secret-key" not in repr(settings)
