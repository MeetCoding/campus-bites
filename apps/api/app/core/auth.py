from collections.abc import Callable
from typing import Annotated, Any
from uuid import UUID

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict

from app.core.errors import ApiError
from app.schemas.common import AppRole

ALLOWED_ALGORITHMS = ["ES256", "RS256"]
# Tolerated clock difference between Supabase Auth and this host (or a phone's fresh token):
# without it a token issued "in the future" by a few seconds fails as not-yet-valid (iat/nbf).
CLOCK_SKEW_SECONDS = 60


class CurrentUser(BaseModel):
    """Identity and claims from a verified Supabase access token (see custom_access_token_hook)."""

    model_config = ConfigDict(frozen=True)

    id: UUID
    email: str | None = None
    phone: str | None = None
    app_role: AppRole | None = None
    roles: frozenset[AppRole] = frozenset()
    bhawan_id: UUID | None = None
    scope_bhawan_ids: frozenset[UUID] = frozenset()
    outlet_ids: frozenset[UUID] = frozenset()

    def has_role(self, role: AppRole) -> bool:
        return role in self.roles

    @classmethod
    def from_claims(cls, claims: dict[str, Any]) -> "CurrentUser":
        known = {r.value for r in AppRole}
        return cls(
            id=claims["sub"],
            email=claims.get("email") or None,
            phone=claims.get("phone") or None,
            app_role=claims.get("app_role") if claims.get("app_role") in known else None,
            roles=frozenset(r for r in claims.get("roles") or [] if r in known),
            bhawan_id=claims.get("bhawan_id") or None,
            scope_bhawan_ids=frozenset(claims.get("scope_bhawan_ids") or []),
            outlet_ids=frozenset(claims.get("outlet_ids") or []),
        )


class TokenVerifier:
    """Verifies Supabase access tokens against the project's JWKS (asymmetric signing keys)."""

    def __init__(
        self,
        jwks_url: str,
        issuer: str,
        key_resolver: Callable[[str], Any] | None = None,
    ) -> None:
        self._issuer = issuer
        if key_resolver is None:
            jwks = jwt.PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)
            key_resolver = lambda token: jwks.get_signing_key_from_jwt(token).key  # noqa: E731
        self._resolve_key = key_resolver

    def verify(self, token: str) -> dict[str, Any]:
        try:
            key = self._resolve_key(token)
            return jwt.decode(
                token,
                key,
                algorithms=ALLOWED_ALGORITHMS,
                audience="authenticated",
                issuer=self._issuer,
                leeway=CLOCK_SKEW_SECONDS,
                options={"require": ["exp", "sub", "aud", "iss"]},
            )
        except jwt.PyJWKClientConnectionError as exc:
            raise ApiError(503, "AUTH_UNAVAILABLE", "Could not reach the auth server.") from exc
        except jwt.ExpiredSignatureError as exc:
            raise ApiError(401, "TOKEN_EXPIRED", "Session expired. Sign in again.") from exc
        except (jwt.InvalidTokenError, jwt.PyJWKClientError) as exc:
            raise ApiError(401, "INVALID_TOKEN", "Invalid session token.") from exc


def get_token_verifier(request: Request) -> TokenVerifier:
    return request.app.state.token_verifier


_bearer = HTTPBearer(auto_error=False)


# Sync on purpose: FastAPI runs it in the threadpool, so the (blocking) JWKS fetch on a
# cache miss never stalls the event loop.
def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    verifier: Annotated[TokenVerifier, Depends(get_token_verifier)],
) -> CurrentUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise ApiError(401, "NOT_AUTHENTICATED", "Sign in to continue.")
    claims = verifier.verify(credentials.credentials)
    return CurrentUser.from_claims(claims)


def require_role(*allowed: AppRole) -> Callable[..., CurrentUser]:
    """Dependency factory: the caller's token must carry at least one of `allowed`."""

    def dependency(user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
        if not any(user.has_role(role) for role in allowed):
            raise ApiError(403, "FORBIDDEN", "You don't have access to this action.")
        return user

    return dependency
