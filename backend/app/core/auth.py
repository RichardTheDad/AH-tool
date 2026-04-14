from __future__ import annotations

import logging

from fastapi import Header, HTTPException, status
from jose import JWTError, jwt

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def get_current_user(authorization: str | None = Header(None, alias="Authorization")) -> str:
    """Verify a Supabase-issued JWT and return the caller's user UUID (sub claim)."""
    if not authorization or not authorization.startswith("Bearer "):
        logger.warning("Auth rejected: missing or malformed Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.removeprefix("Bearer ")
    secret = get_settings().supabase_jwt_secret
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Auth not configured: AZEROTHFLIPLOCAL_SUPABASE_JWT_SECRET is not set on the server.",
        )
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"verify_exp": True},
        )
    except JWTError as exc:
        logger.warning("Auth rejected: JWTError — %s (token prefix: %s...)", exc, token[:20])
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing user identity (sub claim).",
        )
    return user_id
