from __future__ import annotations

import json
import logging
import threading
import urllib.request

from fastapi import Header, HTTPException, status
from jose import JWTError, jwt

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_jwks_lock = threading.Lock()
_jwks_cache: dict[str, dict] = {}  # keyed by JWKS URL


def _fetch_jwks(jwks_url: str) -> dict:
    """Fetch and in-process-cache the JWKS from Supabase."""
    if jwks_url in _jwks_cache:
        return _jwks_cache[jwks_url]
    with _jwks_lock:
        if jwks_url in _jwks_cache:
            return _jwks_cache[jwks_url]
        logger.info("Fetching JWKS from %s", jwks_url)
        with urllib.request.urlopen(jwks_url, timeout=5) as resp:  # noqa: S310
            data = json.loads(resp.read())
        _jwks_cache[jwks_url] = data
        return data


def get_current_user(authorization: str | None = Header(None, alias="Authorization")) -> str:
    """Verify a Supabase-issued JWT (HS256 or ES256) and return the caller's user UUID."""
    if not authorization or not authorization.startswith("Bearer "):
        logger.warning("Auth rejected: missing or malformed Authorization header")
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
            iss = unverified_claims.get("iss", "").rstrip("/")
            if not iss:
                raise JWTError("Token missing 'iss' claim")
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
