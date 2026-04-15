from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from itertools import islice

from sqlalchemy import and_, func, insert, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import AppSettings, Item, ListingSnapshot
from app.schemas.listing import ListingImportRow
from app.services.provider_service import get_provider_registry


logger = logging.getLogger(__name__)


def _chunked(values: list[dict], size: int):
    iterator = iter(values)
    while True:
        chunk = list(islice(iterator, size))
        if not chunk:
            break
        yield chunk


def ensure_item_record(session: Session, item_id: int, *, source_name: str) -> Item:
    item = session.get(Item, item_id)
    non_commodity_verified = source_name in {"blizzard_auctions", "blizzard_realm_discovery"}
    if item is None:
        item = Item(
            item_id=item_id,
            # This is an explicit missing-metadata label, not a fabricated name.
            name=f"Item {item_id} (metadata unavailable)",
            metadata_json={
                "source": source_name if non_commodity_verified else "unresolved_import",
                "metadata_status": "missing",
                "non_commodity_verified": non_commodity_verified,
            },
            metadata_updated_at=None,
            is_commodity=False,
        )
        session.add(item)
        session.flush()
        return item

    metadata = item.metadata_json if isinstance(item.metadata_json, dict) else {}
    if non_commodity_verified and not metadata.get("non_commodity_verified"):
        metadata = dict(metadata)
        metadata["non_commodity_verified"] = True
        if "source" not in metadata:
            metadata["source"] = source_name
        item.metadata_json = metadata
    return item


def ensure_item_records(session: Session, item_ids: list[int], *, source_name: str) -> None:
    unique_item_ids = sorted(set(item_ids))
    if not unique_item_ids:
        return

    chunk_size = 500
    existing_items: dict[int, Item] = {}
    for start in range(0, len(unique_item_ids), chunk_size):
        chunk = unique_item_ids[start : start + chunk_size]
        for item in session.query(Item).filter(Item.item_id.in_(chunk)).all():
            existing_items[item.item_id] = item

    non_commodity_verified = source_name in {"blizzard_auctions", "blizzard_realm_discovery"}
    missing_items: list[Item] = []
    for item_id in unique_item_ids:
        item = existing_items.get(item_id)
        if item is None:
            missing_items.append(
                Item(
                    item_id=item_id,
                    name=f"Item {item_id} (metadata unavailable)",
                    metadata_json={
                        "source": source_name if non_commodity_verified else "unresolved_import",
                        "metadata_status": "missing",
                        "non_commodity_verified": non_commodity_verified,
                    },
                    metadata_updated_at=None,
                    is_commodity=False,
                )
            )
            continue

        metadata = item.metadata_json if isinstance(item.metadata_json, dict) else {}
        if non_commodity_verified and not metadata.get("non_commodity_verified"):
            metadata = dict(metadata)
            metadata["non_commodity_verified"] = True
            if "source" not in metadata:
                metadata["source"] = source_name
            item.metadata_json = metadata

    if missing_items:
        session.add_all(missing_items)
        session.flush()


def snapshot_is_stale(snapshot: ListingSnapshot, settings: AppSettings) -> bool:
    stale_after = settings.stale_after_minutes if settings.stale_after_minutes is not None else 120
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=stale_after)
    captured_at = snapshot.captured_at
    if captured_at.tzinfo is None:
        captured_at = captured_at.replace(tzinfo=timezone.utc)
    return captured_at < cutoff


def mark_stale_snapshots(session: Session) -> int:
    app_settings = session.get(AppSettings, 1) or AppSettings(id=1)
    stale_after = app_settings.stale_after_minutes if app_settings.stale_after_minutes is not None else 120
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=stale_after)
    updated = 0
    updated += (
        session.query(ListingSnapshot)
        .filter(ListingSnapshot.captured_at < cutoff, ListingSnapshot.is_stale.is_(False))
        .update({ListingSnapshot.is_stale: True}, synchronize_session=False)
    )
    updated += (
        session.query(ListingSnapshot)
        .filter(ListingSnapshot.captured_at >= cutoff, ListingSnapshot.is_stale.is_(True))
        .update({ListingSnapshot.is_stale: False}, synchronize_session=False)
    )
    session.commit()
    return updated


def _snapshot_key(row: ListingImportRow, source_name: str) -> tuple[int, str, str, str]:
    captured_at = row.captured_at or datetime.now(timezone.utc)
    if captured_at.tzinfo is None:
        captured_at = captured_at.replace(tzinfo=timezone.utc)
    return (
        row.item_id,
        row.realm.casefold(),
        captured_at.astimezone(timezone.utc).isoformat(),
        source_name,
    )


