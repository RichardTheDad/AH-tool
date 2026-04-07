from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from typing import Any

import httpx

from app.core.config import Settings
from app.providers.base import ListingProvider
from app.schemas.listing import ListingImportRow


logger = logging.getLogger(__name__)


CONNECTED_REALM_ID_PATTERN = re.compile(r"/connected-realm/(\d+)")


class BlizzardAuctionListingProvider(ListingProvider):
    name = "blizzard_auctions"
    supports_live_fetch = True

    def __init__(self, settings: Settings) -> None:
        super().__init__()
        self.settings = settings
        self._access_token: str | None = None
        self._access_token_expires_at: datetime | None = None
        self._realm_cache: dict[str, int] = {}
        self._realm_cache_checked_at: datetime | None = None

    def is_available(self) -> tuple[bool, str]:
        if not self.settings.blizzard_client_id or not self.settings.blizzard_client_secret:
            return False, "No Blizzard Battle.net client credentials are configured."
        return True, "Configured for live Blizzard Retail Auction House refreshes."

    def recheck_status(self) -> tuple[bool, str]:
        available, message = self.is_available()
        if not available:
            return available, message

        try:
            with httpx.Client(timeout=self.settings.request_timeout_seconds) as client:
                self._get_access_token(client, force_refresh=True)
                self._api_get(
                    client,
                    "/data/wow/connected-realm/index",
                    params={
                        "namespace": self._dynamic_namespace(),
                        "locale": self.settings.blizzard_locale,
                    },
                )
            self.mark_success()
            return True, "Configured for live Blizzard Retail Auction House refreshes."
        except Exception as exc:  # pragma: no cover - network failure path
            self.mark_failure(f"Blizzard provider status recheck failed: {exc}")
            return False, self.last_error or message

    def fetch_listings(self, realms: list[str]) -> list[ListingImportRow]:
        available, message = self.is_available()
        if not available:
            self.mark_failure(message)
            return []

        try:
            with httpx.Client(timeout=self.settings.request_timeout_seconds) as client:
                resolved, unresolved = self._resolve_realms(client, realms)
                if not resolved:
                    self.mark_failure("No tracked realms could be resolved through Blizzard connected realm data.")
                    return []

                grouped_realms: dict[int, list[str]] = {}
                for realm_name, connected_realm_id in resolved.items():
                    grouped_realms.setdefault(connected_realm_id, []).append(realm_name)

                rows: list[ListingImportRow] = []
                for connected_realm_id, realm_names in grouped_realms.items():
                    market_rows = self._fetch_connected_realm_market(client, connected_realm_id)
                    for realm_name in realm_names:
                        rows.extend(row.model_copy(update={"realm": realm_name}) for row in market_rows)

                if unresolved:
                    logger.warning("%s could not resolve tracked realms via Blizzard: %s", self.name, ", ".join(unresolved))

                if rows:
                    self.mark_success()
                    return rows

                self.mark_failure("Blizzard auction refresh returned no non-commodity auction listings.")
                return []
        except Exception as exc:  # pragma: no cover - network failure path
            self.mark_failure(f"Blizzard auction refresh failed: {exc}")
            return []

    def fetch_item_market(self, *, item_id: int, region: str, tracked_realms: list[str]) -> tuple[list[ListingImportRow], str]:
        del region  # Blizzard region comes from configured API region.
        available, message = self.is_available()
        if not available:
            self.mark_failure(message)
            return [], message

        if not tracked_realms:
            return [], "Add at least one enabled realm before checking live Blizzard listings."

        try:
            with httpx.Client(timeout=self.settings.request_timeout_seconds) as client:
                resolved, unresolved = self._resolve_realms(client, tracked_realms)
                if not resolved:
                    failure = "No tracked realms could be resolved through Blizzard connected realm data."
                    self.mark_failure(failure)
                    return [], failure

                grouped_realms: dict[int, list[str]] = {}
                for realm_name, connected_realm_id in resolved.items():
                    grouped_realms.setdefault(connected_realm_id, []).append(realm_name)

                rows: list[ListingImportRow] = []
                for connected_realm_id, realm_names in grouped_realms.items():
                    market_rows = self._fetch_connected_realm_market(client, connected_realm_id, target_item_id=item_id)
                    for realm_name in realm_names:
                        rows.extend(row.model_copy(update={"realm": realm_name}) for row in market_rows)

                if unresolved:
                    logger.warning("%s could not resolve tracked realms via Blizzard: %s", self.name, ", ".join(unresolved))

                if rows:
                    self.mark_success()
                    message = f"Live Blizzard lookup returned {len(rows)} tracked realm listings for item {item_id}."
                    return rows, message

                message = f"Live Blizzard lookup found no auctions for item {item_id} across your tracked realms."
                self.mark_success()
                return [], message
        except Exception as exc:  # pragma: no cover - network failure path
            self.mark_failure(f"Blizzard live item lookup failed: {exc}")
            return [], self.last_error or "Blizzard live item lookup failed."

    def _resolve_realms(self, client: httpx.Client, realms: list[str]) -> tuple[dict[str, int], list[str]]:
        cache = self._load_realm_cache(client, target_realms={realm.casefold() for realm in realms})
        resolved: dict[str, int] = {}
        unresolved: list[str] = []

        for realm_name in realms:
            connected_realm_id = cache.get(realm_name.casefold())
            if connected_realm_id is None:
                unresolved.append(realm_name)
                continue
            resolved[realm_name] = connected_realm_id

        return resolved, unresolved

    def _load_realm_cache(self, client: httpx.Client, *, target_realms: set[str] | None = None) -> dict[str, int]:
        now = datetime.now(timezone.utc)
        cache_is_fresh = bool(
            self._realm_cache and self._realm_cache_checked_at and (now - self._realm_cache_checked_at) < timedelta(hours=24)
        )
        if cache_is_fresh:
            if not target_realms or all(realm_name in self._realm_cache for realm_name in target_realms):
                return self._realm_cache

        payload, _headers = self._api_get(
            client,
            "/data/wow/connected-realm/index",
            params={
                "namespace": self._dynamic_namespace(),
                "locale": self.settings.blizzard_locale,
            },
        )

        connected_realm_refs = payload.get("connected_realms", []) if isinstance(payload, dict) else []
        cache: dict[str, int] = dict(self._realm_cache)
        pending_targets = {realm_name for realm_name in (target_realms or set()) if realm_name not in cache}
        for entry in connected_realm_refs:
            href = entry.get("href") if isinstance(entry, dict) else None
            if not href:
                continue
            detail_payload, _detail_headers = self._api_get(client, href, absolute=True)
            connected_realm_id = self._extract_connected_realm_id(detail_payload, href)
            if connected_realm_id is None:
                continue
            for realm_name in self._extract_realm_names(detail_payload):
                normalized_name = realm_name.casefold()
                cache[normalized_name] = connected_realm_id
                pending_targets.discard(normalized_name)
            if target_realms and not pending_targets:
                break

        self._realm_cache = cache
        self._realm_cache_checked_at = now
        return cache

    def _fetch_connected_realm_market(
        self,
        client: httpx.Client,
        connected_realm_id: int,
        *,
        target_item_id: int | None = None,
    ) -> list[ListingImportRow]:
        payload, headers = self._api_get(
            client,
            f"/data/wow/connected-realm/{connected_realm_id}/auctions",
            params={
                "namespace": self._dynamic_namespace(),
                "locale": self.settings.blizzard_locale,
            },
        )
        captured_at = self._extract_captured_at(headers)
        auctions = payload.get("auctions", []) if isinstance(payload, dict) else []

        aggregated: dict[int, dict[str, float]] = {}
        for auction in auctions:
            if not isinstance(auction, dict):
                continue
            item_id = self._extract_item_id(auction)
            buyout = self._extract_buyout(auction)
            if item_id is None or buyout is None or buyout <= 0:
                continue
            if target_item_id is not None and item_id != target_item_id:
                continue

            quantity = max(self._extract_quantity(auction) or 1, 1)
            stats = aggregated.setdefault(
                item_id,
                {
                    "lowest_price": float(buyout),
                    "weighted_total": 0.0,
                    "quantity": 0.0,
                    "listing_count": 0.0,
                },
            )
            stats["lowest_price"] = min(float(stats["lowest_price"]), float(buyout))
            stats["weighted_total"] += float(buyout) * quantity
            stats["quantity"] += quantity
            stats["listing_count"] += 1

        rows: list[ListingImportRow] = []
        for item_id, stats in aggregated.items():
            quantity = int(stats["quantity"])
            rows.append(
                ListingImportRow(
                    item_id=item_id,
                    realm=f"connected-realm-{connected_realm_id}",
                    lowest_price=float(stats["lowest_price"]),
                    average_price=round((stats["weighted_total"] / quantity), 2) if quantity else float(stats["lowest_price"]),
                    quantity=quantity,
                    listing_count=int(stats["listing_count"]),
                    captured_at=captured_at,
                )
            )
        return rows

    def _api_get(
        self,
        client: httpx.Client,
        path_or_url: str,
        *,
        params: dict[str, Any] | None = None,
        absolute: bool = False,
    ) -> tuple[Any, httpx.Headers]:
        token = self._get_access_token(client)
        url = path_or_url if absolute else f"{self._api_base_url()}{path_or_url}"
        response = client.get(url, params=params, headers={"Authorization": f"Bearer {token}"})
        response.raise_for_status()
        return response.json(), response.headers

    def _get_access_token(self, client: httpx.Client, *, force_refresh: bool = False) -> str:
        now = datetime.now(timezone.utc)
        if (
            not force_refresh
            and self._access_token
            and self._access_token_expires_at
            and self._access_token_expires_at > now + timedelta(seconds=60)
        ):
            return self._access_token

        response = client.post(
            "https://oauth.battle.net/token",
            data={"grant_type": "client_credentials"},
            auth=(self.settings.blizzard_client_id, self.settings.blizzard_client_secret),
        )
        response.raise_for_status()
        payload = response.json()
        token = payload.get("access_token")
        expires_in = int(payload.get("expires_in", 0) or 0)
        if not token or expires_in <= 0:
            raise ValueError("Blizzard OAuth token response was missing access_token or expires_in.")

        self._access_token = str(token)
        self._access_token_expires_at = now + timedelta(seconds=expires_in)
        return self._access_token

    def _api_base_url(self) -> str:
        return f"https://{self.settings.blizzard_api_region.lower()}.api.blizzard.com"

    def _dynamic_namespace(self) -> str:
        return f"dynamic-{self.settings.blizzard_api_region.lower()}"

    def _extract_connected_realm_id(self, payload: Any, href: str) -> int | None:
        if isinstance(payload, dict):
            try:
                if payload.get("id") is not None:
                    return int(payload["id"])
            except (TypeError, ValueError):
                pass

        match = CONNECTED_REALM_ID_PATTERN.search(href)
        if match:
            return int(match.group(1))
        return None

    def _extract_realm_names(self, payload: Any) -> list[str]:
        if not isinstance(payload, dict):
            return []

        realms = payload.get("realms", [])
        names: list[str] = []
        if isinstance(realms, list):
            for realm in realms:
                if not isinstance(realm, dict):
                    continue
                name = self._extract_localized_name(realm.get("name"))
                if name:
                    names.append(name)
        return names

    def _extract_localized_name(self, value: Any) -> str | None:
        if isinstance(value, str):
            text = value.strip()
            return text or None
        if isinstance(value, dict):
            preferred = value.get(self.settings.blizzard_locale)
            if isinstance(preferred, str) and preferred.strip():
                return preferred.strip()
            fallback = value.get("en_US")
            if isinstance(fallback, str) and fallback.strip():
                return fallback.strip()
            for nested in value.values():
                if isinstance(nested, str) and nested.strip():
                    return nested.strip()
        return None

    def _extract_captured_at(self, headers: httpx.Headers) -> datetime:
        last_modified = headers.get("Last-Modified")
        if last_modified:
            try:
                parsed = parsedate_to_datetime(last_modified)
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=timezone.utc)
                return parsed.astimezone(timezone.utc)
            except (TypeError, ValueError):
                logger.warning("%s received an unparseable Last-Modified header: %s", self.name, last_modified)
        return datetime.now(timezone.utc)

    def _extract_item_id(self, auction: dict[str, Any]) -> int | None:
        item = auction.get("item")
        if isinstance(item, dict):
            try:
                if item.get("id") is not None:
                    return int(item["id"])
            except (TypeError, ValueError):
                pass
            nested_item = item.get("item")
            if isinstance(nested_item, dict):
                try:
                    if nested_item.get("id") is not None:
                        return int(nested_item["id"])
                except (TypeError, ValueError):
                    pass
        return None

    def _extract_buyout(self, auction: dict[str, Any]) -> int | None:
        for key in ("buyout", "unit_price", "price"):
            value = auction.get(key)
            if value is None or value == "":
                continue
            try:
                return int(value)
            except (TypeError, ValueError):
                continue
        return None

    def _extract_quantity(self, auction: dict[str, Any]) -> int | None:
        for key in ("quantity", "count"):
            value = auction.get(key)
            if value is None or value == "":
                continue
            try:
                return int(value)
            except (TypeError, ValueError):
                continue
        return None
