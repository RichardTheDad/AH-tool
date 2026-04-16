from __future__ import annotations

import json
import logging
import threading
from urllib.parse import urlparse

import httpx
from fastapi import Header, HTTPException, status
from jose import JWTError, jwt

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_jwks_lock = threading.Lock()
_jwks_cache: dict[str, dict] = {}  # keyed by JWKS URL
_JWKS_CACHE_MAX_ENTRIES = 5


def _assert_trusted_issuer(issuer: str) -> str:
    trusted_supabase_url = get_settings().supabase_url
    if not trusted_supabase_url:
        raise JWTError("Auth not configured: AZEROTHFLIPLOCAL_SUPABASE_URL is not set.")

    def _split_url(raw_url: str) -> tuple[str, str]:
        parsed = urlparse(raw_url.rstrip("/"))
        if not parsed.scheme or not parsed.netloc:
            raise JWTError("Configured Supabase URL is invalid.")
        origin = f"{parsed.scheme.lower()}://{parsed.netloc.lower()}"
        path = parsed.path.rstrip("/").lower()
        return origin, path

    issuer_origin, issuer_path = _split_url(issuer)
    trusted_origin, trusted_path = _split_url(trusted_supabase_url)

    if issuer_origin != trusted_origin:
        raise JWTError("Token issuer is not trusted.")

    # Supabase tokens are typically issued from /auth/v1. Accept either
    # configured base URL or auth API URL to avoid env formatting mismatches.
    allowed_paths = {"", "/auth/v1"}
    if trusted_path:
        allowed_paths.add(trusted_path)

    if issuer_path not in allowed_paths:
        raise JWTError("Token issuer is not trusted.")

    return f"{issuer_origin}/auth/v1"


def _fetch_jwks(jwks_url: str) -> dict:
    """Fetch and in-process-cache the JWKS from Supabase."""
    if jwks_url in _jwks_cache:
        return _jwks_cache[jwks_url]
    with _jwks_lock:
        if jwks_url in _jwks_cache:
            return _jwks_cache[jwks_url]
        logger.info("Fetching JWKS from %s", jwks_url)
        parsed = urlparse(jwks_url)
        if parsed.scheme.lower() != "https" or not parsed.netloc:
            raise JWTError("JWKS URL is not trusted.")
        try:
            with httpx.Client(timeout=5.0) as client:
                response = client.get(jwks_url)
                response.raise_for_status()
                data = json.loads(response.text)
        except (httpx.HTTPError, json.JSONDecodeError) as exc:
            raise JWTError("Unable to fetch Supabase JWKS.") from exc
        if len(_jwks_cache) >= _JWKS_CACHE_MAX_ENTRIES:
            _jwks_cache.pop(next(iter(_jwks_cache)))
        _jwks_cache[jwks_url] = data
        return data


def _resolve_user_from_authorization(authorization: str | None, *, allow_missing: bool) -> str | None:
    if not authorization:
        if allow_missing:
            return None
        logger.warning("Auth rejected: missing Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not authorization.startswith("Bearer "):
        logger.warning("Auth rejected: malformed Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.removeprefix("Bearer ")
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")

        if alg == "HS256":
            secret = get_settings().supabase_jwt_secret
            if not secret:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Auth not configured: AZEROTHFLIPLOCAL_SUPABASE_JWT_SECRET is not set.",
                )
            payload = jwt.decode(
                token, secret, algorithms=["HS256"],
                audience="authenticated", options={"verify_exp": True},
            )
        else:
            # Asymmetric algorithm (ES256, RS256) — verify via Supabase JWKS
            unverified_claims = jwt.get_unverified_claims(token)
            issuer = unverified_claims.get("iss", "")
            if not issuer:
                raise JWTError("Token missing 'iss' claim")
            iss = _assert_trusted_issuer(str(issuer))
            jwks_url = f"{iss}/.well-known/jwks.json"
            kid = header.get("kid")
            jwks = _fetch_jwks(jwks_url)
            key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
            if not key:
                raise JWTError(f"No JWKS key found for kid={kid!r}")
            payload = jwt.decode(
                token, key, algorithms=[alg],
                audience="authenticated", options={"verify_exp": True},
            )

    except JWTError as exc:
        logger.warning("Auth rejected: JWTError — %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing user identity (sub claim).",
        )
    return user_id


def get_current_user(authorization: str | None = Header(None, alias="Authorization")) -> str:
    """Verify a Supabase-issued JWT (HS256 or ES256) and return the caller's user UUID."""
    user_id = _resolve_user_from_authorization(authorization, allow_missing=False)
    if user_id is None:  # pragma: no cover - guarded above
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user_id


def get_optional_user(authorization: str | None = Header(None, alias="Authorization")) -> str | None:
    """Return the caller's user UUID when a valid bearer token is provided, otherwise allow guest access."""
    return _resolve_user_from_authorization(authorization, allow_missing=True)
