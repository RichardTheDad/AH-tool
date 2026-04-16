from __future__ import annotations

from functools import lru_cache

from sqlalchemy import func, or_

from app.core.config import clear_settings_cache, get_settings
from app.db.models import Item, ListingSnapshot
from app.providers.blizzard_auctions import BlizzardAuctionListingProvider
from app.providers.blizzard_metadata import BlizzardMetadataProvider
from app.schemas.provider import ProviderStatus


def _has_cached_metadata(item: Item) -> bool:
    metadata = item.metadata_json
    if not isinstance(metadata, dict) or not metadata:
        return False
    return metadata.get("metadata_status") != "missing"


def _build_status(
    *,
    name: str,
    provider_type: str,
    available: bool,
    supports_live_fetch: bool,
    message: str,
    cache_records: int = 0,
    last_checked_at=None,
    last_error=None,
    treat_last_error_as_status: bool = True,
) -> ProviderStatus:
    if treat_last_error_as_status and last_error:
        status = "error"
    elif available:
        status = "available"
    elif cache_records > 0:
        status = "cached_only"
    else:
        status = "unavailable"

    return ProviderStatus(
        name=name,
        provider_type=provider_type,
        status=status,
        available=available,
        supports_live_fetch=supports_live_fetch,
        message=message,
        cache_records=cache_records,
        last_checked_at=last_checked_at,
        last_error=last_error,
    )


class ProviderRegistry:
    def __init__(self) -> None:
        settings = get_settings()
        self.metadata_provider = BlizzardMetadataProvider(settings)
        self.listing_providers = {
            "blizzard_auctions": BlizzardAuctionListingProvider(settings),
        }

    def get_listing_provider(self, name: str | None = None):
        target = name or get_settings().default_listing_provider
        if target not in self.listing_providers:
            raise KeyError(f"Unknown listing provider: {target}")
        return self.listing_providers[target]

    def get_provider_statuses(self, session) -> list[ProviderStatus]:
        cached_item_count = (
            session.query(func.count(Item.item_id))
            .filter(
                Item.metadata_json.isnot(None),
                or_(
                    Item.metadata_json["metadata_status"].as_string().is_(None),
                    Item.metadata_json["metadata_status"].as_string() != "missing",
                ),
            )
            .scalar() or 0
        )
        blizzard_listing_count = session.query(func.count(ListingSnapshot.id)).filter(ListingSnapshot.source_name == "blizzard_auctions").scalar() or 0

        metadata_available, metadata_message = self.metadata_provider.is_available()
        if metadata_available and self.metadata_provider.last_error:
            metadata_available, metadata_message = self.metadata_provider.recheck_status()
        if not metadata_available and cached_item_count > 0 and not self.metadata_provider.last_error:
            metadata_message = f"{cached_item_count} cached item records available for offline metadata lookups."
        elif not metadata_available and cached_item_count > 0 and self.metadata_provider.last_error:
            metadata_message = (
                f"Live Blizzard metadata lookup is failing right now; {cached_item_count} cached item records remain usable."
            )
        elif metadata_available and self.metadata_provider.last_error:
            metadata_message = "Configured for live Blizzard item metadata lookups. The last request failed, but rechecks are enabled."
        statuses = [
            _build_status(
                name=self.metadata_provider.name,
                provider_type=self.metadata_provider.provider_type,
                available=metadata_available,
                supports_live_fetch=self.metadata_provider.supports_live_fetch,
                message=metadata_message,
                cache_records=cached_item_count,
                last_checked_at=self.metadata_provider.last_checked_at,
                last_error=self.metadata_provider.last_error,
                treat_last_error_as_status=metadata_available,
            )
        ]

        blizzard_provider = self.listing_providers["blizzard_auctions"]
        available, message = blizzard_provider.is_available()
        if available and blizzard_listing_count > 0:
            message = f"Live Blizzard retail refresh is configured; {blizzard_listing_count} cached snapshots available."
        elif not available and blizzard_listing_count > 0:
            message = f"Live Blizzard retail refresh is unavailable; {blizzard_listing_count} cached snapshots remain usable."
        statuses.append(
            _build_status(
                name=blizzard_provider.name,
                provider_type=blizzard_provider.provider_type,
                available=available,
                supports_live_fetch=blizzard_provider.supports_live_fetch,
                message=message,
                cache_records=blizzard_listing_count,
                last_checked_at=blizzard_provider.last_checked_at,
                last_error=str(blizzard_provider.last_error) if blizzard_provider.last_error else None,
            )
        )
        return statuses


@lru_cache(maxsize=1)
def get_provider_registry() -> ProviderRegistry:
    return ProviderRegistry()


def reset_provider_registry() -> None:
    clear_settings_cache()
    get_provider_registry.cache_clear()
