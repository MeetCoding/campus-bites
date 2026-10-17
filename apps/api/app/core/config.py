from functools import lru_cache
from typing import Literal

from pydantic import AnyHttpUrl, SecretStr, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, read from environment variables (or apps/api/.env locally).

    Business constants (min rebate days, nudge thresholds) are NOT here — they live in the
    `public.app_settings` table so the app, SQL and API share one source of truth.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"
    supabase_url: AnyHttpUrl
    supabase_secret_key: SecretStr
    internal_cron_secret: SecretStr
    expo_access_token: SecretStr | None = None
    # JSON list, e.g. CORS_ORIGINS='["http://localhost:8081"]'. Native apps don't need CORS.
    cors_origins: list[str] = []

    @computed_field
    @property
    def supabase_jwks_url(self) -> str:
        return f"{str(self.supabase_url).rstrip('/')}/auth/v1/.well-known/jwks.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # required fields come from the environment
