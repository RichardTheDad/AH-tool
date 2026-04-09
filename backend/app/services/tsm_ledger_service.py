from __future__ import annotations

import csv
import logging
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from io import StringIO
from pathlib import Path
from typing import Iterable

from app.core.config import Settings


logger = logging.getLogger(__name__)

_LEDGER_BLOCK_PATTERN = re.compile(
    r'\["r@(?P<realm>[^@]+)@internalData@csv(?P<kind>Sales|Buys|Cancelled|Expired)"\]\s=\s"(?P<value>(?:\\.|[^"\\])*)"'
)
_ITEM_ID_PATTERN = re.compile(r"i:(\d+)")


@dataclass(frozen=True)
class LedgerRow:
    realm: str
    row: dict[str, str]


@dataclass(frozen=True)
class LedgerSnapshot:
    path: str
    rows_by_kind: dict[str, tuple[LedgerRow, ...]]


class TsmLedgerService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def is_available(self) -> tuple[bool, str]:
        paths = self._resolve_savedvariables_paths()
        if not paths:
            return False, "No local TSM SavedVariables ledger file was found."
        try:
            snapshots = self._load_snapshots(paths)
        except Exception as exc:
            logger.warning("Failed to load local TSM ledger data: %s", exc)
            return False, f"Local TSM ledger data could not be read: {exc}"
        if not any(any(snapshot.rows_by_kind.values()) for snapshot in snapshots):
            return False, "Local TSM SavedVariables file was found, but it contained no ledger CSV rows."
        return True, f"Local TSM ledger data detected across {len(paths)} file(s)."

    def fetch_item_ledger(self, item_id: int, realms: list[str] | None = None) -> tuple[dict[str, object] | None, str]:
        paths = self._resolve_savedvariables_paths()
        if not paths:
            return None, "No local TSM SavedVariables ledger file was found."

        snapshots = self._load_snapshots(paths)
        return self._fetch_item_ledger_from_snapshots(snapshots, item_id, realms)

    def fetch_item_ledgers(self, item_ids: list[int], realms: list[str] | None = None) -> tuple[dict[int, dict[str, object]], str]:
        paths = self._resolve_savedvariables_paths()
        if not paths:
            return {}, "No local TSM SavedVariables ledger file was found."

        snapshots = self._load_snapshots(paths)
        summaries = {
            item_id: summary
            for item_id, summary in (
                (item_id, self._fetch_item_ledger_from_snapshots(snapshots, item_id, realms)[0]) for item_id in item_ids
            )
            if summary is not None
        }
        if not summaries:
            return {}, "Local TSM ledger has no matching history for the requested items."
        return summaries, "Local TSM ledger history loaded."

    def _fetch_item_ledger_from_snapshots(
        self,
        snapshots: list[LedgerSnapshot],
        item_id: int,
        realms: list[str] | None = None,
    ) -> tuple[dict[str, object] | None, str]:
        realm_filter = {realm.lower() for realm in (realms or [])}

        sales = self._collect_rows(snapshots, "sales", item_id, realm_filter)
        buys = self._collect_rows(snapshots, "buys", item_id, realm_filter)
        cancelled = self._collect_rows(snapshots, "cancelled", item_id, realm_filter)
        expired = self._collect_rows(snapshots, "expired", item_id, realm_filter)

        auction_sales = [entry for entry in sales if self._normalize_source(entry.row.get("source")) == "auction"]
        auction_buys = [entry for entry in buys if self._normalize_source(entry.row.get("source")) == "auction"]

        if not any((sales, buys, cancelled, expired)):
            return None, f"Local TSM ledger has no matching history for item {item_id}."

        summary = self._build_summary(auction_sales, auction_buys, cancelled, expired)
        return summary, "Local TSM ledger history loaded."

    def _build_summary(
        self,
        auction_sales: list[LedgerRow],
        auction_buys: list[LedgerRow],
        cancelled: list[LedgerRow],
        expired: list[LedgerRow],
    ) -> dict[str, object]:
        recent_sales = [
            {
                "realm": entry.realm,
                "quantity": self._to_int(entry.row.get("quantity")),
                "price": self._to_float(entry.row.get("price")),
                "other_player": entry.row.get("otherPlayer") or None,
                "player": entry.row.get("player") or None,
                "time": self._to_iso(entry.row.get("time")),
                "source": entry.row.get("source") or None,
            }
            for entry in sorted(auction_sales, key=lambda row: self._to_int(row.row.get("time")) or 0, reverse=True)[:8]
        ]

        return {
            "auction_sale_count": len(auction_sales),
            "auction_units_sold": sum(self._to_int(entry.row.get("quantity")) or 0 for entry in auction_sales),
            "auction_avg_unit_sale_price": self._average(self._to_float(entry.row.get("price")) for entry in auction_sales),
            "last_auction_sale_at": self._latest_iso(auction_sales),
            "auction_buy_count": len(auction_buys),
            "auction_units_bought": sum(self._to_int(entry.row.get("quantity")) or 0 for entry in auction_buys),
            "auction_avg_unit_buy_price": self._average(self._to_float(entry.row.get("price")) for entry in auction_buys),
            "last_auction_buy_at": self._latest_iso(auction_buys),
            "cancel_count": len(cancelled),
            "expired_count": len(expired),
            "last_cancel_at": self._latest_iso(cancelled),
            "last_expired_at": self._latest_iso(expired),
            "recent_sales": recent_sales,
        }

    def _collect_rows(
        self,
        snapshots: list[LedgerSnapshot],
        kind: str,
        item_id: int,
        realm_filter: set[str],
    ) -> list[LedgerRow]:
        matches: list[LedgerRow] = []
        seen_keys: set[tuple[str, str | None, str | None, str | None]] = set()
        for snapshot in snapshots:
            for entry in snapshot.rows_by_kind.get(kind, ()):
                if realm_filter and entry.realm.lower() not in realm_filter:
                    continue
                row_item_id = self._extract_item_id(entry.row.get("itemString", ""))
                if row_item_id != item_id:
                    continue
                dedupe_key = (
                    entry.realm.lower(),
                    entry.row.get("itemString"),
                    entry.row.get("time"),
                    entry.row.get("price") or entry.row.get("quantity"),
                )
                if dedupe_key in seen_keys:
                    continue
                seen_keys.add(dedupe_key)
                matches.append(entry)
        return matches

    def _load_snapshots(self, paths: Iterable[Path]) -> list[LedgerSnapshot]:
        snapshots: list[LedgerSnapshot] = []
        for path in paths:
            snapshots.append(_load_snapshot(str(path), path.stat().st_mtime_ns))
        return snapshots

    def _resolve_savedvariables_paths(self) -> list[Path]:
        configured = self.settings.tsm_savedvariables_path.strip()
        if configured:
            path = Path(configured)
            if path.is_file() and path.exists():
                return [path]
            if path.is_dir():
                matches = sorted(path.rglob("TradeSkillMaster.lua"))
                return [candidate for candidate in matches if candidate.exists() and not candidate.name.endswith(".bak")]
            return []

        candidates: list[Path] = []
        for env_name in ("ProgramFiles(x86)", "ProgramFiles"):
            base = os.environ.get(env_name)
            if not base:
                continue
            wow_root = Path(base) / "World of Warcraft"
            for retail_path in [wow_root / "_retail_", wow_root / "_retail_ptr_", wow_root / "_beta_"]:
                account_root = retail_path / "WTF" / "Account"
                if account_root.exists():
                    for account_dir in account_root.iterdir():
                        candidate = account_dir / "SavedVariables" / "TradeSkillMaster.lua"
                        if candidate.exists():
                            candidates.append(candidate)

        candidates.append(Path(r"C:\Program Files (x86)\World of Warcraft\_retail_\WTF\Account\306726404#1\SavedVariables\TradeSkillMaster.lua"))
        unique_candidates = []
        seen: set[str] = set()
        for candidate in candidates:
            candidate_str = str(candidate)
            if candidate.exists() and candidate_str not in seen and not candidate.name.endswith(".bak"):
                unique_candidates.append(candidate)
                seen.add(candidate_str)
        return unique_candidates

    def _extract_item_id(self, item_string: str) -> int | None:
        match = _ITEM_ID_PATTERN.search(item_string)
        return int(match.group(1)) if match else None

    def _normalize_source(self, source: str | None) -> str:
        return (source or "").strip().lower()

    def _to_int(self, value: str | None) -> int | None:
        if not value:
            return None
        try:
            return int(value)
        except ValueError:
            return None

    def _to_float(self, value: str | None) -> float | None:
        if not value:
            return None
        try:
            return float(value)
        except ValueError:
            return None

    def _to_iso(self, value: str | None) -> str | None:
        timestamp = self._to_int(value)
        if not timestamp:
            return None
        return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()

    def _latest_iso(self, rows: list[LedgerRow]) -> str | None:
        timestamps = [self._to_int(entry.row.get("time")) for entry in rows]
        valid = [stamp for stamp in timestamps if stamp]
        if not valid:
            return None
        return datetime.fromtimestamp(max(valid), tz=timezone.utc).isoformat()

    def _average(self, values) -> float | None:
        cleaned = [value for value in values if value is not None]
        if not cleaned:
            return None
        return sum(cleaned) / len(cleaned)


def _decode_lua_string(raw: str) -> str:
    return (
        raw.replace(r"\\", "\\")
        .replace(r"\"", '"')
        .replace(r"\n", "\n")
        .replace(r"\r", "\r")
        .replace(r"\t", "\t")
    )


@lru_cache(maxsize=4)
def _load_snapshot(path_str: str, mtime_ns: int | None = None) -> LedgerSnapshot:
    path = Path(path_str)
    if mtime_ns is None:
        mtime_ns = path.stat().st_mtime_ns
    del mtime_ns

    text = path.read_text(encoding="utf-8")
    rows_by_kind: dict[str, list[LedgerRow]] = {
        "sales": [],
        "buys": [],
        "cancelled": [],
        "expired": [],
    }

    for match in _LEDGER_BLOCK_PATTERN.finditer(text):
        kind = match.group("kind").lower()
        decoded = _decode_lua_string(match.group("value"))
        reader = csv.DictReader(StringIO(decoded))
        for row in reader:
            rows_by_kind[kind].append(LedgerRow(realm=match.group("realm"), row=row))

    return LedgerSnapshot(
        path=path_str,
        rows_by_kind={kind: tuple(rows) for kind, rows in rows_by_kind.items()},
    )
