from __future__ import annotations

from datetime import datetime, timezone
from collections.abc import Iterable

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.models import Item, ScanResult
from app.schemas.item import ItemDetail, ItemRead, ItemSearchResult
from app.schemas.listing import LiveListingLookupResponse, LiveListingLookupRow, ListingSnapshotRead
from app.schemas.scan import ScanResultRead
from app.services.listing_service import get_latest_snapshots_for_item
from app.services.provider_service import get_provider_registry
from app.services.realm_service import get_enabled_realm_names


def _build_search_filter(query: str):
    normalized = query.strip()
    filters = [Item.name.ilike(f"%{normalized}%")]
    if normalized.isdigit():
        filters.append(Item.item_id == int(normalized))
    return or_(*filters)


def item_has_missing_metadata(item: Item) -> bool:
    metadata = item.metadata_json
    if isinstance(metadata, dict) and metadata.get("metadata_status") == "missing":
        return True
    return item.name.endswith("(metadata unavailable)")


def item_is_noncommodity_trusted(item: Item) -> bool:
    metadata = item.metadata_json
    if isinstance(metadata, dict) and metadata.get("non_commodity_verified") is True:
        return True
    return not item_has_missing_metadata(item)


def upsert_item(session: Session, payload: ItemRead) -> Item:
    upsert_items(session, [payload])
    item = session.get(Item, payload.item_id)
    assert item is not None
    return item


def _dedupe_item_ids(item_ids: Iterable[int]) -> list[int]:
    unique_item_ids: list[int] = []
    seen_item_ids: set[int] = set()
    for item_id in item_ids:
        if item_id in seen_item_ids:
            continue
        seen_item_ids.add(item_id)
        unique_item_ids.append(item_id)
    return unique_item_ids


def upsert_items(session: Session, payloads: list[ItemRead]) -> int:
    if not payloads:
        return 0

    deduped_payloads: dict[int, ItemRead] = {}
    for payload in payloads:
        deduped_payloads[payload.item_id] = payload

    item_ids = sorted(deduped_payloads.keys())
    existing_items: dict[int, Item] = {}
    chunk_size = 500
    for start in range(0, len(item_ids), chunk_size):
        chunk = item_ids[start : start + chunk_size]
        for item in session.query(Item).filter(Item.item_id.in_(chunk)).all():
            existing_items[item.item_id] = item

    now = datetime.now(timezone.utc)
    inserted_or_updated = 0
    for item_id, payload in deduped_payloads.items():
        item = existing_items.get(item_id)
        data = payload.model_dump()
        if item is None:
            item = Item(**data)
            if item.metadata_updated_at is None:
                item.metadata_updated_at = now
            session.add(item)
            inserted_or_updated += 1
            continue

        for field, value in data.items():
            setattr(item, field, value)
        if item.metadata_updated_at is None:
            item.metadata_updated_at = now
        inserted_or_updated += 1

    session.commit()
    return inserted_or_updated


def search_items(session: Session, query: str, limit: int = 25) -> list[Item]:
    search_filter = _build_search_filter(query)
    local_items = session.query(Item).filter(search_filter).order_by(Item.name.asc()).limit(limit).all()
    if len(local_items) >= limit:
        return local_items

    remote_results = get_provider_registry().metadata_provider.search_items(query, limit=limit)
    for remote in remote_results:
        upsert_item(session, remote)

    return (
        session.query(Item)
        .filter(search_filter)
        .order_by(Item.name.asc())
        .limit(limit)
        .all()
    )


def refresh_metadata(session: Session, item_ids: list[int]) -> dict[str, object]:
    provider = get_provider_registry().metadata_provider
    refreshed_items: list[ItemRead] = []
    warnings: list[str] = []

    for item_id in _dedupe_item_ids(item_ids):
        item = provider.fetch_item(item_id)
        if item is None:
            warnings.append(f"Metadata unavailable for item {item_id}; cached values kept.")
            continue
        refreshed_items.append(item)

    refreshed = upsert_items(session, refreshed_items) if refreshed_items else 0
    return {"refreshed_count": refreshed, "warnings": warnings}


def refresh_missing_metadata(session: Session, item_ids: list[int]) -> dict[str, object]:
    provider = get_provider_registry().metadata_provider
    available, _ = provider.is_available()
    if not available:
        return {"refreshed_count": 0, "warnings": []}

    refreshed_items: list[ItemRead] = []
    warnings: list[str] = []

    for item_id in _dedupe_item_ids(item_ids):
        item = session.get(Item, item_id)
        if item is not None and not item_has_missing_metadata(item):
            continue
        remote_item = provider.fetch_item(item_id)
        if remote_item is None:
            warnings.append(f"Metadata unavailable for item {item_id}; cached values kept.")
            continue
        refreshed_items.append(remote_item)

    refreshed = upsert_items(session, refreshed_items) if refreshed_items else 0
    return {"refreshed_count": refreshed, "warnings": warnings}


