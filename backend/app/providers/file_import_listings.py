from __future__ import annotations

from app.providers.base import ListingProvider
from app.schemas.listing import ListingImportRow


class FileImportListingProvider(ListingProvider):
    name = "file_import"
    supports_live_fetch = False

    def is_available(self) -> tuple[bool, str]:
        return True, "Available for CSV and JSON snapshot imports."

    def fetch_listings(self, realms: list[str]) -> list[ListingImportRow]:
        return []

    def fetch_item_market(self, *, item_id: int, region: str, tracked_realms: list[str]) -> tuple[list[ListingImportRow], str]:
        return [], "File imports do not provide live lookups. Import listings first to populate local data."
