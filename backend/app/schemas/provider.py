from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ProviderStatus(BaseModel):
    name: str
    provider_type: str
    status: str
    available: bool
    supports_live_fetch: bool = False
    message: str
    cache_records: int = 0
    last_checked_at: datetime | None = None
    last_error: str | None = None


class ProviderStatusResponse(BaseModel):
    providers: list[ProviderStatus]
