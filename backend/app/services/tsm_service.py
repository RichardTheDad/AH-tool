from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.core.config import Settings


logger = logging.getLogger(__name__)


class TsmMarketService:
    AUTH_URL = "https://auth.tradeskillmaster.com/oauth2/token"
    PRICING_API_BASE_URL = "https://pricing-api.tradeskillmaster.com"
    CLIENT_ID = "c260f00d-1071-409a-992f-dda2e5498536"
    SCOPE = "app:realm-api app:pricing-api"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._access_token: str | None = None
        self._access_token_expires_at: datetime | None = None

    def is_available(self) -> tuple[bool, str]:
        if not self.settings.tsm_api_key:
            return False, "No TSM API key is configured."
        region_id = self._resolve_region_id()
        if region_id is None:
            return False, "TSM region ID is not configured and could not be inferred from the Blizzard region."
        return True, f"Configured for TSM region market stats (region {region_id})."

    def fetch_region_item_stats(self, item_id: int) -> tuple[dict[str, float | None] | None, str]:
        available, message = self.is_available()
        if not available:
            return None, message

        region_id = self._resolve_region_id()
        assert region_id is not None

        try:
            with httpx.Client(timeout=self.settings.request_timeout_seconds) as client:
                token = self._get_access_token(client)
                response = client.get(
                    f"{self.PRICING_API_BASE_URL}/region/{region_id}/item/{item_id}",
                    headers={"Authorization": f"Bearer {token}"},
                )
                response.raise_for_status()
                payload = response.json()
            normalized = self._normalize_region_stats(payload)
            if not normalized:
                return None, "TSM returned no recognized region stats for this item."
            return normalized, "TSM region market stats loaded."
        except Exception as exc:  # pragma: no cover - network failure path
            logger.warning("TSM market stats lookup failed for item %s: %s", item_id, exc)
            return None, f"TSM market stats lookup failed: {exc}"

    def _resolve_region_id(self) -> int | None:
        if self.settings.tsm_region_id is not None:
            return self.settings.tsm_region_id

        region = self.settings.blizzard_api_region.strip().lower()
        if region == "us":
            return 1
        if region == "eu":
            return 2
        return None

    def _get_access_token(self, client: httpx.Client) -> str:
        now = datetime.now(timezone.utc)
        if self._access_token and self._access_token_expires_at and self._access_token_expires_at > now + timedelta(seconds=60):
            return self._access_token

        response = client.post(
            self.AUTH_URL,
            json={
                "client_id": self.CLIENT_ID,
                "grant_type": "api_token",
                "scope": self.SCOPE,
                "token": self.settings.tsm_api_key,
            },
        )
        response.raise_for_status()
        payload = response.json()
        token = payload.get("access_token")
        expires_in = int(payload.get("expires_in", 0) or 0)
        if not token or expires_in <= 0:
            raise ValueError("TSM auth response was missing access_token or expires_in.")

        self._access_token = str(token)
        self._access_token_expires_at = now + timedelta(seconds=expires_in)
        return self._access_token

    def _normalize_region_stats(self, payload: Any) -> dict[str, float | None] | None:
        flat = self._flatten(payload)
        if not flat:
            return None

        stats = {
            "db_region_market_avg": self._pick_numeric(flat, ["dbregionmarketavg", "regionmarketvalueavg", "marketvalue", "marketavg"]),
            "db_region_historical": self._pick_numeric(flat, ["dbregionhistorical", "historicalprice", "historical"]),
            "db_region_sale_avg": self._pick_numeric(flat, ["dbregionsaleavg", "regionsaleavg", "saleavg"]),
            "db_region_sale_rate": self._pick_numeric(flat, ["dbregionsalerate", "regionsalerate", "salerate"]),
            "db_region_sold_per_day": self._pick_numeric(flat, ["dbregionsoldperday", "regionavgdailysold", "soldperday"]),
        }

        if not any(value is not None for value in stats.values()):
            return None
        return stats

    def _flatten(self, payload: Any, prefix: str = "") -> dict[str, float]:
        values: dict[str, float] = {}
        if isinstance(payload, dict):
            for key, value in payload.items():
                next_prefix = f"{prefix}{key}".lower().replace("_", "")
                if isinstance(value, dict):
                    values.update(self._flatten(value, f"{next_prefix}."))
                    values[next_prefix] = values.get(next_prefix)  # no-op to keep mypy calm
                    values.pop(next_prefix, None)
                else:
                    number = self._to_float(value)
                    if number is not None:
                        values[next_prefix] = number
        return values

    def _pick_numeric(self, flat: dict[str, float], candidates: list[str]) -> float | None:
        normalized_candidates = [candidate.lower().replace("_", "") for candidate in candidates]
        for key, value in flat.items():
            compact_key = key.replace(".", "")
            for candidate in normalized_candidates:
                if compact_key.endswith(candidate):
                    return value
        return None

    def _to_float(self, value: Any) -> float | None:
        if value is None or value == "":
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None