def persist_listing_rows(session: Session, rows: list[ListingImportRow], source_name: str) -> tuple[int, int]:
    inserted = 0
    skipped_duplicates = 0
    seen_keys: set[tuple[int, str, str, str]] = set()
    payloads: list[dict] = []
    item_ids: list[int] = []

    for row in rows:
        row_key = _snapshot_key(row, source_name)
        if row_key in seen_keys:
            skipped_duplicates += 1
            continue

        seen_keys.add(row_key)
        captured_at = row.captured_at or datetime.now(timezone.utc)
        if captured_at.tzinfo is None:
            captured_at = captured_at.replace(tzinfo=timezone.utc)

        item_ids.append(row.item_id)
        payloads.append(
            {
                "item_id": row.item_id,
                "realm": row.realm,
                "lowest_price": row.lowest_price,
                "average_price": row.average_price,
                "quantity": row.quantity,
                "listing_count": row.listing_count,
                "source_name": source_name,
                "captured_at": captured_at,
                "is_stale": False,
            }
        )

    if not payloads:
        return inserted, skipped_duplicates

    ensure_item_records(session, item_ids, source_name=source_name)
    session.commit()

    is_postgres = not get_settings().database_url.startswith("sqlite")

    for chunk in _chunked(payloads, 1000):
        if is_postgres:
            stmt = (
                pg_insert(ListingSnapshot)
                .values(chunk)
                .on_conflict_do_nothing(
                    index_elements=["item_id", "realm", "source_name", "captured_at"]
                )
                .returning(ListingSnapshot.id)
            )
            result = session.execute(stmt)
        else:
            result = session.execute(
                insert(ListingSnapshot)
                .prefix_with("OR IGNORE")
                .returning(ListingSnapshot.id),
                chunk,
            )
        inserted_in_chunk = len(result.scalars().all())
        session.commit()
        inserted += inserted_in_chunk
        skipped_duplicates += len(chunk) - inserted_in_chunk

    return inserted, skipped_duplicates


def get_latest_snapshots_for_realms(
    session: Session,
    realms: list[str],
    item_id: int | None = None,
    source_name: str | None = None,
) -> list[ListingSnapshot]:
    if not realms:
        return []

    latest_subquery = (
        session.query(
            ListingSnapshot.item_id.label("item_id"),
            ListingSnapshot.realm.label("realm"),
            func.max(ListingSnapshot.captured_at).label("captured_at"),
        )
        .filter(ListingSnapshot.realm.in_(realms))
    )
    if source_name is not None:
        latest_subquery = latest_subquery.filter(ListingSnapshot.source_name == source_name)
    latest_subquery = latest_subquery.group_by(ListingSnapshot.item_id, ListingSnapshot.realm).subquery()

    query = (
        session.query(ListingSnapshot)
        .join(
            latest_subquery,
            and_(
                ListingSnapshot.item_id == latest_subquery.c.item_id,
                ListingSnapshot.realm == latest_subquery.c.realm,
                ListingSnapshot.captured_at == latest_subquery.c.captured_at,
            ),
        )
        .order_by(ListingSnapshot.item_id.asc(), ListingSnapshot.realm.asc())
    )

    if item_id is not None:
        query = query.filter(ListingSnapshot.item_id == item_id)
    if source_name is not None:
        query = query.filter(ListingSnapshot.source_name == source_name)

    return query.all()


def get_latest_snapshots_for_item(session: Session, item_id: int, realms: list[str]) -> list[ListingSnapshot]:
    return get_latest_snapshots_for_realms(session, realms, item_id=item_id)


def get_recent_snapshot_history_for_item(
    session: Session,
    item_id: int,
    realms: list[str],
    *,
    limit_per_realm: int = 5,
) -> dict[str, list[ListingSnapshot]]:
    return get_recent_snapshot_history_for_items(session, [item_id], realms, limit_per_realm=limit_per_realm).get(item_id, {})


def get_recent_snapshot_history_for_items(
    session: Session,
    item_ids: list[int],
    realms: list[str],
    *,
    limit_per_realm: int = 5,
) -> dict[int, dict[str, list[ListingSnapshot]]]:
    if not realms:
        return {}
    if not item_ids:
        return {}

    history: dict[int, dict[str, list[ListingSnapshot]]] = {}
    chunk_size = 500
    for start in range(0, len(item_ids), chunk_size):
        chunk = item_ids[start : start + chunk_size]
        rows = (
            session.query(ListingSnapshot)
            .filter(ListingSnapshot.item_id.in_(chunk), ListingSnapshot.realm.in_(realms))
            .order_by(ListingSnapshot.item_id.asc(), ListingSnapshot.realm.asc(), ListingSnapshot.captured_at.desc())
            .all()
        )
        for snapshot in rows:
            item_history = history.setdefault(snapshot.item_id, {})
            bucket = item_history.setdefault(snapshot.realm, [])
            if len(bucket) < limit_per_realm:
                bucket.append(snapshot)
    return history


def refresh_from_provider(session: Session, realms: list[str], provider_name: str | None = None) -> tuple[int, str | None]:
    registry = get_provider_registry()
    provider = registry.get_listing_provider(provider_name)
    available, message = provider.is_available()
    if not available:
        logger.info("Listing provider unavailable: %s", message)
        return 0, message

    rows = provider.fetch_listings(realms)
    if not rows:
        return 0, provider.last_error or "Provider returned no listings."

    inserted, skipped_duplicates = persist_listing_rows(session, rows, source_name=provider.name)
    mark_stale_snapshots(session)
    if inserted == 0 and skipped_duplicates:
        return 0, "Provider returned only duplicate listings; using cached data."
    return inserted, None
