"""
seed_metadata.py — Upload item metadata from local SQLite to production PostgreSQL.

Usage:
    python seed/seed_metadata.py --source path/to/azerothfliplocal.db --target <supabase_url>

Or set AZEROTHFLIPLOCAL_DATABASE_URL in the environment to provide the target.
The source defaults to backend/azerothfliplocal.db if not specified.

Uses a bulk approach to avoid connection timeouts:
  1. Load all items from SQLite into memory.
  2. Fetch existing (item_id, name, metadata_json) from production in ONE query.
  3. Filter in-memory to only the rows worth uploading.
  4. Batch-insert in chunks of 500, letting the DB's ON CONFLICT clause
     skip any rows that are already richer in production.
"""

import argparse
import json
import os
import sys
from pathlib import Path

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    sys.exit("psycopg2-binary is not installed. Run: pip install psycopg2-binary")

try:
    import sqlite3
except ImportError:
    sys.exit("sqlite3 is required (standard library).")

BATCH_SIZE = 500


def _is_stub(name, metadata_json) -> bool:
    if name is None or "(metadata unavailable)" in name:
        if metadata_json is None:
            return True
    return False


def _load_sqlite(db_path: str) -> list[dict]:
    print(f"Reading items from: {db_path}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT item_id, name, class_name, subclass_name, quality, icon_url, "
        "metadata_json, metadata_updated_at, is_commodity FROM items"
    ).fetchall()
    conn.close()

    items = []
    for r in rows:
        meta = r["metadata_json"]
        if isinstance(meta, str):
            try:
                meta = json.loads(meta)
            except (json.JSONDecodeError, TypeError):
                meta = None
        items.append({
            "item_id": r["item_id"],
            "name": r["name"],
            "class_name": r["class_name"],
            "subclass_name": r["subclass_name"],
            "quality": r["quality"],
            "icon_url": r["icon_url"],
            "metadata_json": meta,
            "metadata_updated_at": r["metadata_updated_at"],
            "is_commodity": bool(r["is_commodity"]),
        })
    print(f"  Loaded {len(items):,} items from source.")
    return items


def _seed(target_url: str, items: list[dict], dry_run: bool) -> None:
    print(f"Connecting to target: {target_url[:50]}...")
    conn = psycopg2.connect(target_url)
    conn.autocommit = False
    cur = conn.cursor()

    # ── 1. Fetch existing items in one shot ─────────────────────────────────────
    cur.execute("SELECT COUNT(*) FROM items")
    existing_count = cur.fetchone()[0]
    print(f"  Production currently has {existing_count:,} items.")

    cur.execute("SELECT item_id, name, metadata_json FROM items")
    production = {}
    for row in cur.fetchall():
        production[row[0]] = {"name": row[1], "metadata_json": row[2]}

    # ── 2. Filter source items in-memory ────────────────────────────────────────
    to_upsert = []
    skipped = 0
    for item in items:
        iid = item["item_id"]
        src_name = item.get("name") or ""
        src_meta = item.get("metadata_json")

        # Skip stubs from source — nothing useful to contribute
        if _is_stub(src_name, src_meta):
            skipped += 1
            continue

        existing = production.get(iid)
        if existing:
            ex_name = existing["name"] or ""
            ex_meta = existing["metadata_json"]
            # Don't downgrade a well-resolved name
            if not _is_stub(ex_name, ex_meta) and _is_stub(src_name, src_meta):
                skipped += 1
                continue
            # Don't overwrite richer metadata with None
            if ex_meta is not None and src_meta is None:
                skipped += 1
                continue

        to_upsert.append(item)

    print(f"  Will upload {len(to_upsert):,} items, skip {skipped:,}.")

    if dry_run:
        cur.close()
        conn.close()
        return

    # ── 3. Batch upsert ─────────────────────────────────────────────────────────
    # %% in psycopg2 SQL = literal % character
    upsert_sql = """
        INSERT INTO items
            (item_id, name, class_name, subclass_name, quality, icon_url,
             metadata_json, metadata_updated_at, is_commodity)
        VALUES %s
        ON CONFLICT (item_id) DO UPDATE SET
            name               = EXCLUDED.name,
            class_name         = EXCLUDED.class_name,
            subclass_name      = EXCLUDED.subclass_name,
            quality            = EXCLUDED.quality,
            icon_url           = EXCLUDED.icon_url,
            metadata_json      = EXCLUDED.metadata_json,
            metadata_updated_at = EXCLUDED.metadata_updated_at,
            is_commodity       = EXCLUDED.is_commodity
        WHERE
            items.name LIKE '%%(metadata unavailable)'
            OR items.metadata_json IS NULL
    """

    done = 0
    for i in range(0, len(to_upsert), BATCH_SIZE):
        batch = to_upsert[i : i + BATCH_SIZE]
        values = [
            (
                r["item_id"],
                r["name"],
                r["class_name"],
                r["subclass_name"],
                r["quality"],
                r["icon_url"],
                json.dumps(r["metadata_json"]) if r["metadata_json"] is not None else None,
                r["metadata_updated_at"],
                r["is_commodity"],
            )
            for r in batch
        ]
        psycopg2.extras.execute_values(cur, upsert_sql, values, page_size=BATCH_SIZE)
        conn.commit()
        done += len(batch)
        print(f"  {done:,}/{len(to_upsert):,} committed...")

    cur.close()
    conn.close()
    print(f"\nUploaded {done:,} items to production.")


# ── entry point ─────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Seed item metadata from local SQLite to production PostgreSQL.")
    parser.add_argument("--source", default=None, help="Path to local SQLite .db file.")
    parser.add_argument("--target", default=None, help="Target PostgreSQL URL.")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing.")
    args = parser.parse_args()

    # Resolve source path
    source_path = args.source
    if source_path is None:
        default_path = Path(__file__).parent.parent / "azerothfliplocal.db"
        if not default_path.exists():
            sys.exit(f"No DB found at {default_path}. Pass --source path/to/azerothfliplocal.db")
        source_path = str(default_path)

    # Resolve target URL
    target_url = args.target or os.environ.get("AZEROTHFLIPLOCAL_DATABASE_URL")
    if not target_url:
        sys.exit("Pass --target <postgresql://...> or set AZEROTHFLIPLOCAL_DATABASE_URL.")

    if args.dry_run:
        print("DRY RUN — no changes will be written.\n")

    items = _load_sqlite(source_path)
    _seed(target_url, items, dry_run=args.dry_run)

    if args.dry_run:
        print("\nRe-run without --dry-run to apply changes.")
    else:
        print("Done. Item metadata has been seeded to production.")


if __name__ == "__main__":
    main()
