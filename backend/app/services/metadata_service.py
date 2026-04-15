from __future__ import annotations

from datetime import datetime, timezone
from collections.abc import Iterable
from typing import Any

import httpx
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.models import Item, ScanResult
from app.core.config import get_settings
from app.schemas.item import (
    ItemDetail,
    ItemHistoryPointRead,
    ItemRead,
    ItemRealmHistoryRead,
    ItemSearchResult,
    TsmRegionStatsRead,
)
from app.schemas.listing import LiveListingLookupResponse, LiveListingLookupRow, ListingSnapshotRead
from app.schemas.scan import ScanResultRead
from app.services.listing_service import get_latest_snapshots_for_item, get_recent_snapshot_history_for_item
from app.providers.base import ItemNotFoundError
from app.services.provider_service import get_provider_registry
from app.services.realm_service import get_enabled_realm_names
from app.services.tsm_service import TsmMarketService
from app.services.undermine_service import build_undermine_item_url


def _build_search_filter(query: str):
    normalized = query.strip()
    filters = [Item.name.ilike(f"%{normalized}%")]
    if normalized.isdigit():
        filters.append(Item.item_id == int(normalized))
    return or_(*filters)


def item_has_missing_metadata(item: Item) -> bool:
    metadata = item.metadata_json
    if isinstance(metadata, dict) and metadata.get("metadata_status") == "not_found":
        return False
    if isinstance(metadata, dict) and metadata.get("metadata_status") == "missing":
        return True
    return item.name.endswith("(metadata unavailable)")


def item_is_noncommodity_trusted(item: Item) -> bool:
    metadata = item.metadata_json
    if isinstance(metadata, dict) and metadata.get("non_commodity_verified") is True:
        return True
    return not item_has_missing_metadata(item)


def get_cached_tsm_region_stats(item: Item) -> dict[str, float | None] | None:
    metadata = item.metadata_json
    if not isinstance(metadata, dict):
        return None
    stats = metadata.get("tsm_region_stats")
    return stats if isinstance(stats, dict) else None


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
        data = {k: v for k, v in payload.model_dump().items() if k in Item.__table__.columns.keys()}
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
    upsert_items(session, remote_results)

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
        try:
            item = provider.fetch_item(item_id)
        except ItemNotFoundError:
            warnings.append(f"Item {item_id} does not exist in the Blizzard API (HTTP 404).")
            continue
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
    not_found_item_ids: list[int] = []

    for item_id in _dedupe_item_ids(item_ids):
        item = session.get(Item, item_id)
        if item is not None and not item_has_missing_metadata(item):
            continue
        try:
            remote_item = provider.fetch_item(item_id)
        except ItemNotFoundError:
            not_found_item_ids.append(item_id)
            continue
        if remote_item is None:
            warnings.append(f"Metadata unavailable for item {item_id}; cached values kept.")
            continue
        refreshed_items.append(remote_item)

    for item_id in not_found_item_ids:
        db_item = session.get(Item, item_id)
        if db_item is not None:
            existing = db_item.metadata_json if isinstance(db_item.metadata_json, dict) else {}
            db_item.metadata_json = {**existing, "metadata_status": "not_found"}

    if refreshed_items:
        refreshed = upsert_items(session, refreshed_items)
    else:
        refreshed = 0
        if not_found_item_ids:
            session.commit()
    return {"refreshed_count": refreshed, "warnings": warnings}


def refresh_all_missing_metadata(session: Session, *, limit: int = 250) -> dict[str, object]:
    return refresh_missing_metadata(session, get_missing_metadata_item_ids(session, limit=limit))


def get_missing_metadata_item_ids(session: Session, *, limit: int = 250) -> list[int]:
    return [
        item.item_id
        for item in (
            session.query(Item)
            .filter(Item.name.like("%(metadata unavailable)%"))
            .order_by(Item.item_id.asc())
            .limit(limit)
            .all()
        )
        if not (isinstance(item.metadata_json, dict) and item.metadata_json.get("metadata_status") == "not_found")
    ]


