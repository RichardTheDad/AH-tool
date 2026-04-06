from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import AppSettings, Item, ScanResult, ScanSession
from app.schemas.scan import ScanRunRequest, ScanSessionRead
from app.services.metadata_service import scan_result_to_schema
from app.services.listing_service import get_latest_snapshots_for_realms, mark_stale_snapshots, refresh_from_provider
from app.services.realm_service import get_enabled_realm_names
from app.services.scoring_service import score_opportunity


def select_cheapest_buy_snapshot(snapshots):
    return min(snapshots, key=lambda snapshot: float(snapshot.lowest_price or 0))


def select_best_sell_snapshot(item, buy_snapshot, snapshots, settings, include_losers: bool):
    candidates = [snapshot for snapshot in snapshots if snapshot.realm != buy_snapshot.realm]
    if not candidates:
        return None, None

    best_candidate = None
    best_score = None
    for candidate in candidates:
        score = score_opportunity(item, buy_snapshot, candidate, settings)
        if not include_losers and score.estimated_profit <= 0:
            continue
        if best_candidate is None or score.final_score > best_score.final_score:
            best_candidate = candidate
            best_score = score

    return best_candidate, best_score


def run_scan(session: Session, payload: ScanRunRequest) -> ScanSessionRead:
    realms = get_enabled_realm_names(session)
    if not realms:
        scan_session = ScanSession(provider_name=payload.provider_name or "stored", warning_text="No enabled realms configured.")
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
    if payload.refresh_live:
        inserted, warning = refresh_from_provider(session, realms, payload.provider_name)
        if warning:
            warning_parts.append(warning)
        elif inserted == 0:
            warning_parts.append("Provider refresh returned no rows; using cached listings.")

    mark_stale_snapshots(session)
    app_settings = session.get(AppSettings, 1) or AppSettings(id=1)
    latest_snapshots = get_latest_snapshots_for_realms(session, realms)

    grouped: dict[int, list] = {}
    for snapshot in latest_snapshots:
        if snapshot.lowest_price is None or snapshot.lowest_price <= 0:
            continue
        grouped.setdefault(snapshot.item_id, []).append(snapshot)

    scan_session = ScanSession(
        provider_name=payload.provider_name or "stored",
        warning_text=" ".join(warning_parts) if warning_parts else None,
    )
    session.add(scan_session)
    session.flush()

    results: list[ScanResult] = []
    for item_id, snapshots in grouped.items():
        item = session.get(Item, item_id)
        if item is None:
            continue
        if app_settings.non_commodity_only and item.is_commodity:
            continue
        if len(snapshots) < 2:
            continue

        buy_snapshot = select_cheapest_buy_snapshot(snapshots)
        best_candidate, best_score = select_best_sell_snapshot(
            item,
            buy_snapshot,
            snapshots,
            app_settings,
            payload.include_losers,
        )

        if best_candidate is None or best_score is None:
            continue

        result = ScanResult(
            scan_session_id=scan_session.id,
            item_id=item_id,
            cheapest_buy_realm=buy_snapshot.realm,
            cheapest_buy_price=buy_snapshot.lowest_price or 0,
            best_sell_realm=best_candidate.realm,
            best_sell_price=best_candidate.lowest_price or 0,
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

    results.sort(key=lambda result: (result.final_score, result.estimated_profit), reverse=True)
    session.add_all(results)
    session.commit()
    session.refresh(scan_session)

    return ScanSessionRead(
        id=scan_session.id,
        provider_name=scan_session.provider_name,
        warning_text=scan_session.warning_text,
        generated_at=scan_session.generated_at,
        result_count=len(results),
        results=[scan_result_to_schema(result) for result in results],
    )


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
