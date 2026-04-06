from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.db.models import AppSettings, Item, ListingSnapshot
from app.schemas.listing import ListingImportRow
from app.services.provider_service import get_provider_registry


logger = logging.getLogger(__name__)


def ensure_item_record(session: Session, item_id: int) -> Item:
    item = session.get(Item, item_id)
    if item is None:
        item = Item(
            item_id=item_id,
            # This is an explicit missing-metadata label, not a fabricated name.
            name=f"Item {item_id} (metadata unavailable)",
            metadata_json={
                "source": "unresolved_import",
                "metadata_status": "missing",
            },
            metadata_updated_at=None,
            is_commodity=False,
        )
        session.add(item)
        session.flush()
    return item


def mark_stale_snapshots(session: Session) -> int:
    app_settings = session.get(AppSettings, 1) or AppSettings(id=1)
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=app_settings.stale_after_minutes)
    updated = 0

    for snapshot in session.query(ListingSnapshot).all():
        captured_at = snapshot.captured_at
        if captured_at.tzinfo is None:
            captured_at = captured_at.replace(tzinfo=timezone.utc)
        should_be_stale = captured_at < cutoff
        if snapshot.is_stale != should_be_stale:
            snapshot.is_stale = should_be_stale
            updated += 1

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

    for row in rows:
        row_key = _snapshot_key(row, source_name)
        captured_at = row.captured_at or datetime.now(timezone.utc)
        if captured_at.tzinfo is None:
            captured_at = captured_at.replace(tzinfo=timezone.utc)

        if row_key in seen_keys:
            skipped_duplicates += 1
            continue

        exists = (
            session.query(ListingSnapshot.id)
            .filter(
                ListingSnapshot.item_id == row.item_id,
                ListingSnapshot.realm.ilike(row.realm),
                ListingSnapshot.source_name == source_name,
                ListingSnapshot.captured_at == captured_at,
            )
            .first()
            is not None
        )
        if exists:
            skipped_duplicates += 1
            continue

        seen_keys.add(row_key)
        ensure_item_record(session, row.item_id)
        session.add(
            ListingSnapshot(
                item_id=row.item_id,
                realm=row.realm,
                lowest_price=row.lowest_price,
                average_price=row.average_price,
                quantity=row.quantity,
                listing_count=row.listing_count,
                source_name=source_name,
                captured_at=captured_at,
                is_stale=False,
            )
        )
        inserted += 1
    session.commit()
    return inserted, skipped_duplicates


def get_latest_snapshots_for_realms(
    session: Session,
    realms: list[str],
    item_id: int | None = None,
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
        .group_by(ListingSnapshot.item_id, ListingSnapshot.realm)
        .subquery()
    )

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

    return query.all()


def get_latest_snapshots_for_item(session: Session, item_id: int, realms: list[str]) -> list[ListingSnapshot]:
    return get_latest_snapshots_for_realms(session, realms, item_id=item_id)


def refresh_from_provider(session: Session, realms: list[str], provider_name: str | None = None) -> tuple[int, str | None]:
    registry = get_provider_registry()
    provider = registry.get_listing_provider(provider_name)
    available, message = provider.is_available()
    if not available:
        logger.info("Listing provider unavailable: %s", message)
        return 0, message

    rows = provider.fetch_listings(realms)
    if not rows:
        return 0, "Provider returned no listings."

    inserted, skipped_duplicates = persist_listing_rows(session, rows, source_name=provider.name)
    mark_stale_snapshots(session)
    if inserted == 0 and skipped_duplicates:
        return 0, "Provider returned only duplicate listings; using cached data."
    return inserted, None
