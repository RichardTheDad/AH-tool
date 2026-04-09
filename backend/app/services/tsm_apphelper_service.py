from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Iterable

from app.core.config import Settings


logger = logging.getLogger(__name__)

_RELEVANT_TAGS = {
    "AUCTIONDB_REGION_STAT",
    "AUCTIONDB_REGION_HISTORICAL",
    "AUCTIONDB_REGION_SALE",
    "AUCTIONDB_NON_COMMODITY_DATA",
    "AUCTIONDB_NON_COMMODITY_HISTORICAL",
}
_LINE_PATTERN = re.compile(
    r'LoadData\("(?P<tag>[^"]+)","(?P<scope>[^"]+)",\[\[return \{downloadTime=(?P<download>\d+),fields=\{(?P<fields>[^}]*)\},data=\{(?P<data>.*)\}\}\]\]\)$'
)
_FIELD_PATTERN = re.compile(r'"([^"]+)"')
_ENTRY_PATTERN = re.compile(r'\{"?([^,"]+)"?,([^}]*)\}')


@dataclass(frozen=True)
class AppHelperDataset:
    download_time: int
    fields: tuple[str, ...]
    item_lookup: dict[str, tuple[str, ...]]

    def get_value(self, item_id: int, field_name: str) -> float | None:
        if field_name not in self.fields:
            return None

        item_key = f"i:{item_id}"
        values = self.item_lookup.get(item_key)
        if values is None:
            return None

        field_index = self.fields.index(field_name)
        if field_index >= len(values):
            return None
        return _decode_tsm_base32(values[field_index])


@dataclass(frozen=True)
class AppHelperSnapshot:
    path: str
    datasets: dict[str, dict[str, AppHelperDataset]]

    def get_dataset(self, tag: str, scope: str) -> AppHelperDataset | None:
        return self.datasets.get(tag, {}).get(scope.lower())


