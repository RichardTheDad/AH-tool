from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import AppSettings, Item, ScanResult, ScanSession
from app.schemas.scan import RealmScanReadiness, ScanReadinessRead, ScanRunRequest, ScanSessionRead, ScanSessionSummary
from app.services.metadata_backfill_service import queue_missing_metadata_refresh, queue_missing_metadata_sweep
from app.services.metadata_service import (
    item_has_missing_metadata,
    item_is_noncommodity_trusted,
    refresh_tsm_market_stats,
    scan_result_to_schema,
)
from app.services.scan_runtime_service import mark_scan_failed, mark_scan_finished, mark_scan_stage, try_mark_scan_started
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
from app.services.scoring_service import MarketHistoryContext, TsmMarketContext, score_opportunity
from app.services.scoring_service import derive_recommended_sell_price
from app.services.tsm_ledger_service import TsmLedgerService
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


def _extract_sell_history_prices(history_by_item: dict[int, dict[str, list]] | None, item_id: int, realm: str) -> list[float]:
    if not history_by_item:
        return []
    realm_history = history_by_item.get(item_id, {}).get(realm, [])
    return [float(snapshot.lowest_price or 0) for snapshot in realm_history if snapshot.lowest_price]


def _serialize_scan_results(
    results: list[ScanResult],
    history_by_item: dict[int, dict[str, list]] | None = None,
    latest_by_item: dict[int, dict[str, list]] | None = None,
    tsm_ledger_service: TsmLedgerService | None = None,
    enabled_realms: list[str] | None = None,
) -> list:
    ledger_summaries: dict[int, dict[str, object]] = {}
    if tsm_ledger_service is not None and results:
        ledger_summaries, _ledger_message = tsm_ledger_service.fetch_item_ledgers(
            [result.item_id for result in results],
            enabled_realms or [],
        )

    serialized = []
    for result in results:
        observed_sell_price = None
        if latest_by_item:
            latest_sell_snapshots = latest_by_item.get(result.item_id, {}).get(result.best_sell_realm, [])
            if latest_sell_snapshots:
                observed_sell_price = float(latest_sell_snapshots[0].lowest_price or 0)
        ledger_summary = ledger_summaries.get(result.item_id, {})
        serialized.append(
            scan_result_to_schema(
                result,
                sell_history_prices=_extract_sell_history_prices(history_by_item, result.item_id, result.best_sell_realm),
                observed_sell_price=observed_sell_price,
                personal_sale_count=int(ledger_summary.get("auction_sale_count") or 0),
                personal_cancel_count=int(ledger_summary.get("cancel_count") or 0),
                personal_expired_count=int(ledger_summary.get("expired_count") or 0),
            )
        )
    return serialized


def _derive_tsm_market_context(
    item: Item | None,
    sell_realm: str | None = None,
    tsm_service: TsmMarketService | None = None,
    tsm_ledger_service: TsmLedgerService | None = None,
    enabled_realms: list[str] | None = None,
) -> TsmMarketContext | None:
    if item is None:
        return None

    realm_historical = None
    realm_market_value_recent = None
    realm_num_auctions = None
    if sell_realm and tsm_service is not None:
        realm_stats, _realm_message = tsm_service.fetch_realm_item_stats(item.item_id, sell_realm)
        if realm_stats:
            realm_historical = realm_stats.get("historical")
            realm_market_value_recent = realm_stats.get("market_value_recent")
            realm_num_auctions = realm_stats.get("num_auctions")

    personal_sale_count = 0
    personal_buy_count = 0
    personal_cancel_count = 0
    personal_expired_count = 0
    personal_avg_sale_price = None
    personal_sale_recency_days = None
    personal_negative_recency_days = None

    def _to_days_since(timestamp_iso: object) -> float | None:
        if not isinstance(timestamp_iso, str) or not timestamp_iso:
            return None
        try:
            parsed = datetime.fromisoformat(timestamp_iso.replace("Z", "+00:00"))
        except ValueError:
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        delta = datetime.now(timezone.utc) - parsed.astimezone(timezone.utc)
        return max(delta.total_seconds() / 86400.0, 0.0)

    if tsm_ledger_service is not None:
        ledger_summary, _ledger_message = tsm_ledger_service.fetch_item_ledger(item.item_id, enabled_realms or [])
        if ledger_summary:
            personal_sale_count = int(ledger_summary.get("auction_sale_count") or 0)
            personal_buy_count = int(ledger_summary.get("auction_buy_count") or 0)
            personal_cancel_count = int(ledger_summary.get("cancel_count") or 0)
            personal_expired_count = int(ledger_summary.get("expired_count") or 0)
            personal_avg_sale_price = ledger_summary.get("auction_avg_unit_sale_price")
            personal_sale_recency_days = _to_days_since(ledger_summary.get("last_auction_sale_at"))
            cancel_recency = _to_days_since(ledger_summary.get("last_cancel_at"))
            expired_recency = _to_days_since(ledger_summary.get("last_expired_at"))
            negative_recencies = [value for value in [cancel_recency, expired_recency] if value is not None]
            personal_negative_recency_days = min(negative_recencies) if negative_recencies else None

    if (
        realm_historical is None
        and realm_market_value_recent is None
        and realm_num_auctions is None
        and personal_sale_count == 0
        and personal_buy_count == 0
        and personal_cancel_count == 0
        and personal_expired_count == 0
        and personal_avg_sale_price is None
    ):
        return None

    return TsmMarketContext(
        realm_historical=float(realm_historical) if realm_historical is not None else None,
        realm_market_value_recent=float(realm_market_value_recent) if realm_market_value_recent is not None else None,
        realm_num_auctions=float(realm_num_auctions) if realm_num_auctions is not None else None,
        personal_sale_count=personal_sale_count,
        personal_buy_count=personal_buy_count,
        personal_cancel_count=personal_cancel_count,
        personal_expired_count=personal_expired_count,
        personal_avg_sale_price=float(personal_avg_sale_price) if personal_avg_sale_price is not None else None,
        personal_sale_recency_days=personal_sale_recency_days,
        personal_negative_recency_days=personal_negative_recency_days,
    )


