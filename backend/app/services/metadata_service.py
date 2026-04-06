from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import String, cast, or_
from sqlalchemy.orm import Session

from app.db.models import Item, ScanResult
from app.schemas.item import ItemDetail, ItemRead, ItemSearchResult
from app.schemas.listing import ListingSnapshotRead
from app.schemas.scan import ScanResultRead
from app.services.listing_service import get_latest_snapshots_for_item
from app.services.provider_service import get_provider_registry
from app.services.realm_service import get_enabled_realm_names


def upsert_item(session: Session, payload: ItemRead) -> Item:
    item = session.get(Item, payload.item_id)
    data = payload.model_dump()

    if item is None:
        item = Item(**data)
        if item.metadata_updated_at is None:
            item.metadata_updated_at = datetime.now(timezone.utc)
        session.add(item)
        session.commit()
        session.refresh(item)
        return item

    for field, value in data.items():
        setattr(item, field, value)
    if item.metadata_updated_at is None:
        item.metadata_updated_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(item)
    return item


def search_items(session: Session, query: str, limit: int = 25) -> list[Item]:
    filters = [Item.name.ilike(f"%{query}%")]
    if query.strip().isdigit():
        filters.append(cast(Item.item_id, String).ilike(f"%{query.strip()}%"))
    local_items = session.query(Item).filter(or_(*filters)).order_by(Item.name.asc()).limit(limit).all()
    if len(local_items) >= limit:
        return local_items

    remote_results = get_provider_registry().metadata_provider.search_items(query, limit=limit)
    for remote in remote_results:
        upsert_item(session, remote)

    return (
        session.query(Item)
        .filter(Item.name.ilike(f"%{query}%"))
        .order_by(Item.name.asc())
        .limit(limit)
        .all()
    )


def refresh_metadata(session: Session, item_ids: list[int]) -> dict[str, object]:
    provider = get_provider_registry().metadata_provider
    refreshed = 0
    warnings: list[str] = []

    for item_id in item_ids:
        item = provider.fetch_item(item_id)
        if item is None:
            warnings.append(f"Metadata unavailable for item {item_id}; cached values kept.")
            continue
        upsert_item(session, item)
        refreshed += 1

    return {"refreshed_count": refreshed, "warnings": warnings}


def get_item_detail(session: Session, item_id: int) -> ItemDetail | None:
    item = session.get(Item, item_id)
    if item is None:
        return None

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
        latest_listings=[ListingSnapshotRead.model_validate(listing) for listing in listings],
        recent_scan=scan_result_to_schema(recent_scan) if recent_scan else None,
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
