from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.core.config import Settings
from app.providers.base import ItemMetadataProvider
from app.schemas.item import ItemRead, ItemSearchResult


logger = logging.getLogger(__name__)


class BlizzardMetadataProvider(ItemMetadataProvider):
    name = "blizzard_metadata"
    supports_live_fetch = True

    def __init__(self, settings: Settings) -> None:
        super().__init__()
        self.settings = settings
        self._access_token: str | None = None
        self._access_token_expires_at: datetime | None = None

    def is_available(self) -> tuple[bool, str]:
        if not self.settings.blizzard_client_id or not self.settings.blizzard_client_secret:
            return False, "No Blizzard Battle.net client credentials are configured for item metadata."
        return True, "Configured for live Blizzard item metadata lookups."

    def recheck_status(self) -> tuple[bool, str]:
        available, message = self.is_available()
        if not available:
            return available, message

        try:
            with httpx.Client(timeout=self.settings.request_timeout_seconds) as client:
                self._api_get(
                    client,
                    "/data/wow/item/19019",
                    params={
                        "namespace": self._static_namespace(),
                        "locale": self.settings.blizzard_locale,
                    },
                )
            self.mark_success()
            return True, "Configured for live Blizzard item metadata lookups."
        except Exception as exc:  # pragma: no cover - network failure path
            self.mark_failure(f"Metadata status recheck failed: {exc}")
            return False, self.last_error or message

    def search_items(self, query: str, limit: int = 25) -> list[ItemSearchResult]:
        available, message = self.is_available()
        if not available:
            logger.info("Skipping Blizzard metadata lookup: %s", message)
            return []

        query_text = query.strip()
        if not query_text:
            return []

        if query_text.isdigit():
            item = self.fetch_item(int(query_text))
            if item is None:
                return []
            return [ItemSearchResult.model_validate(item.model_dump())]

        try:
            with httpx.Client(timeout=self.settings.request_timeout_seconds) as client:
                params = {
                    "namespace": self._static_namespace(),
                    "locale": self.settings.blizzard_locale,
                    f"name.{self.settings.blizzard_locale}": query_text,
                    "_pageSize": min(max(limit, 1), 100),
                    "_page": 1,
                    "orderby": "id",
                }
                payload, _headers = self._api_get(client, "/data/wow/search/item", params=params, fallback_query_token=True)
            items = [ItemSearchResult.model_validate(item.model_dump()) for item in self._normalize_search_results(payload)]
            self.mark_success()
            return items[:limit]
        except Exception as exc:  # pragma: no cover - network failure path
            self.mark_failure(f"Metadata lookup failed: {exc}")
            return []

    def fetch_item(self, item_id: int) -> ItemRead | None:
        available, message = self.is_available()
        if not available:
            logger.info("Skipping Blizzard metadata fetch: %s", message)
            return None

        try:
            with httpx.Client(timeout=self.settings.request_timeout_seconds) as client:
                payload, _headers = self._api_get(
                    client,
                    f"/data/wow/item/{item_id}",
                    params={
                        "namespace": self._static_namespace(),
                        "locale": self.settings.blizzard_locale,
                    },
                )
                media_payload = None
                try:
                    media_payload, _media_headers = self._api_get(
                        client,
                        f"/data/wow/media/item/{item_id}",
                        params={
                            "namespace": self._static_namespace(),
                            "locale": self.settings.blizzard_locale,
                        },
                    )
                except httpx.HTTPStatusError as exc:
                    if exc.response.status_code != 404:
                        raise
                item = self._normalize_item(payload, media_payload)
                if item is None:
                    self.mark_failure(f"Metadata fetch returned no normalized item for item_id={item_id}.")
                    return None
            self.mark_success()
            return item
        except Exception as exc:  # pragma: no cover - network failure path
            self.mark_failure(f"Metadata fetch failed: {exc}")
            return None

    def _normalize_search_results(self, payload: Any) -> list[ItemRead]:
        if not isinstance(payload, dict):
            return []

        results = payload.get("results")
        if not isinstance(results, list):
            return []

        normalized: list[ItemRead] = []
        for entry in results:
            if not isinstance(entry, dict):
                continue
            data = entry.get("data") if isinstance(entry.get("data"), dict) else entry
            item = self._normalize_item(data, None, source="blizzard_search")
            if item is not None:
                normalized.append(item)
        return normalized

    def _normalize_item(self, payload: Any, media_payload: Any | None, *, source: str = "blizzard_metadata") -> ItemRead | None:
        if not isinstance(payload, dict):
            return None

        item_id = self._extract_int(payload, "id")
        name = self._extract_localized(payload.get("name"))
        if item_id is None or not name:
            return None

        class_name = self._extract_localized_from_mapping(payload.get("item_class"))
        subclass_name = self._extract_localized_from_mapping(payload.get("item_subclass"))
        quality = self._extract_localized_from_mapping(payload.get("quality"))
        icon_url = self._extract_icon_url(media_payload)
        is_commodity = self._infer_commodity(payload)

        metadata_json = {
            "source": source,
            "metadata_status": "cached",
            "blizzard_item_class_id": self._extract_nested_int(payload, "item_class", "id"),
            "blizzard_item_subclass_id": self._extract_nested_int(payload, "item_subclass", "id"),
            "blizzard_inventory_type": self._extract_localized_from_mapping(payload.get("inventory_type")),
            "media_collected": bool(icon_url),
        }

        return ItemRead(
            item_id=item_id,
            name=name,
            class_name=class_name,
            subclass_name=subclass_name,
            quality=quality,
            icon_url=icon_url,
            metadata_json=metadata_json,
            metadata_updated_at=None,
            is_commodity=is_commodity,
        )

    def _infer_commodity(self, payload: dict[str, Any]) -> bool:
        item_class_name = (self._extract_localized_from_mapping(payload.get("item_class")) or "").strip().lower()
        return item_class_name == "commodity"

    def _extract_icon_url(self, payload: Any) -> str | None:
        if not isinstance(payload, dict):
            return None

        assets = payload.get("assets")
        if isinstance(assets, list):
            preferred_url = None
            for asset in assets:
                if not isinstance(asset, dict):
                    continue
                value = asset.get("value")
                if not isinstance(value, str) or not value.strip():
                    continue
                if asset.get("key") == "icon":
                    return value.strip()
                if preferred_url is None:
                    preferred_url = value.strip()
            return preferred_url
        return None

    def _extract_localized_from_mapping(self, value: Any) -> str | None:
        if isinstance(value, dict):
            return self._extract_localized(value.get("name"))
        return None

    def _extract_localized(self, value: Any) -> str | None:
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

    def _extract_nested_int(self, payload: dict[str, Any], key: str, nested_key: str) -> int | None:
        value = payload.get(key)
        if isinstance(value, dict):
            return self._extract_int(value, nested_key)
        return None

    def _extract_int(self, payload: dict[str, Any], key: str) -> int | None:
        value = payload.get(key)
        if value is None or value == "":
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def _api_get(
        self,
        client: httpx.Client,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        fallback_query_token: bool = False,
    ) -> tuple[Any, httpx.Headers]:
        token = self._get_access_token(client)
        response = client.get(
            f"{self._api_base_url()}{path}",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )
        response.raise_for_status()
        payload = response.json()

        # Blizzard's item search endpoint has been reported to occasionally
        # return empty results when the token is only sent as a header.
        if fallback_query_token and isinstance(payload, dict) and payload.get("results") == []:
            params_with_token = dict(params or {})
            params_with_token["access_token"] = token
            retry = client.get(f"{self._api_base_url()}{path}", params=params_with_token)
            retry.raise_for_status()
            return retry.json(), retry.headers

        return payload, response.headers

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

    def _static_namespace(self) -> str:
        return f"static-{self.settings.blizzard_api_region.lower()}"
