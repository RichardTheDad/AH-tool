from __future__ import annotations

from datetime import timezone

from sqlalchemy.orm import Session

from app.db.models import AppSettings, Item, ScanResult, ScanSession
from app.schemas.scan import RealmScanReadiness, ScanReadinessRead, ScanRunRequest, ScanSessionRead
from app.services.metadata_backfill_service import queue_missing_metadata_refresh
from app.services.metadata_service import (
    item_has_missing_metadata,
    item_is_noncommodity_trusted,
    scan_result_to_schema,
)
from app.services.scan_runtime_service import mark_scan_failed, mark_scan_finished, mark_scan_started
from app.services.listing_service import (
    get_latest_snapshots_for_realms,
    get_recent_snapshot_history_for_items,
    mark_stale_snapshots,
    refresh_from_provider,
    snapshot_is_stale,
)
from app.services.provider_service import get_provider_registry
from app.services.realm_service import get_enabled_realm_names
from app.services.scoring_service import MarketHistoryContext, score_opportunity


def select_cheapest_buy_snapshot(snapshots):
    return min(snapshots, key=lambda snapshot: float(snapshot.lowest_price or 0))


def _build_history_context(buy_snapshot, sell_snapshot, history_by_realm: dict[str, list] | None) -> MarketHistoryContext | None:
    if not history_by_realm:
        return None

    buy_history = history_by_realm.get(buy_snapshot.realm, [])
    sell_history = history_by_realm.get(sell_snapshot.realm, [])
    if not buy_history and not sell_history:
        return None

    freshness_gap_minutes = abs(
        (sell_snapshot.captured_at.astimezone(timezone.utc) - buy_snapshot.captured_at.astimezone(timezone.utc)).total_seconds()
    ) / 60
    return MarketHistoryContext(
        sell_recent_prices=[float(snapshot.lowest_price or 0) for snapshot in sell_history if snapshot.lowest_price],
        buy_recent_prices=[float(snapshot.lowest_price or 0) for snapshot in buy_history if snapshot.lowest_price],
        freshness_gap_minutes=freshness_gap_minutes,
    )


def _load_items_by_id(session: Session, item_ids: set[int]) -> dict[int, Item]:
    if not item_ids:
        return {}

    chunk_size = 500
    items: dict[int, Item] = {}
    item_id_list = sorted(item_ids)
    for start in range(0, len(item_id_list), chunk_size):
        chunk = item_id_list[start : start + chunk_size]
        for item in session.query(Item).filter(Item.item_id.in_(chunk)).all():
            items[item.item_id] = item
    return items


def select_best_sell_snapshot(item, buy_snapshot, snapshots, settings, include_losers: bool, history_by_realm: dict[str, list] | None = None):
    candidates = [snapshot for snapshot in snapshots if snapshot.realm != buy_snapshot.realm]
    if not candidates:
        return None, None

    best_candidate = None
    best_score = None
    for candidate in candidates:
        score = score_opportunity(
            item,
            buy_snapshot,
            candidate,
            settings,
            history=_build_history_context(buy_snapshot, candidate, history_by_realm),
        )
        if not include_losers and score.estimated_profit <= 0:
            continue
        if best_candidate is None or score.final_score > best_score.final_score:
            best_candidate = candidate
            best_score = score

    return best_candidate, best_score


