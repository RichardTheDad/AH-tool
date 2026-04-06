from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone

from app.schemas.item import ItemRead, ItemSearchResult
from app.schemas.listing import ListingImportRow
from app.schemas.provider import ProviderStatus


logger = logging.getLogger(__name__)


class BaseProvider(ABC):
    name: str = "base"
    provider_type: str = "unknown"
    supports_live_fetch: bool = False

    def __init__(self) -> None:
        self.last_checked_at: datetime | None = None
        self.last_error: str | None = None

    def mark_success(self) -> None:
        self.last_checked_at = datetime.now(timezone.utc)
        self.last_error = None

    def mark_failure(self, message: str) -> None:
        self.last_checked_at = datetime.now(timezone.utc)
        self.last_error = message
        logger.warning("%s provider failure: %s", self.name, message)

    @abstractmethod
    def is_available(self) -> tuple[bool, str]:
        raise NotImplementedError

    def get_status(self) -> ProviderStatus:
        available, message = self.is_available()
        return ProviderStatus(
            name=self.name,
            provider_type=self.provider_type,
            status="available" if available else ("error" if self.last_error else "unavailable"),
            available=available,
            supports_live_fetch=self.supports_live_fetch,
            message=message,
            cache_records=0,
            last_checked_at=self.last_checked_at,
            last_error=self.last_error,
        )


class ItemMetadataProvider(BaseProvider, ABC):
    provider_type = "metadata"

    @abstractmethod
    def search_items(self, query: str, limit: int = 25) -> list[ItemSearchResult]:
        raise NotImplementedError

    @abstractmethod
    def fetch_item(self, item_id: int) -> ItemRead | None:
        raise NotImplementedError


class ListingProvider(BaseProvider, ABC):
    provider_type = "listing"

    @abstractmethod
    def fetch_listings(self, realms: list[str]) -> list[ListingImportRow]:
        raise NotImplementedError