class TsmAppHelperService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def is_available(self) -> tuple[bool, str]:
        paths = self._resolve_apphelper_paths()
        if not paths:
            return False, "No local TSM AppHelper AuctionDB file was found."

        try:
            snapshots = self._load_snapshots(paths)
        except Exception as exc:
            logger.warning("Failed to load local TSM AppHelper data: %s", exc)
            return False, f"Local TSM AppHelper data could not be read: {exc}"

        if not any(snapshot.datasets for snapshot in snapshots):
            return False, "Local TSM AppHelper data file was found, but it contained no AuctionDB blocks."
        return True, f"Local TSM AppHelper AuctionDB data detected across {len(paths)} file(s)."

    def fetch_region_item_stats(self, item_id: int) -> tuple[dict[str, float | None] | None, str]:
        paths = self._resolve_apphelper_paths()
        if not paths:
            return None, "No local TSM AppHelper AuctionDB file was found."

        scope = self.settings.blizzard_api_region.strip().upper() or "US"
        snapshots = self._load_snapshots(paths)
        region_stat = self._select_dataset(snapshots, "AUCTIONDB_REGION_STAT", scope)
        region_historical = self._select_dataset(snapshots, "AUCTIONDB_REGION_HISTORICAL", scope)
        region_sale = self._select_dataset(snapshots, "AUCTIONDB_REGION_SALE", scope)

        stats = {
            "db_region_market_avg": region_stat.get_value(item_id, "regionMarketValue") if region_stat else None,
            "db_region_historical": region_historical.get_value(item_id, "regionHistorical") if region_historical else None,
            "db_region_sale_avg": region_sale.get_value(item_id, "regionSale") if region_sale else None,
            "db_region_sale_rate": _scale_thousandths(region_sale.get_value(item_id, "regionSalePercent")) if region_sale else None,
            "db_region_sold_per_day": _scale_thousandths(region_sale.get_value(item_id, "regionSoldPerDay")) if region_sale else None,
        }
        if not any(value is not None for value in stats.values()):
            return None, f"Local TSM AppHelper has no region market stats for item {item_id}."
        return stats, "Local TSM AppHelper region market stats loaded from local AuctionDB data."

    def fetch_realm_item_stats(self, item_id: int, realm: str) -> tuple[dict[str, float | None] | None, str]:
        paths = self._resolve_apphelper_paths()
        if not paths:
            return None, "No local TSM AppHelper AuctionDB file was found."

        snapshots = self._load_snapshots(paths)
        realm_data = self._select_dataset(snapshots, "AUCTIONDB_NON_COMMODITY_DATA", realm)
        realm_historical = self._select_dataset(snapshots, "AUCTIONDB_NON_COMMODITY_HISTORICAL", realm)
        stats = {
            "realm": realm,
            "min_buyout": realm_data.get_value(item_id, "minBuyout") if realm_data else None,
            "num_auctions": realm_data.get_value(item_id, "numAuctions") if realm_data else None,
            "market_value_recent": realm_data.get_value(item_id, "marketValueRecent") if realm_data else None,
            "historical": realm_historical.get_value(item_id, "historical") if realm_historical else None,
        }
        if not any(value is not None for key, value in stats.items() if key != "realm"):
            return None, f"Local TSM AppHelper has no realm market stats for item {item_id} on {realm}."
        return stats, f"Local TSM AppHelper realm market stats loaded for {realm}."

    def _load_snapshots(self, paths: Iterable[Path]) -> list[AppHelperSnapshot]:
        snapshots: list[AppHelperSnapshot] = []
        for path in paths:
            snapshots.append(_load_snapshot(str(path), path.stat().st_mtime_ns))
        return snapshots

    def _select_dataset(self, snapshots: list[AppHelperSnapshot], tag: str, scope: str) -> AppHelperDataset | None:
        selected: AppHelperDataset | None = None
        for snapshot in snapshots:
            dataset = snapshot.get_dataset(tag, scope)
            if dataset is None:
                continue
            if selected is None or dataset.download_time > selected.download_time:
                selected = dataset
        return selected

    def _resolve_apphelper_paths(self) -> list[Path]:
        configured = self.settings.tsm_apphelper_path.strip()
        if configured:
            path = Path(configured)
            if path.is_file() and path.exists():
                return [path]
            if path.is_dir():
                matches = sorted(path.rglob("AppData.lua"))
                return [candidate for candidate in matches if candidate.exists()]
            return []

        candidates: list[Path] = []
        for env_name in ("ProgramFiles(x86)", "ProgramFiles"):
            base = os.environ.get(env_name)
            if not base:
                continue
            base_path = Path(base) / "World of Warcraft"
            for retail_path in [base_path / "_retail_", base_path / "_retail_ptr_", base_path / "_beta_"]:
                candidates.append(retail_path / "Interface" / "AddOns" / "TradeSkillMaster_AppHelper" / "AppData.lua")

        candidates.append(Path(r"C:\Program Files (x86)\World of Warcraft\_retail_\Interface\AddOns\TradeSkillMaster_AppHelper\AppData.lua"))
        unique_candidates = []
        seen: set[str] = set()
        for candidate in candidates:
            candidate_str = str(candidate)
            if candidate.exists() and candidate_str not in seen:
                unique_candidates.append(candidate)
                seen.add(candidate_str)
        return unique_candidates


def _scale_thousandths(value: float | None) -> float | None:
    if value is None:
        return None
    return value / 1000.0


def _normalize_item_key(raw: str) -> str:
    raw = raw.strip()
    if raw.isdigit():
        return f"i:{raw}"
    return raw


def _decode_tsm_base32(value: str) -> float | None:
    normalized = value.strip()
    if not normalized:
        return None
    try:
        if len(normalized) > 6:
            return float(int(normalized[-6:], 32) + (int(normalized[:-6], 32) * (2**30)))
        return float(int(normalized, 32))
    except ValueError:
        return None


@lru_cache(maxsize=4)
def _load_snapshot(path_str: str, mtime_ns: int | None = None) -> AppHelperSnapshot:
    path = Path(path_str)
    if mtime_ns is None:
        mtime_ns = path.stat().st_mtime_ns
    del mtime_ns

    datasets: dict[str, dict[str, AppHelperDataset]] = {}
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or "LoadData(" not in line:
                continue
            match = _LINE_PATTERN.search(line)
            if not match:
                continue
            tag = match.group("tag")
            if tag not in _RELEVANT_TAGS:
                continue

            scope = match.group("scope").lower()
            fields = tuple(_FIELD_PATTERN.findall(match.group("fields"))[1:])
            item_lookup: dict[str, tuple[str, ...]] = {}
            for entry_match in _ENTRY_PATTERN.finditer(match.group("data")):
                item_key = _normalize_item_key(entry_match.group(1))
                item_lookup[item_key] = tuple(part.strip() for part in entry_match.group(2).split(","))

            datasets.setdefault(tag, {})[scope] = AppHelperDataset(
                download_time=int(match.group("download")),
                fields=fields,
                item_lookup=item_lookup,
            )

    return AppHelperSnapshot(path=path_str, datasets=datasets)