def get_scan_readiness(session: Session) -> ScanReadinessRead:
    realms = get_enabled_realm_names(session)
    app_settings = session.get(AppSettings, 1) or AppSettings(id=1)
    latest_snapshots = get_latest_snapshots_for_realms(session, realms)
    metadata_provider = get_provider_registry().metadata_provider
    metadata_configured, _metadata_message = metadata_provider.is_available()
    items_by_id = _load_items_by_id(session, {snapshot.item_id for snapshot in latest_snapshots})

    per_realm: dict[str, dict[str, object]] = {
        realm: {
            "fresh_item_count": 0,
            "stale_item_count": 0,
            "latest_item_count": 0,
            "freshest_captured_at": None,
            "latest_source_name": None,
        }
        for realm in realms
    }
    unique_item_ids: set[int] = set()
    missing_metadata_item_ids: set[int] = set()
    oldest_snapshot_at = None
    latest_snapshot_at = None

    for snapshot in latest_snapshots:
        unique_item_ids.add(snapshot.item_id)
        item = items_by_id.get(snapshot.item_id)
        if item is not None and item_has_missing_metadata(item):
            missing_metadata_item_ids.add(snapshot.item_id)

        stats = per_realm.setdefault(
            snapshot.realm,
            {
                "fresh_item_count": 0,
                "stale_item_count": 0,
                "latest_item_count": 0,
                "freshest_captured_at": None,
                "latest_source_name": None,
            },
        )
        stats["latest_item_count"] = int(stats["latest_item_count"]) + 1
        is_stale = snapshot_is_stale(snapshot, app_settings)
        if is_stale:
            stats["stale_item_count"] = int(stats["stale_item_count"]) + 1
        else:
            stats["fresh_item_count"] = int(stats["fresh_item_count"]) + 1

        captured_at = snapshot.captured_at.astimezone(timezone.utc)
        freshest = stats["freshest_captured_at"]
        if freshest is None or captured_at > freshest:
            stats["freshest_captured_at"] = captured_at
            stats["latest_source_name"] = snapshot.source_name

        if oldest_snapshot_at is None or captured_at < oldest_snapshot_at:
            oldest_snapshot_at = captured_at
        if latest_snapshot_at is None or captured_at > latest_snapshot_at:
            latest_snapshot_at = captured_at

    realm_rows = [
        RealmScanReadiness(
            realm=realm,
            has_data=bool(stats["latest_item_count"]),
            fresh_item_count=int(stats["fresh_item_count"]),
            stale_item_count=int(stats["stale_item_count"]),
            latest_item_count=int(stats["latest_item_count"]),
            freshest_captured_at=stats["freshest_captured_at"],
            latest_source_name=stats["latest_source_name"],
        )
        for realm, stats in per_realm.items()
    ]

    realms_with_data = sum(1 for row in realm_rows if row.has_data)
    realms_with_fresh_data = sum(1 for row in realm_rows if row.fresh_item_count > 0)
    missing_realms = [row.realm for row in realm_rows if not row.has_data]
    stale_realms = [row.realm for row in realm_rows if row.has_data and row.fresh_item_count == 0]

    if not realms:
        status = "blocked"
        message = "Add at least one enabled realm before scanning."
    elif realms_with_data < 2:
        status = "blocked"
        message = "At least two enabled realms need listing data before the scanner can compare flip opportunities."
    elif realms_with_fresh_data < 2:
        status = "caution"
        message = "The scanner can run, but fewer than two enabled realms have fresh listings. Import fresher data before trusting top results."
    elif missing_metadata_item_ids:
        status = "caution"
        if metadata_configured:
            message = "Some items still have missing metadata, so unverified imports will be excluded from non-commodity scans until metadata is refreshed."
        else:
            message = "Live metadata is not configured, so some items still lack rich metadata even though local listing coverage is present."
    elif missing_realms:
        status = "caution"
        message = "Some enabled realms still have no listing data. Results only reflect the realms currently covered by your local cache."
    else:
        status = "ready"
        message = "Enabled realms have enough local listing coverage for a trustworthy scan."

    return ScanReadinessRead(
        status=status,
        ready_for_scan=realms_with_data >= 2,
        message=message,
        enabled_realm_count=len(realms),
        realms_with_data=realms_with_data,
        realms_with_fresh_data=realms_with_fresh_data,
        unique_item_count=len(unique_item_ids),
        items_missing_metadata=len(missing_metadata_item_ids),
        stale_realm_count=len(stale_realms),
        missing_realms=missing_realms,
        stale_realms=stale_realms,
        oldest_snapshot_at=oldest_snapshot_at,
        latest_snapshot_at=latest_snapshot_at,
        realms=sorted(realm_rows, key=lambda row: row.realm.lower()),
    )


