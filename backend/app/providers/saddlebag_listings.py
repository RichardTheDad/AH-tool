from __future__ import annotations

import logging
from datetime import datetime, timezone
from statistics import mean
from typing import Any

import httpx

from app.core.config import Settings
from app.providers.base import ListingProvider
from app.schemas.listing import ListingImportRow
from app.schemas.saddlebag import WoWListingsParams, normalize_saddlebag_region


logger = logging.getLogger(__name__)


class SaddlebagPublicListingProvider(ListingProvider):
    name = "saddlebag_public"
    # The public WoW listings endpoints are live, but they are per-item lookups
    # rather than a full bulk scan feed. The scanner therefore relies on imports.
    supports_live_fetch = False

    def __init__(self, settings: Settings) -> None:
        super().__init__()
        self.settings = settings

    def is_available(self) -> tuple[bool, str]:
        if not self.settings.saddlebag_listing_url:
            return False, "No Saddlebag WoW listings API base URL is configured."
        if self.last_error:
            return False, self.last_error
        return (
            False,
            "Public Saddlebag WoW listings are exposed as per-item realm lookups. Bulk realm scans still require imported listing snapshots.",
        )

    def fetch_listings(self, realms: list[str]) -> list[ListingImportRow]:
        self.mark_failure(
            "Public Saddlebag WoW listings require homeRealmId + itemID per request and are not used for bulk scanner refreshes."
        )
        logger.info("Skipping live listing refresh for realms %s; import workflow required.", realms)
        return []

    def fetch_item_realm_listing(
        self,
        *,
        home_realm_id: int,
        region: str,
        item_id: int,
        realm_name: str,
    ) -> ListingImportRow | None:
        payload = self.build_request(home_realm_id=home_realm_id, region=region, item_id=item_id)
        last_exception: Exception | None = None

        for path in self.endpoint_candidates():
            try:
                response_payload = self._post(path, payload.model_dump())
                listing = self._normalize_listing_payload(
                    response_payload,
                    item_id=item_id,
                    realm_name=realm_name,
                )
                if listing is not None:
                    self.mark_success()
                    return listing
            except Exception as exc:  # pragma: no cover - network failure path
                last_exception = exc
                logger.warning("%s request failed for %s: %s", self.name, path, exc)

        if last_exception is not None:
            self.mark_failure(f"Listing lookup failed: {last_exception}")
        else:
            self.mark_failure("Listing lookup returned no usable listing records.")
        return None

    def endpoint_candidates(self) -> list[str]:
        # The spec exposes both endpoints with the same request schema and no
        # materially different response contract. Prefer the established path
        # first, then fall back to v2 if needed.
        return ["/api/wow/listings", "/api/wow/v2/listings"]

    def build_request(self, *, home_realm_id: int, region: str, item_id: int) -> WoWListingsParams:
        return WoWListingsParams(
            homeRealmId=home_realm_id,
            region=normalize_saddlebag_region(region),
            itemID=item_id,
        )

    def _post(self, path: str, payload: dict[str, Any]) -> Any:
        endpoint = self._build_endpoint(path)
        with httpx.Client(timeout=self.settings.request_timeout_seconds) as client:
            response = client.post(endpoint, json=payload)
            response.raise_for_status()
        return response.json()

    def _build_endpoint(self, path: str) -> str:
        base = self.settings.saddlebag_listing_url.rstrip("/")
        if base.endswith("/api/wow"):
            trimmed = path.removeprefix("/api/wow")
            return f"{base}{trimmed}"
        return f"{base}{path}"

    def _normalize_listing_payload(self, payload: Any, *, item_id: int, realm_name: str) -> ListingImportRow | None:
        entries = self._extract_entries(payload)
        if not entries:
            logger.warning("%s returned an unexpected listing payload shape for item %s on %s", self.name, item_id, realm_name)
            return None

        prices: list[float] = []
        total_quantity = 0
        weighted_price_total = 0.0

        for entry in entries:
            price = self._extract_price(entry)
            if price is None or price < 0:
                continue
            quantity = self._extract_quantity(entry) or 1
            quantity = max(quantity, 1)
            prices.append(price)
            total_quantity += quantity
            weighted_price_total += price * quantity

        if not prices:
            return None

        return ListingImportRow(
            item_id=item_id,
            realm=realm_name,
            lowest_price=min(prices),
            average_price=round((weighted_price_total / total_quantity), 2) if total_quantity else round(mean(prices), 2),
            quantity=total_quantity,
            listing_count=len(prices),
            captured_at=datetime.now(timezone.utc),
        )

    def _extract_entries(self, payload: Any) -> list[dict[str, Any]]:
        if isinstance(payload, list):
            return [entry for entry in payload if isinstance(entry, dict)]
        if isinstance(payload, dict):
            for key in ("data", "listings", "auctions", "results"):
                value = payload.get(key)
                if isinstance(value, list):
                    return [entry for entry in value if isinstance(entry, dict)]
                if isinstance(value, dict) and self._looks_like_listing(value):
                    return [value]
            if self._looks_like_listing(payload):
                return [payload]
        return []

    def _looks_like_listing(self, payload: dict[str, Any]) -> bool:
        return any(key in payload for key in ("price", "buyout", "minPrice", "unit_price", "price_per_unit"))

    def _extract_price(self, payload: dict[str, Any]) -> float | None:
        for key in ("price", "buyout", "minPrice", "unit_price", "price_per_unit"):
            value = payload.get(key)
            if value is None or value == "":
                continue
            try:
                return float(value)
            except (TypeError, ValueError):
                continue
        return None

    def _extract_quantity(self, payload: dict[str, Any]) -> int | None:
        for key in ("quantity", "qty", "count"):
            value = payload.get(key)
            if value is None or value == "":
                continue
            try:
                return int(value)
            except (TypeError, ValueError):
                continue
        return None
