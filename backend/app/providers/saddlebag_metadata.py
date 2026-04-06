from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import Settings
from app.providers.base import ItemMetadataProvider
from app.schemas.item import ItemRead, ItemSearchResult
from app.schemas.saddlebag import NormalizedSaddlebagItem, WoWItemDataParams, WoWItemNamesParams


logger = logging.getLogger(__name__)


class SaddlebagPublicMetadataProvider(ItemMetadataProvider):
    name = "saddlebag_public_metadata"
    supports_live_fetch = True

    def __init__(self, settings: Settings) -> None:
        super().__init__()
        self.settings = settings

    def is_available(self) -> tuple[bool, str]:
        if not self.settings.saddlebag_metadata_url:
            return False, "No Saddlebag WoW metadata API base URL is configured."
        if self.last_error:
            return False, self.last_error
        return True, "Configured for live Saddlebag WoW metadata lookups."

    def search_items(self, query: str, limit: int = 25) -> list[ItemSearchResult]:
        available, message = self.is_available()
        if not available:
            logger.info("Skipping metadata lookup: %s", message)
            return []

        query_text = query.strip().lower()
        if not query_text:
            return []

        try:
            if query_text.isdigit():
                item = self.fetch_item(int(query_text))
                if item is None:
                    return []
                return [ItemSearchResult.model_validate(item.model_dump())]

            payload = WoWItemNamesParams(
                item_ids=[],
                return_all=False,
                pets=False,
                use_db=True,
            )
            response_payload = self._post("/api/wow/itemnames", payload.model_dump(exclude_none=True))
            items = self._normalize_items(response_payload, context="/api/wow/itemnames")
            matches = [
                ItemSearchResult.model_validate(item.model_dump())
                for item in items
                if query_text in item.name.lower()
            ]
            self.mark_success()
            return matches[:limit]
        except Exception as exc:  # pragma: no cover - network failure path
            self.mark_failure(f"Metadata lookup failed: {exc}")
            return []

    def fetch_item(self, item_id: int) -> ItemRead | None:
        available, message = self.is_available()
        if not available:
            logger.info("Skipping metadata fetch: %s", message)
            return None

        try:
            payload = WoWItemDataParams(item_ids=[item_id])
            response_payload = self._post("/api/wow/itemdata", payload.model_dump())
            items = self._normalize_items(response_payload, context="/api/wow/itemdata")
            for item in items:
                if item.item_id == item_id:
                    self.mark_success()
                    return self._to_item(item)

            # Fall back to itemnames when itemdata does not yield a rich record.
            names_payload = WoWItemNamesParams(item_ids=[item_id], return_all=False, pets=False, use_db=True)
            names_response = self._post("/api/wow/itemnames", names_payload.model_dump(exclude_none=True))
            names = self._normalize_items(names_response, context="/api/wow/itemnames")
            for item in names:
                if item.item_id == item_id:
                    self.mark_success()
                    return self._to_item(item)

            self.mark_failure(f"Metadata fetch returned no normalized item for item_id={item_id}.")
            return None
        except Exception as exc:  # pragma: no cover - network failure path
            self.mark_failure(f"Metadata fetch failed: {exc}")
            return None

    def _post(self, path: str, payload: dict[str, Any]) -> Any:
        endpoint = self._build_endpoint(path)
        with httpx.Client(timeout=self.settings.request_timeout_seconds) as client:
            response = client.post(endpoint, json=payload)
            response.raise_for_status()
        return response.json()

    def _build_endpoint(self, path: str) -> str:
        base = self.settings.saddlebag_metadata_url.rstrip("/")
        if base.endswith("/api/wow"):
            trimmed = path.removeprefix("/api/wow")
            return f"{base}{trimmed}"
        return f"{base}{path}"

    def _normalize_items(self, payload: Any, *, context: str) -> list[NormalizedSaddlebagItem]:
        items: list[NormalizedSaddlebagItem] = []
        for raw in self._extract_records(payload):
            normalized = self._normalize_item_record(raw)
            if normalized is not None:
                items.append(normalized)

        if not items and payload is not None:
            logger.warning("%s returned an unexpected metadata payload shape from %s", self.name, context)
        return items

    def _extract_records(self, payload: Any) -> list[dict[str, Any]]:
        if isinstance(payload, list):
            return [entry for entry in payload if isinstance(entry, dict)]

        if isinstance(payload, dict):
            for key in ("data", "results", "items", "itemData", "itemNames"):
                value = payload.get(key)
                if isinstance(value, list):
                    return [entry for entry in value if isinstance(entry, dict)]
                if isinstance(value, dict) and self._looks_like_item(value):
                    return [value]
            if self._looks_like_item(payload):
                return [payload]

        return []

    def _normalize_item_record(self, payload: dict[str, Any]) -> NormalizedSaddlebagItem | None:
        item_id = self._first_int(
            payload,
            "itemID",
            "item_id",
            "id",
        )
        name = self._first_str(
            payload,
            "name",
            "itemName",
            "item_name",
        )
        if item_id is None or not name:
            return None

        class_name = self._first_str(
            payload,
            "itemClassName",
            "item_class_name",
            "class_name",
            "itemClass",
            "item_class",
        )
        subclass_name = self._first_str(
            payload,
            "itemSubClassName",
            "item_subclass_name",
            "subclass_name",
            "itemSubClass",
            "item_subclass",
        )
        quality = self._first_str(payload, "quality", "itemQualityName", "item_quality_name")
        icon_url = self._first_str(payload, "icon", "icon_url", "iconUrl")
        commodity_hint = self._first_str(payload, "auctionCategory", "auction_category")
        is_commodity = bool(payload.get("is_commodity", False))
        if class_name and class_name.strip().lower() == "commodity":
            is_commodity = True
        if commodity_hint and commodity_hint.strip().lower() == "commodity":
            is_commodity = True

        return NormalizedSaddlebagItem(
            item_id=item_id,
            name=name,
            class_name=class_name,
            subclass_name=subclass_name,
            quality=quality,
            icon_url=icon_url,
            is_commodity=is_commodity,
            metadata_json=payload,
        )

    def _looks_like_item(self, payload: dict[str, Any]) -> bool:
        return any(key in payload for key in ("itemID", "item_id", "id")) and any(
            key in payload for key in ("name", "itemName", "item_name")
        )

    def _first_int(self, payload: dict[str, Any], *keys: str) -> int | None:
        for key in keys:
            value = payload.get(key)
            if value is None or value == "":
                continue
            try:
                return int(value)
            except (TypeError, ValueError):
                continue
        return None

    def _first_str(self, payload: dict[str, Any], *keys: str) -> str | None:
        for key in keys:
            value = payload.get(key)
            if value is None:
                continue
            text = str(value).strip()
            if text:
                return text
        return None

    def _to_item(self, item: NormalizedSaddlebagItem) -> ItemRead:
        return ItemRead(
            item_id=item.item_id,
            name=item.name,
            class_name=item.class_name,
            subclass_name=item.subclass_name,
            quality=item.quality,
            icon_url=item.icon_url,
            metadata_json=item.metadata_json,
            metadata_updated_at=None,
            is_commodity=item.is_commodity,
        )
