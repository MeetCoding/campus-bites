from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.auth import TokenVerifier
from app.core.config import Settings, get_settings
from app.routers import admin, health, rebates, timings


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    is_production = settings.environment == "production"

    app = FastAPI(
        title="Campus Bites API",
        version="0.1.0",
        docs_url=None if is_production else "/docs",
        redoc_url=None,
        openapi_url=None if is_production else "/openapi.json",
    )
    app.dependency_overrides[get_settings] = lambda: settings
    app.state.settings = settings
    app.state.token_verifier = TokenVerifier(
        jwks_url=settings.supabase_jwks_url,
        issuer=f"{str(settings.supabase_url).rstrip('/')}/auth/v1",
    )

    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_methods=["GET", "POST", "DELETE"],
            allow_headers=["Authorization", "Content-Type"],
        )

    app.include_router(health.router)
    app.include_router(admin.router)
    app.include_router(timings.router)
    app.include_router(rebates.router)
    return app


app = create_app()
