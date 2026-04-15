from __future__ import annotations

import binascii
import base64
import json
import re

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


UUID_PATTERN = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$"
)


def _user_key(request: Request) -> str:
    """Return the authenticated user's UUID for rate limiting, falling back to IP.

    The JWT signature is intentionally NOT verified here — that is handled
    separately by the ``get_current_user`` FastAPI dependency on each protected
    endpoint.  This function only needs a stable per-user identifier.
    """
    try:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth.removeprefix("Bearer ")
            # JWT structure: header.payload.signature
            parts = token.split(".")
            if len(parts) == 3:
                padding = (4 - len(parts[1]) % 4) % 4
                payload_bytes = base64.urlsafe_b64decode(parts[1] + "=" * padding)
                payload = json.loads(payload_bytes)
                sub: str | None = payload.get("sub")
                if sub and UUID_PATTERN.fullmatch(sub):
                    return sub
    except (binascii.Error, json.JSONDecodeError, UnicodeDecodeError, ValueError, TypeError):
        pass
    return get_remote_address(request)


limiter = Limiter(key_func=_user_key)
