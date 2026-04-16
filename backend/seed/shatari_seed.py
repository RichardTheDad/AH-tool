"""
shatari_seed.py — Seed vendor_price and expansion data from shatari-data JSON files.

Updates existing items in the database with:
  - vendor_price (copper, integer): lowest vendor buy price for the item
  - expansion (integer): expansion number the item belongs to (1=Vanilla, 2=TBC, etc.)

Usage:
    python seed/shatari_seed.py --vendor path/to/vendor-items.json --expansion path/to/expansion-items.json

The database URL is read from AZEROTHFLIPLOCAL_DATABASE_URL environment variable,
or defaults to sqlite:///azerothfliplocal.db (local dev).

Only items already in the items table will be updated. Unknown item IDs are skipped.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

BATCH_SIZE = 500

DEFAULT_VENDOR_PATH = Path(__file__).parent.parent.parent / "shatari-data-master" / "vendor-items.json"
DEFAULT_EXPANSION_PATH = Path(__file__).parent.parent.parent / "shatari-data-master" / "expansion-items.json"


def _load_json(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _run_sqlite(db_url: str, vendor_map: dict[int, int], expansion_map: dict[int, int]) -> None:
    import sqlite3

    db_path = db_url.replace("sqlite:///", "")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Fetch all existing item_ids
    existing = {row[0] for row in cur.execute("SELECT item_id FROM items").fetchall()}
    print(f"Found {len(existing)} items in local SQLite DB.")

    vendor_updates: list[tuple[int, int]] = [
        (price, item_id) for item_id, price in vendor_map.items() if item_id in existing
    ]
    expansion_updates: list[tuple[int, int]] = [
        (exp, item_id) for item_id, exp in expansion_map.items() if item_id in existing
    ]

    for i in range(0, len(vendor_updates), BATCH_SIZE):
        batch = vendor_updates[i : i + BATCH_SIZE]
        cur.executemany("UPDATE items SET vendor_price = ? WHERE item_id = ?", batch)

    for i in range(0, len(expansion_updates), BATCH_SIZE):
        batch = expansion_updates[i : i + BATCH_SIZE]
        cur.executemany("UPDATE items SET expansion = ? WHERE item_id = ?", batch)

    conn.commit()
    conn.close()
    print(f"Updated vendor_price for {len(vendor_updates)} items.")
    print(f"Updated expansion for {len(expansion_updates)} items.")


def _run_postgres(db_url: str, vendor_map: dict[int, int], expansion_map: dict[int, int]) -> None:
    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        sys.exit("psycopg2-binary is not installed. Run: pip install psycopg2-binary")

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    cur.execute("SELECT item_id FROM items")
    existing = {row[0] for row in cur.fetchall()}
    print(f"Found {len(existing)} items in PostgreSQL DB.")

    vendor_updates: list[tuple[int, int]] = [
        (price, item_id) for item_id, price in vendor_map.items() if item_id in existing
    ]
    expansion_updates: list[tuple[int, int]] = [
        (exp, item_id) for item_id, exp in expansion_map.items() if item_id in existing
    ]

    for i in range(0, len(vendor_updates), BATCH_SIZE):
        batch = vendor_updates[i : i + BATCH_SIZE]
        psycopg2.extras.execute_batch(
            cur,
            "UPDATE items SET vendor_price = %s WHERE item_id = %s",
            batch,
            page_size=BATCH_SIZE,
        )

    for i in range(0, len(expansion_updates), BATCH_SIZE):
        batch = expansion_updates[i : i + BATCH_SIZE]
        psycopg2.extras.execute_batch(
            cur,
            "UPDATE items SET expansion = %s WHERE item_id = %s",
            batch,
            page_size=BATCH_SIZE,
        )

    conn.commit()
    cur.close()
    conn.close()
    print(f"Updated vendor_price for {len(vendor_updates)} items.")
    print(f"Updated expansion for {len(expansion_updates)} items.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed vendor_price and expansion from shatari-data JSON files.")
    parser.add_argument("--vendor", type=Path, default=DEFAULT_VENDOR_PATH, help="Path to vendor-items.json")
    parser.add_argument("--expansion", type=Path, default=DEFAULT_EXPANSION_PATH, help="Path to expansion-items.json")
    parser.add_argument("--db-url", default=os.environ.get("AZEROTHFLIPLOCAL_DATABASE_URL", "sqlite:///azerothfliplocal.db"))
    args = parser.parse_args()

    if not args.vendor.exists():
        sys.exit(f"vendor-items.json not found at: {args.vendor}\nPass --vendor <path>")
    if not args.expansion.exists():
        sys.exit(f"expansion-items.json not found at: {args.expansion}\nPass --expansion <path>")

    print(f"Loading vendor data from: {args.vendor}")
    raw_vendor = _load_json(args.vendor)
    # Each value is { "price": int, "npc": int, "npccount": int } — take lowest price per item_id
    vendor_map: dict[int, int] = {}
    for item_id_str, info in raw_vendor.items():
        try:
            item_id = int(item_id_str)
            price = int(info["price"])
            if price > 0:
                # Keep the lowest vendor price if somehow item appears multiple times
                if item_id not in vendor_map or price < vendor_map[item_id]:
                    vendor_map[item_id] = price
        except (KeyError, ValueError, TypeError):
            continue
    print(f"Loaded {len(vendor_map)} vendor price entries.")

    print(f"Loading expansion data from: {args.expansion}")
    raw_expansion = _load_json(args.expansion)
    expansion_map: dict[int, int] = {}
    for item_id_str, exp in raw_expansion.items():
        try:
            expansion_map[int(item_id_str)] = int(exp)
        except (ValueError, TypeError):
            continue
    print(f"Loaded {len(expansion_map)} expansion entries.")

    db_url = args.db_url
    print(f"Connecting to: {db_url[:40]}...")

    if db_url.startswith("sqlite"):
        _run_sqlite(db_url, vendor_map, expansion_map)
    else:
        _run_postgres(db_url, vendor_map, expansion_map)

    print("Done.")


if __name__ == "__main__":
    main()