def refresh_all_missing_metadata(session: Session, *, limit: int = 250) -> dict[str, object]:
    missing_item_ids = [
        item.item_id
        for item in session.query(Item).order_by(Item.item_id.asc()).all()
        if item_has_missing_metadata(item)
    ][:limit]
    return refresh_missing_metadata(session, missing_item_ids)


def get_item_detail(session: Session, item_id: int, *, refresh_metadata_if_missing: bool = True) -> ItemDetail | None:
    item = session.get(Item, item_id)
    metadata_status = "cached"
    metadata_message: str | None = None

    if item is None and refresh_metadata_if_missing:
        remote_item = get_provider_registry().metadata_provider.fetch_item(item_id)
        if remote_item is not None:
            item = upsert_item(session, remote_item)
            metadata_status = "live"
            metadata_message = "Live metadata was pulled from Blizzard for this item."

    if item is None:
        return None

    if refresh_metadata_if_missing and item_has_missing_metadata(item):
        remote_item = get_provider_registry().metadata_provider.fetch_item(item_id)
        if remote_item is not None:
            item = upsert_item(session, remote_item)
            metadata_status = "live"
            metadata_message = "Live metadata was pulled from Blizzard for this item."
        else:
            metadata_status = "missing"
            metadata_message = "Metadata is still unavailable. Check your Blizzard credentials, then use Refresh live metadata."
    elif item_has_missing_metadata(item):
        metadata_status = "missing"
        metadata_message = "Metadata is missing locally. Use Refresh live metadata when Blizzard metadata is configured."
    elif item.metadata_updated_at is not None:
        metadata_message = f"Metadata cached locally from {item.metadata_updated_at.astimezone(timezone.utc).isoformat()}."

    realms = get_enabled_realm_names(session)
    listings = get_latest_snapshots_for_item(session, item_id, realms)
    recent_scan = (
        session.query(ScanResult)
        .filter(ScanResult.item_id == item_id)
        .order_by(ScanResult.generated_at.desc())
        .first()
    )

    return ItemDetail(
        **ItemRead.model_validate(item).model_dump(),
        metadata_status=metadata_status,
        metadata_message=metadata_message,
        latest_listings=[ListingSnapshotRead.model_validate(listing) for listing in listings],
        recent_scan=scan_result_to_schema(recent_scan) if recent_scan else None,
    )


def get_live_item_listings(session: Session, item_id: int) -> LiveListingLookupResponse:
    realms = get_enabled_realm_names(session)
    if not realms:
        return LiveListingLookupResponse(
            status="unavailable",
            provider_name="blizzard_auctions",
            message="Add at least one enabled realm before checking live Blizzard listings.",
        )

    provider = get_provider_registry().listing_providers["blizzard_auctions"]
    listings, message = provider.fetch_item_market(item_id=item_id, region="us", tracked_realms=realms)
    if listings:
        return LiveListingLookupResponse(
            provider_name=provider.name,
            status="available",
            message=message,
            listings=[
                LiveListingLookupRow(
                    realm=row.realm,
                    lowest_price=row.lowest_price,
                    average_price=row.average_price,
                    quantity=row.quantity,
                    listing_count=row.listing_count,
                    captured_at=row.captured_at,
                )
                for row in listings
            ],
        )

    available, _ = provider.is_available()
    return LiveListingLookupResponse(
        provider_name=provider.name,
        status="error" if available and provider.last_error else "unavailable",
        message=message,
        listings=[],
    )


def scan_result_to_schema(result: ScanResult) -> ScanResultRead:
    return ScanResultRead(
        id=result.id,
        item_id=result.item_id,
        item_name=result.item.name if result.item else f"Item {result.item_id} (metadata unavailable)",
        item_quality=result.item.quality if result.item else None,
        item_class_name=result.item.class_name if result.item else None,
        item_icon_url=result.item.icon_url if result.item else None,
        cheapest_buy_realm=result.cheapest_buy_realm,
        cheapest_buy_price=result.cheapest_buy_price,
        best_sell_realm=result.best_sell_realm,
        best_sell_price=result.best_sell_price,
        estimated_profit=result.estimated_profit,
        roi=result.roi,
        confidence_score=result.confidence_score,
        liquidity_score=result.liquidity_score,
        volatility_score=result.volatility_score,
        bait_risk_score=result.bait_risk_score,
        final_score=result.final_score,
        explanation=result.explanation,
        generated_at=result.generated_at,
        has_stale_data=result.has_stale_data,
        is_risky=result.is_risky,
    )


def to_search_results(items: list[Item]) -> list[ItemSearchResult]:
    return [ItemSearchResult.model_validate(item) for item in items]
