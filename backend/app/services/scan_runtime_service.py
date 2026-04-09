from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from threading import Lock


@dataclass
class ScanRuntimeState:
    status: str = "idle"
    message: str = "Scanner is idle."
    provider_name: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None


_state = ScanRuntimeState()
_lock = Lock()


def get_scan_runtime_state() -> ScanRuntimeState:
    with _lock:
        return ScanRuntimeState(
            status=_state.status,
            message=_state.message,
            provider_name=_state.provider_name,
            started_at=_state.started_at,
            finished_at=_state.finished_at,
        )


def mark_scan_started(provider_name: str | None) -> None:
    with _lock:
        _state.status = "running"
        _state.message = "A scan is currently running. Realm and metadata edits are temporarily locked."
        _state.provider_name = provider_name or "stored"
        _state.started_at = datetime.now(timezone.utc)
        _state.finished_at = None


def try_mark_scan_started(provider_name: str | None) -> bool:
    with _lock:
        if _state.status == "running":
            return False
        _state.status = "running"
        _state.message = "A scan is currently running. Realm and metadata edits are temporarily locked."
        _state.provider_name = provider_name or "stored"
        _state.started_at = datetime.now(timezone.utc)
        _state.finished_at = None
        return True


def mark_scan_stage(message: str) -> None:
    with _lock:
        if _state.status == "running":
            _state.message = message


def mark_scan_finished(provider_name: str | None, *, result_count: int, warning_text: str | None = None) -> None:
    with _lock:
        _state.status = "idle"
        result_message = f"Last scan finished with {result_count} ranked result{'s' if result_count != 1 else ''}."
        _state.message = f"{result_message} Warning: {warning_text}" if warning_text else result_message
        _state.provider_name = provider_name or "stored"
        _state.finished_at = datetime.now(timezone.utc)


def mark_scan_failed(provider_name: str | None, message: str) -> None:
    with _lock:
        _state.status = "idle"
        _state.message = message
        _state.provider_name = provider_name or "stored"
        _state.finished_at = datetime.now(timezone.utc)
