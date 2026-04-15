from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import AppSettings, Item, ScanResult, ScanSession
from app.db.init_db import provision_new_user
from app.schemas.scan import RealmScanReadiness, ScanReadinessRead, ScanRunRequest, ScanSessionRead, ScanSessionSummary
from app.services.metadata_backfill_service import queue_missing_metadata_refresh, queue_missing_metadata_sweep
from app.services.metadata_service import (
    item_has_missing_metadata,
    item_is_noncommodity_trusted,
    refresh_tsm_market_stats,
    scan_result_to_schema,
)
from app.services.scan_runtime_service import (
    try_mark_user_scan_started,
    mark_scan_started,
    mark_scan_finished,
    mark_scan_failed,
    mark_scan_stage as _mark_stage,
    USER_SCAN_COOLDOWN_SECONDS,
)
from app.services.listing_service import (
    get_latest_snapshots_for_realms,
    get_recent_snapshot_history_for_items,
    mark_stale_snapshots,
    refresh_from_provider,
    snapshot_is_stale,
)
from app.services.provider_service import get_provider_registry
from app.services.realm_service import get_enabled_realm_names
from app.services.calibration_service import record_scan_predictions
from app.services.app_settings_service import enforce_fixed_ah_cut
from app.services.scoring_service import MarketHistoryContext, score_opportunity
from app.services.scoring_service import derive_recommended_sell_price
from app.services.tsm_service import TsmMarketService


class ScanAlreadyRunningError(RuntimeError):
    pass


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


def _derive_readiness_status(
    latest_snapshots: list,
    realms: list[str],
    app_settings: AppSettings,
    items_by_id: dict[int, Item],
    metadata_configured: bool,
) -> tuple[str, str, int]:
    """Compute scan readiness from already-loaded data. Returns (status, message, items_missing_metadata_count)."""
    realms_with_data: set[str] = set()
    realms_with_fresh_data: set[str] = set()
    missing_metadata_item_ids: set[int] = set()

    for snapshot in latest_snapshots:
        realms_with_data.add(snapshot.realm)
        item = items_by_id.get(snapshot.item_id)
        if item is not None and item_has_missing_metadata(item):
            missing_metadata_item_ids.add(snapshot.item_id)
        if not snapshot_is_stale(snapshot, app_settings):
            realms_with_fresh_data.add(snapshot.realm)

    realms_with_data_count = len(realms_with_data)
    realms_with_fresh_count = len(realms_with_fresh_data)
    missing_realms = [r for r in realms if r not in realms_with_data]
    items_missing_count = len(missing_metadata_item_ids)

    if not realms:
        return "blocked", "Add at least one enabled realm before scanning.", 0
    if realms_with_data_count < 2:
        return "blocked", "At least two enabled realms need listing data before the scanner can compare flip opportunities.", items_missing_count
    if realms_with_fresh_count < 2:
        return "caution", "The scanner can run, but fewer than two enabled realms have fresh listings. Wait for the next Blizzard refresh cycle before trusting top results.", items_missing_count
    if missing_metadata_item_ids:
        if metadata_configured:
            msg = "Some items still have incomplete item details, so unverified imports will be excluded from non-commodity scans until item details are refreshed."
        else:
            msg = "Live item-detail lookups are not configured, so some items still lack full details even though local listing coverage is present."
        return "caution", msg, items_missing_count
    if missing_realms:
        return "caution", "Some enabled realms still have no listing data. Results only reflect the realms currently covered by your local cache.", 0
    return "ready", "Enabled realms have enough local listing coverage for a trustworthy scan.", 0


def _extract_sell_history_prices(history_by_item: dict[int, dict[str, list]] | None, item_id: int, realm: str) -> list[float]:
    if not history_by_item:
        return []
    realm_history = history_by_item.get(item_id, {}).get(realm, [])
    return [float(snapshot.lowest_price or 0) for snapshot in realm_history if snapshot.lowest_price]


def _serialize_scan_results(
    results: list[ScanResult],
    history_by_item: dict[int, dict[str, list]] | None = None,
    latest_by_item: dict[int, dict[str, list]] | None = None,
    enabled_realms: list[str] | None = None,
) -> list:
    serialized = []
    for result in results:
        observed_sell_price = None
        if latest_by_item:
            latest_sell_snapshots = latest_by_item.get(result.item_id, {}).get(result.best_sell_realm, [])
            if latest_sell_snapshots:
                observed_sell_price = float(latest_sell_snapshots[0].lowest_price or 0)
        serialized.append(
            scan_result_to_schema(
                result,
                sell_history_prices=_extract_sell_history_prices(history_by_item, result.item_id, result.best_sell_realm),
                observed_sell_price=observed_sell_price,
            )
        )
    return serialized


