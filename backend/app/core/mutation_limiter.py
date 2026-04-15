from __future__ import annotations

from collections.abc import Hashable
from dataclasses import dataclass
from threading import Lock
from time import monotonic

from fastapi import HTTPException


@dataclass
class _WindowCounter:
    started_at: float
    count: int


_lock = Lock()
_counters: dict[tuple[Hashable, ...], _WindowCounter] = {}


def enforce_user_mutation_limit(*, user_id: str, scope: str, limit: int, window_seconds: int = 60) -> None:
    """Enforce a simple in-memory per-user mutation limit.

    This complements API auth by reducing accidental flooding of write endpoints.
    """
    now = monotonic()
    key = (scope, user_id)

    with _lock:
        current = _counters.get(key)
        if current is None or (now - current.started_at) >= window_seconds:
            _counters[key] = _WindowCounter(started_at=now, count=1)
            return

        if current.count >= limit:
            raise HTTPException(
                status_code=429,
                detail="Too many write requests. Please wait and try again.",
            )

        current.count += 1


def clear_mutation_limiters() -> None:
    with _lock:
        _counters.clear()
