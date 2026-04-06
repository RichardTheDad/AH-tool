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