def select_best_sell_snapshot(
    item,
    buy_snapshot,
    snapshots,
    settings,
    include_losers: bool,
    history_by_realm: dict[str, list] | None = None,
):
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


def get_scan_readiness(session: Session, user_id: str, realms: list[str] | None = None) -> ScanReadinessRead:
    if realms is None:
        realms = get_enabled_realm_names(session, user_id)
    app_settings = session.query(AppSettings).filter(AppSettings.user_id == user_id).first() or AppSettings(user_id=user_id)
    enforce_fixed_ah_cut(app_settings)
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
        message = "The scanner can run, but fewer than two enabled realms have fresh listings. Wait for the next Blizzard refresh cycle before trusting top results."
    elif missing_metadata_item_ids:
        status = "caution"
        if metadata_configured:
            message = "Some items still have incomplete item details, so unverified imports will be excluded from non-commodity scans until item details are refreshed."
        else:
            message = "Live item-detail lookups are not configured, so some items still lack full details even though local listing coverage is present."
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


def run_user_scan(session: Session, user_id: str, payload: ScanRunRequest, realms: list[str] | None = None) -> ScanSessionRead:
    """Compute a scan for a specific user using existing cached listing data.

    Live data refresh is handled exclusively by the background scheduler. This
    function only scores opportunities from already-cached ListingSnapshot rows.
    A per-user cooldown prevents scan spam.
    """
    remaining = 0.0
    from app.services.scan_runtime_service import get_user_scan_cooldown_remaining
    if not try_mark_user_scan_started(user_id):
        remaining = get_user_scan_cooldown_remaining(user_id)
        raise ScanAlreadyRunningError(
            f"Scan cooldown active. Please wait {int(remaining)} more second(s) before scanning again."
        )
    # Ensure user has default settings/presets on first scan
    provision_new_user(session, user_id)
    try:
        if realms is None:
            realms = get_enabled_realm_names(session, user_id)
        if not realms:
            scan_session = ScanSession(user_id=user_id, provider_name="blizzard_auctions", warning_text="No enabled realms configured.")
            session.add(scan_session)
            session.commit()
            session.refresh(scan_session)
            return ScanSessionRead(
                id=scan_session.id,
                provider_name=scan_session.provider_name,
                warning_text=scan_session.warning_text,
                generated_at=scan_session.generated_at,
                result_count=0,
                results=[],
            )

        warning_parts: list[str] = []

        mark_scan_started("blizzard_auctions")
        mark_scan_stage = _mark_stage
        if payload.refresh_live:
            mark_scan_stage("Fetching live auction listings...")
            provider = get_provider_registry().listing_providers["blizzard_auctions"]
            available, provider_message = provider.is_available()
            if not available:
                warning_parts.append(provider_message)
            else:
                _inserted, fetch_error = refresh_from_provider(session, realms)
                if fetch_error:
                    warning_parts.append(f"Live refresh failed: {fetch_error}")
        mark_stale_snapshots(session)
        app_settings = session.query(AppSettings).filter(AppSettings.user_id == user_id).first() or AppSettings(user_id=user_id)
        enforce_fixed_ah_cut(app_settings)
        latest_snapshots = get_latest_snapshots_for_realms(session, realms)
        metadata_configured, _metadata_message = get_provider_registry().metadata_provider.is_available()

        grouped: dict[int, list] = {}
        for snapshot in latest_snapshots:
            if snapshot.lowest_price is None or snapshot.lowest_price <= 0:
                continue
            grouped.setdefault(snapshot.item_id, []).append(snapshot)

        items_by_id = _load_items_by_id(session, set(grouped.keys()))
        readiness_status, readiness_message, items_missing_metadata_count = _derive_readiness_status(
            latest_snapshots, realms, app_settings, items_by_id, metadata_configured
        )

        if not grouped:
            warning_parts.append("No listing data found for enabled realms. Import listing snapshots to run the scanner.")
        if readiness_status != "ready":
            warning_parts.append(readiness_message)

        candidate_items: list[tuple[float, int]] = []
        exploration_candidate_item_ids: list[int] = []
        for item_id, snapshots in grouped.items():
            if len(snapshots) < 2:
                continue
            buy_snapshot = select_cheapest_buy_snapshot(snapshots)
            best_observed_sell_snapshot = max(
                (snapshot for snapshot in snapshots if snapshot.realm != buy_snapshot.realm),
                key=lambda snapshot: float(snapshot.lowest_price or 0),
                default=None,
            )
            if best_observed_sell_snapshot is None:
                continue
            conservative_sell_price, _sell_reasons = derive_recommended_sell_price(best_observed_sell_snapshot)
            estimated_raw_profit = (conservative_sell_price * (1 - app_settings.ah_cut_percent)) - float(buy_snapshot.lowest_price or 0) - app_settings.flat_buffer
            if estimated_raw_profit > 0:
                candidate_items.append((estimated_raw_profit, item_id))
            else:
                exploration_candidate_item_ids.append(item_id)

        candidate_items.sort(key=lambda x: x[0], reverse=True)
        candidate_item_ids = [item_id for _profit, item_id in candidate_items]

        if candidate_item_ids:
            mark_scan_stage("Refreshing TSM market enrichment for likely flip candidates.")
            primary_budget = 90
            explore_budget = 30
            selected_primary = candidate_item_ids[:primary_budget]
            selected_exploration = exploration_candidate_item_ids[:explore_budget]
            selected_candidate_item_ids = selected_primary + selected_exploration
            tsm_summary = refresh_tsm_market_stats(session, selected_candidate_item_ids[:120])
            if tsm_summary["warnings"] and tsm_summary["refreshed_count"] == 0:
                warning_parts.append(tsm_summary["warnings"][0])
        tsm_service = TsmMarketService(get_settings())

        scan_session = ScanSession(
            user_id=user_id,
            provider_name="blizzard_auctions",
            warning_text=" ".join(warning_parts) if warning_parts else None,
        )
        session.add(scan_session)
        session.flush()

        # Load price history only for profitable candidates — items outside this set will score
        # without volatility/recency context (profit and ROI are unaffected).
        history_item_ids = candidate_item_ids[:500]
        if history_item_ids:
            mark_scan_stage(f"Loading price history for {len(history_item_ids)} candidate items...")
            history_by_item = get_recent_snapshot_history_for_items(session, history_item_ids, realms)
        else:
            history_by_item = {}
        mark_scan_stage("Scoring cross-realm opportunities.")

        def build_scan_results(include_losers: bool) -> tuple[list[ScanResult], int, int]:
            local_results: list[ScanResult] = []
            skipped_missing_metadata_local = 0
            included_unverified_metadata_local = 0
            total_items = len(grouped)
            progress_step = max(100, total_items // 10) if total_items else 100
            mode_label = "all-ranked" if include_losers else "profit-positive"

            for index, (item_id, snapshots) in enumerate(grouped.items(), start=1):
                if index == 1 or index % progress_step == 0 or index == total_items:
                    mark_scan_stage(f"Scoring cross-realm opportunities ({mode_label})... {index}/{total_items} items")

                item = items_by_id.get(item_id)
                if item is None:
                    continue
                if app_settings.non_commodity_only and item.is_commodity:
                    continue
                if app_settings.non_commodity_only and item_has_missing_metadata(item):
                    if item_is_noncommodity_trusted(item):
                        pass
                    elif metadata_configured:
                        skipped_missing_metadata_local += 1
                        continue
                    else:
                        included_unverified_metadata_local += 1
                if len(snapshots) < 2:
                    continue

                buy_snapshot = select_cheapest_buy_snapshot(snapshots)
                best_candidate, best_score = select_best_sell_snapshot(
                    item,
                    buy_snapshot,
                    snapshots,
                    app_settings,
                    include_losers,
                    history_by_realm=history_by_item.get(item_id),
                )

                if best_candidate is None or best_score is None:
                    continue

                local_results.append(
                    ScanResult(
                        scan_session_id=scan_session.id,
                        item_id=item_id,
                        cheapest_buy_realm=buy_snapshot.realm,
                        cheapest_buy_price=buy_snapshot.lowest_price or 0,
                        best_sell_realm=best_candidate.realm,
                        best_sell_price=best_score.recommended_sell_price,
                        estimated_profit=best_score.estimated_profit,
                        roi=best_score.roi,
                        confidence_score=best_score.confidence_score,
                        sellability_score=best_score.sellability_score,
                        liquidity_score=best_score.liquidity_score,
                        volatility_score=best_score.volatility_score,
                        bait_risk_score=best_score.bait_risk_score,
                        final_score=best_score.final_score,
                        turnover_label=best_score.turnover_label,
                        score_provenance_json=best_score.score_provenance,
                        explanation=best_score.explanation,
                        has_stale_data=best_score.has_stale_data,
                        is_risky=best_score.is_risky,
                    )
                )

            return local_results, skipped_missing_metadata_local, included_unverified_metadata_local

        results, skipped_missing_metadata, included_unverified_metadata = build_scan_results(payload.include_losers)
        if not results and grouped and not payload.include_losers:
            results, skipped_missing_metadata, included_unverified_metadata = build_scan_results(True)
            if results:
                warning_parts.append(
                    "No profitable flips cleared the current thresholds, so the scanner is showing the best-ranked listings instead."
                )

        if skipped_missing_metadata:
            warning_parts.append(
                f"Excluded {skipped_missing_metadata} items with incomplete item details from non-commodity scanning."
            )
        if included_unverified_metadata:
            warning_parts.append(
                f"Included {included_unverified_metadata} items with unverified item details because live item-detail lookups are not configured."
            )

        results.sort(key=lambda result: (result.final_score, result.estimated_profit), reverse=True)

        if metadata_configured and results:
            refresh_targets: list[int] = []
            seen_targets: set[int] = set()
            for result in results[:100]:
                item = items_by_id.get(result.item_id)
                if item is None or not item_has_missing_metadata(item) or result.item_id in seen_targets:
                    continue
                seen_targets.add(result.item_id)
                refresh_targets.append(result.item_id)

            if refresh_targets:
                queued_count = queue_missing_metadata_refresh(refresh_targets)
                if queued_count:
                    warning_parts.append(
                        f"Queued live Blizzard item-detail refresh for {queued_count} scanned items and will keep retrying unresolved item details in the background."
                    )

        if metadata_configured and items_missing_metadata_count:
            sweep_queued = queue_missing_metadata_sweep(limit=200)
            if sweep_queued:
                warning_parts.append(
                    f"Queued item-detail sweep for {sweep_queued} unresolved cached items; the background worker will keep topping that queue off until the remaining items are resolved."
                )

        if warning_parts:
            scan_session.warning_text = " ".join(warning_parts)

        mark_scan_stage("Saving ranked results and queueing follow-up item-detail work.")
        session.add_all(results)
        session.flush()
        record_scan_predictions(session, scan_session.id, user_id, results)
        session.commit()
        session.refresh(scan_session)

        mark_scan_finished("blizzard_auctions", result_count=len(results), warning_text=scan_session.warning_text)

        latest_by_item = {
            item_id: {
                realm: snapshots
                for realm, snapshots in realm_history.items()
            }
            for item_id, realm_history in history_by_item.items()
        }

        response = ScanSessionRead(
            id=scan_session.id,
            provider_name=scan_session.provider_name,
            warning_text=scan_session.warning_text,
            generated_at=scan_session.generated_at,
            result_count=len(results),
            results=_serialize_scan_results(results, history_by_item, latest_by_item, realms),
        )
        return response
    except Exception:
        mark_scan_failed("blizzard_auctions", "Scan encountered an unexpected error.")
        raise


def get_scan_session(session: Session, scan_id: int, user_id: str, *, limit: int | None = None) -> ScanSessionRead | None:
    scan_session = session.get(ScanSession, scan_id)
    if scan_session is None or scan_session.user_id != user_id:
        return None

    query = (
        session.query(ScanResult)
        .filter(ScanResult.scan_session_id == scan_session.id)
        .order_by(ScanResult.final_score.desc(), ScanResult.estimated_profit.desc())
    )
    if limit is not None:
        query = query.limit(max(1, min(limit, 2000)))
    ordered_results = query.all()

    total_result_count = int(
        session.query(func.count(ScanResult.id))
        .filter(ScanResult.scan_session_id == scan_session.id)
        .scalar()
        or 0
    )
    history_by_item = get_recent_snapshot_history_for_items(
        session,
        list({result.item_id for result in ordered_results}),
        sorted({result.best_sell_realm for result in ordered_results}),
        limit_per_realm=3,
    )
    enabled_realms = get_enabled_realm_names(session, scan_session.user_id)
    return ScanSessionRead(
        id=scan_session.id,
        provider_name=scan_session.provider_name,
        warning_text=scan_session.warning_text,
        generated_at=scan_session.generated_at,
        result_count=total_result_count,
        results=_serialize_scan_results(ordered_results, history_by_item, history_by_item, enabled_realms),
    )


def get_latest_scan(session: Session, user_id: str, *, limit: int | None = None) -> ScanSessionRead | None:
    latest = session.query(ScanSession).filter(ScanSession.user_id == user_id).order_by(ScanSession.generated_at.desc()).first()
    if latest is None:
        return None
    return get_scan_session(session, latest.id, user_id, limit=limit)


def get_scan_history(session: Session, user_id: str, *, limit: int = 8) -> list[ScanSessionSummary]:
    rows = (
        session.query(
            ScanSession.id,
            ScanSession.generated_at,
            ScanSession.provider_name,
            func.count(ScanResult.id).label("result_count"),
        )
        .filter(ScanSession.user_id == user_id)
        .outerjoin(ScanResult, ScanResult.scan_session_id == ScanSession.id)
        .group_by(ScanSession.id, ScanSession.generated_at, ScanSession.provider_name)
        .order_by(ScanSession.generated_at.desc())
        .limit(limit)
        .all()
    )
    return [
        ScanSessionSummary(
            id=row.id,
            generated_at=row.generated_at,
            provider_name=row.provider_name,
            result_count=int(row.result_count or 0),
        )
        for row in rows
    ]