def refresh_tsm_market_stats(
    session: Session,
    item_ids: list[int],
    *,
    force: bool = False,
    max_age_hours: int = 24,
) -> dict[str, Any]:
    tsm_service = TsmMarketService(get_settings())
    available, message = tsm_service.is_available()
    if not available:
        return {"refreshed_count": 0, "warnings": [message]}

    refreshed_count = 0
    warnings: list[str] = []
    with httpx.Client(timeout=get_settings().request_timeout_seconds) as http_client:
        for item_id in _dedupe_item_ids(item_ids):
            item = session.get(Item, item_id)
            if item is None:
                continue

            metadata = dict(item.metadata_json) if isinstance(item.metadata_json, dict) else {}
            if not force and tsm_service.is_market_stats_fresh(metadata, max_age_hours=max_age_hours):
                continue

            stats, stats_message = tsm_service.fetch_region_item_stats(item_id, client=http_client)
            if stats is None:
                warnings.append(stats_message)
                continue

            metadata["tsm_region_stats"] = stats
            metadata["tsm_updated_at"] = datetime.now(timezone.utc).isoformat()
            metadata["tsm_region_id"] = tsm_service._resolve_region_id()
            item.metadata_json = metadata
        refreshed_count += 1

    if refreshed_count:
        session.commit()
    return {"refreshed_count": refreshed_count, "warnings": warnings}


def get_item_detail(session: Session, item_id: int, user_id: str, *, refresh_metadata_if_missing: bool = True) -> ItemDetail | None:
    item = session.get(Item, item_id)
    metadata_status = "cached"
    metadata_message: str | None = None

    if item is None and refresh_metadata_if_missing:
        try:
            remote_item = get_provider_registry().metadata_provider.fetch_item(item_id)
        except ItemNotFoundError:
            remote_item = None
        if remote_item is not None:
            item = upsert_item(session, remote_item)
            metadata_status = "live"
            metadata_message = "Live metadata was pulled from Blizzard for this item."

    if item is None:
        return None

    if refresh_metadata_if_missing and item_has_missing_metadata(item):
        try:
            remote_item = get_provider_registry().metadata_provider.fetch_item(item_id)
        except ItemNotFoundError:
            remote_item = None
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

    realms = get_enabled_realm_names(session, user_id)
    listings = get_latest_snapshots_for_item(session, item_id, realms)
    auction_history_map = get_recent_snapshot_history_for_item(session, item_id, realms, limit_per_realm=30)
    auction_history = [
        ItemRealmHistoryRead(
            realm=realm,
            points=[
                ItemHistoryPointRead(
                    captured_at=snapshot.captured_at,
                    lowest_price=snapshot.lowest_price,
                    average_price=snapshot.average_price,
                    quantity=snapshot.quantity,
                    listing_count=snapshot.listing_count,
                )
                for snapshot in reversed(history)
            ],
        )
        for realm, history in sorted(auction_history_map.items(), key=lambda entry: entry[0].lower())
        if history
    ]
    recent_scan = (
        session.query(ScanResult)
        .filter(ScanResult.item_id == item_id)
        .order_by(ScanResult.generated_at.desc())
        .first()
    )
    tsm_service = TsmMarketService(get_settings())
    tsm_available, tsm_message = tsm_service.is_available()
    tsm_region_stats = None
    tsm_status = "unavailable"
    if tsm_available:
        metadata = dict(item.metadata_json) if isinstance(item.metadata_json, dict) else {}
        cached_region_stats = metadata.get("tsm_region_stats") if isinstance(metadata.get("tsm_region_stats"), dict) else None
        if not tsm_service.is_market_stats_fresh(metadata):
            refresh_summary = refresh_tsm_market_stats(session, [item_id])
            refreshed_item = session.get(Item, item_id) or item
            refreshed_metadata = dict(refreshed_item.metadata_json) if isinstance(refreshed_item.metadata_json, dict) else {}
            cached_region_stats = (
                refreshed_metadata.get("tsm_region_stats")
                if isinstance(refreshed_metadata.get("tsm_region_stats"), dict)
                else cached_region_stats
            )
            if refresh_summary["warnings"]:
                tsm_message = refresh_summary["warnings"][0]
            elif refresh_summary["refreshed_count"]:
                tsm_message = "TSM region market stats loaded."

        if cached_region_stats:
            tsm_region_stats = TsmRegionStatsRead(**cached_region_stats)
            tsm_status = "available"
            if not tsm_message:
                tsm_message = "Cached TSM region market stats available."
        else:
            tsm_status = "error"

    preferred_undermine_realm = (
        recent_scan.best_sell_realm
        if recent_scan is not None
        else (listings[0].realm if listings else (realms[0] if realms else None))
    )

    return ItemDetail(
        **ItemRead.model_validate(item).model_dump(),
        undermine_url=build_undermine_item_url(item.item_id, preferred_undermine_realm),
        metadata_status=metadata_status,
        metadata_message=metadata_message,
        latest_listings=[ListingSnapshotRead.model_validate(listing) for listing in listings],
        auction_history=auction_history,
        tsm_status=tsm_status,
        tsm_message=tsm_message,
        tsm_region_stats=tsm_region_stats,
        recent_scan=scan_result_to_schema(recent_scan) if recent_scan else None,
    )