def select_best_sell_snapshot(
    item,
    buy_snapshot,
    snapshots,
    settings,
    include_losers: bool,
    history_by_realm: dict[str, list] | None = None,
    tsm_service: TsmMarketService | None = None,
    tsm_ledger_service: TsmLedgerService | None = None,
    enabled_realms: list[str] | None = None,
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
            tsm_market=_derive_tsm_market_context(item, candidate.realm, tsm_service, tsm_ledger_service, enabled_realms),
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
    if not try_mark_scan_started(payload.provider_name):
        raise ScanAlreadyRunningError("A scan is already running.")
    try:
        mark_scan_stage("Resolving enabled realms and scanner readiness.")
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
            mark_scan_stage("Refreshing live listings from the selected provider.")
            inserted, warning = refresh_from_provider(session, realms, payload.provider_name)
            if warning:
                warning_parts.append(warning)
            elif inserted == 0:
                warning_parts.append("Provider refresh returned no rows; using cached listings.")

        mark_scan_stage("Loading the latest cached listings across tracked realms.")
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

        candidate_item_ids: list[int] = []
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
                candidate_item_ids.append(item_id)
            else:
                exploration_candidate_item_ids.append(item_id)

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
        tsm_ledger_service = TsmLedgerService(get_settings())

        scan_session = ScanSession(
            provider_name=payload.provider_name or "stored",
            warning_text=" ".join(warning_parts) if warning_parts else None,
        )
        session.add(scan_session)
        session.flush()

        mark_scan_stage("Scoring cross-realm opportunities.")
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
                tsm_service=tsm_service,
                tsm_ledger_service=tsm_ledger_service,
                enabled_realms=realms,
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
                    warning_parts.append(
                        f"Queued live Blizzard metadata refresh for {queued_count} scanned items and will keep retrying unresolved metadata in the background."
                    )

        if metadata_configured and readiness.items_missing_metadata:
            sweep_queued = queue_missing_metadata_sweep(limit=200)
            if sweep_queued:
                warning_parts.append(
                    f"Queued metadata sweep for {sweep_queued} unresolved cached items; the background worker will keep topping that queue off until the remaining items are resolved."
                )

        if warning_parts:
            scan_session.warning_text = " ".join(warning_parts)

        mark_scan_stage("Saving ranked results and queueing follow-up metadata work.")
        session.add_all(results)
        session.flush()
        record_scan_predictions(session, scan_session.id, results)
        session.commit()
        session.refresh(scan_session)

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
            results=_serialize_scan_results(results, history_by_item, latest_by_item, tsm_ledger_service, realms),
        )
        mark_scan_finished(response.provider_name, result_count=response.result_count, warning_text=response.warning_text)
        return response
    except Exception as exc:
        mark_scan_failed(payload.provider_name, f"Last scan failed: {exc}")
        raise


def get_scan_session(session: Session, scan_id: int, *, limit: int | None = None) -> ScanSessionRead | None:
    scan_session = session.get(ScanSession, scan_id)
    if scan_session is None:
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
    enabled_realms = get_enabled_realm_names(session)
    tsm_ledger_service = TsmLedgerService(get_settings())
    return ScanSessionRead(
        id=scan_session.id,
        provider_name=scan_session.provider_name,
        warning_text=scan_session.warning_text,
        generated_at=scan_session.generated_at,
        result_count=total_result_count,
        results=_serialize_scan_results(ordered_results, history_by_item, history_by_item, tsm_ledger_service, enabled_realms),
    )


def get_latest_scan(session: Session, *, limit: int | None = None) -> ScanSessionRead | None:
    latest = session.query(ScanSession).order_by(ScanSession.generated_at.desc()).first()
    if latest is None:
        return None
    return get_scan_session(session, latest.id, limit=limit)


def get_scan_history(session: Session, *, limit: int = 8) -> list[ScanSessionSummary]:
    rows = (
        session.query(
            ScanSession.id,
            ScanSession.generated_at,
            ScanSession.provider_name,
            func.count(ScanResult.id).label("result_count"),
        )
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