def run_scan(session: Session, payload: ScanRunRequest) -> ScanSessionRead:
    mark_scan_started(payload.provider_name)
    try:
        realms = get_enabled_realm_names(session)
        if not realms:
            scan_session = ScanSession(provider_name=payload.provider_name or "stored", warning_text="No enabled realms configured.")
            session.add(scan_session)
            session.commit()
            session.refresh(scan_session)
            response = ScanSessionRead(
                id=scan_session.id,
                provider_name=scan_session.provider_name,
                warning_text=scan_session.warning_text,
                generated_at=scan_session.generated_at,
                result_count=0,
                results=[],
            )
            mark_scan_finished(response.provider_name, result_count=0, warning_text=response.warning_text)
            return response

        warning_parts: list[str] = []
        if payload.refresh_live:
            inserted, warning = refresh_from_provider(session, realms, payload.provider_name)
            if warning:
                warning_parts.append(warning)
            elif inserted == 0:
                warning_parts.append("Provider refresh returned no rows; using cached listings.")

        mark_stale_snapshots(session)
        app_settings = session.get(AppSettings, 1) or AppSettings(id=1)
        latest_snapshots = get_latest_snapshots_for_realms(session, realms)
        readiness = get_scan_readiness(session)

        grouped: dict[int, list] = {}
        for snapshot in latest_snapshots:
            if snapshot.lowest_price is None or snapshot.lowest_price <= 0:
                continue
            grouped.setdefault(snapshot.item_id, []).append(snapshot)

        if not grouped:
            warning_parts.append("No listing data found for enabled realms. Import listing snapshots to run the scanner.")
        if readiness.status != "ready":
            warning_parts.append(readiness.message)

        scan_session = ScanSession(
            provider_name=payload.provider_name or "stored",
            warning_text=" ".join(warning_parts) if warning_parts else None,
        )
        session.add(scan_session)
        session.flush()

        results: list[ScanResult] = []
        skipped_missing_metadata = 0
        included_unverified_metadata = 0
        metadata_configured, _metadata_message = get_provider_registry().metadata_provider.is_available()
        history_by_item = get_recent_snapshot_history_for_items(session, list(grouped.keys()), realms)
        for item_id, snapshots in grouped.items():
            item = session.get(Item, item_id)
            if item is None:
                continue
            if app_settings.non_commodity_only and item.is_commodity:
                continue
            if app_settings.non_commodity_only and item_has_missing_metadata(item):
                if item_is_noncommodity_trusted(item):
                    pass
                elif metadata_configured:
                    skipped_missing_metadata += 1
                    continue
                else:
                    included_unverified_metadata += 1
            if len(snapshots) < 2:
                continue

            buy_snapshot = select_cheapest_buy_snapshot(snapshots)
            best_candidate, best_score = select_best_sell_snapshot(
                item,
                buy_snapshot,
                snapshots,
                app_settings,
                payload.include_losers,
                history_by_realm=history_by_item.get(item_id),
            )

            if best_candidate is None or best_score is None:
                continue

            result = ScanResult(
                scan_session_id=scan_session.id,
                item_id=item_id,
                cheapest_buy_realm=buy_snapshot.realm,
                cheapest_buy_price=buy_snapshot.lowest_price or 0,
                best_sell_realm=best_candidate.realm,
                best_sell_price=best_score.recommended_sell_price,
                estimated_profit=best_score.estimated_profit,
                roi=best_score.roi,
                confidence_score=best_score.confidence_score,
                liquidity_score=best_score.liquidity_score,
                volatility_score=best_score.volatility_score,
                bait_risk_score=best_score.bait_risk_score,
                final_score=best_score.final_score,
                explanation=best_score.explanation,
                has_stale_data=best_score.has_stale_data,
                is_risky=best_score.is_risky,
            )
            results.append(result)

        if skipped_missing_metadata:
            warning_parts.append(
                f"Excluded {skipped_missing_metadata} items with missing metadata from non-commodity scanning."
            )
        if included_unverified_metadata:
            warning_parts.append(
                f"Included {included_unverified_metadata} items with unverified metadata because live metadata is not configured."
            )

        results.sort(key=lambda result: (result.final_score, result.estimated_profit), reverse=True)

        if metadata_configured and results:
            refresh_targets: list[int] = []
            seen_targets: set[int] = set()
            for result in results[:100]:
                item = session.get(Item, result.item_id)
                if item is None or not item_has_missing_metadata(item) or result.item_id in seen_targets:
                    continue
                seen_targets.add(result.item_id)
                refresh_targets.append(result.item_id)

            if refresh_targets:
                queued_count = queue_missing_metadata_refresh(refresh_targets)
                if queued_count:
                    warning_parts.append(f"Queued live Blizzard metadata refresh for {queued_count} scanned items.")

        if warning_parts:
            scan_session.warning_text = " ".join(warning_parts)

        session.add_all(results)
        session.commit()
        session.refresh(scan_session)

        response = ScanSessionRead(
            id=scan_session.id,
            provider_name=scan_session.provider_name,
            warning_text=scan_session.warning_text,
            generated_at=scan_session.generated_at,
            result_count=len(results),
            results=[scan_result_to_schema(result) for result in results],
        )
        mark_scan_finished(response.provider_name, result_count=response.result_count, warning_text=response.warning_text)
        return response
    except Exception as exc:
        mark_scan_failed(payload.provider_name, f"Last scan failed: {exc}")
        raise


def get_scan_session(session: Session, scan_id: int) -> ScanSessionRead | None:
    scan_session = session.get(ScanSession, scan_id)
    if scan_session is None:
        return None
    ordered_results = sorted(scan_session.results, key=lambda result: (result.final_score, result.estimated_profit), reverse=True)
    return ScanSessionRead(
        id=scan_session.id,
        provider_name=scan_session.provider_name,
        warning_text=scan_session.warning_text,
        generated_at=scan_session.generated_at,
        result_count=len(ordered_results),
        results=[scan_result_to_schema(result) for result in ordered_results],
    )


def get_latest_scan(session: Session) -> ScanSessionRead | None:
    latest = session.query(ScanSession).order_by(ScanSession.generated_at.desc()).first()
    if latest is None:
        return None
    return get_scan_session(session, latest.id)