def get_live_item_listings(session: Session, item_id: int, user_id: str) -> LiveListingLookupResponse:
    realms = get_enabled_realm_names(session, user_id)
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


def scan_result_to_schema(
    result: ScanResult,
    *,
    sell_history_prices: list[float] | None = None,
    observed_sell_price: float | None = None,
) -> ScanResultRead:
    has_missing_metadata = item_has_missing_metadata(result.item) if result.item else True
    buy_price = float(result.cheapest_buy_price or 0)
    target_sell_price = float(result.best_sell_price or 0)
    spread_percent = ((target_sell_price / buy_price) - 1) if buy_price > 0 else 0.0
    observed_spread_percent = ((observed_sell_price / buy_price) - 1) if observed_sell_price and buy_price > 0 else None
    return ScanResultRead(
        id=result.id,
        item_id=result.item_id,
        item_name=result.item.name if result.item else f"Item {result.item_id} (metadata unavailable)",
        undermine_url=build_undermine_item_url(result.item_id, result.best_sell_realm),
        item_quality=result.item.quality if result.item else None,
        item_class_name=result.item.class_name if result.item else None,
        item_icon_url=result.item.icon_url if result.item else None,
        cheapest_buy_realm=result.cheapest_buy_realm,
        cheapest_buy_price=result.cheapest_buy_price,
        best_sell_realm=result.best_sell_realm,
        best_sell_price=result.best_sell_price,
        observed_sell_price=observed_sell_price,
        estimated_profit=result.estimated_profit,
        roi=result.roi,
        spread_percent=round(spread_percent, 4),
        observed_spread_percent=round(observed_spread_percent, 4) if observed_spread_percent is not None else None,
        confidence_score=result.confidence_score,
        sellability_score=getattr(result, "sellability_score", 0),
        liquidity_score=result.liquidity_score,
        volatility_score=result.volatility_score,
        bait_risk_score=result.bait_risk_score,
        final_score=result.final_score,
        turnover_label=getattr(result, "turnover_label", "slow"),
        explanation=result.explanation,
        sell_history_prices=sell_history_prices or [],
        generated_at=result.generated_at,
        has_stale_data=result.has_stale_data,
        is_risky=result.is_risky,
        has_missing_metadata=has_missing_metadata,
        score_provenance=result.score_provenance_json,
    )


def to_search_results(session: Session, items: list[Item], user_id: str) -> list[ItemSearchResult]:
    enabled_realms = get_enabled_realm_names(session, user_id)
    preferred_realm = enabled_realms[0] if enabled_realms else None
    return [
        ItemSearchResult(
            **ItemRead.model_validate(item).model_dump(),
            undermine_url=build_undermine_item_url(item.item_id, preferred_realm),
        )
        for item in items
    ]
