from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from statistics import median

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import AppSettings, Item, RealmSuggestionRecommendation, RealmSuggestionRun, TrackedRealm
from app.schemas.listing import ListingImportRow
from app.schemas.realm_suggestion import SuggestedRealmItemRead, SuggestedRealmRead, SuggestedRealmReportRead
from app.services.listing_service import get_recent_snapshot_history_for_items
from app.services.provider_service import get_provider_registry
from app.services.realm_service import get_enabled_realm_names
from app.services.scan_service import select_best_sell_snapshot
from app.services.scoring_service import ScoreBreakdown
from app.services.undermine_service import build_undermine_item_url


DISCOVERY_BATCH_SIZE = 24
CONSISTENCY_WINDOW = 6


@dataclass
class DiscoverySnapshot:
    item_id: int
    realm: str
    lowest_price: float
    average_price: float | None
    quantity: int | None
    listing_count: int | None
    captured_at: datetime
    is_stale: bool = False


@dataclass
class SuggestedPair:
    source_realm: str
    target_realm: str
    item: Item
    score: ScoreBreakdown
    buy_price: float


def _round(value: float) -> float:
    return round(float(value), 2)


def _normalize_target_realms(target_realms: list[str] | None) -> list[str]:
    normalized: dict[str, str] = {}
    for realm in target_realms or []:
        cleaned = realm.strip()
        if not cleaned:
            continue
        normalized.setdefault(cleaned.casefold(), cleaned)
    return sorted(normalized.values(), key=str.casefold)


def _target_set_key(target_realms: list[str] | None) -> str | None:
    normalized = _normalize_target_realms(target_realms)
    if not normalized:
        return None
    return "|".join(realm.casefold() for realm in normalized)


def _load_items(session: Session, item_ids: set[int]) -> dict[int, Item]:
    if not item_ids:
        return {}
    items = session.query(Item).filter(Item.item_id.in_(sorted(item_ids))).all()
    return {item.item_id: item for item in items}


def _select_realm_batch(realms: list[str], prior_run_count: int, *, batch_size: int | None = None) -> tuple[list[str], int]:
    if not realms:
        return [], 0
    if batch_size is None:
        batch_size = DISCOVERY_BATCH_SIZE
    batch_size = max(1, min(batch_size, len(realms)))
    start = (prior_run_count * batch_size) % len(realms)
    if start + batch_size <= len(realms):
        return realms[start : start + batch_size], start
    overflow = (start + batch_size) - len(realms)
    return realms[start:] + realms[:overflow], start


def _hydrate_latest_rows(rows: list[ListingImportRow]) -> tuple[dict[int, dict[str, DiscoverySnapshot]], datetime | None]:
    by_item_realm: dict[int, dict[str, DiscoverySnapshot]] = defaultdict(dict)
    latest_captured_at = None
    for row in rows:
        if row.captured_at is None:
            continue
        snapshot = DiscoverySnapshot(
            item_id=row.item_id,
            realm=row.realm,
            lowest_price=float(row.lowest_price or 0),
            average_price=float(row.average_price) if row.average_price is not None else None,
            quantity=row.quantity,
            listing_count=row.listing_count,
            captured_at=row.captured_at.astimezone(timezone.utc),
        )
        by_item_realm[row.item_id][row.realm] = snapshot
        if latest_captured_at is None or snapshot.captured_at > latest_captured_at:
            latest_captured_at = snapshot.captured_at
    return by_item_realm, latest_captured_at


def _build_realm_explanation(
    realm: str,
    *,
    appearance_count: int = 0,
    cheap_run_count: int = 0,
    window_size: int = 0,
    cheapest_source_count: int,
    opportunity_count: int,
    best_target_realm: str | None = None,
) -> str:
    target_hint = best_target_realm or "your selected targets"
    if cheap_run_count >= max(2, window_size // 3) and window_size:
        return f"{realm} has been one of the cheapest source realms in {cheap_run_count} of the last {window_size} eligible discovery runs and still routes well into {target_hint}."
    if appearance_count >= max(2, window_size // 2) and window_size:
        return f"{realm} has shown up in {appearance_count} of the last {window_size} eligible discovery runs and keeps surfacing as a believable source for {target_hint}."
    if cheapest_source_count >= max(3, int(opportunity_count * 0.4)):
        return f"{realm} was one of the cheapest sources for a large share of this batch and the items still look sellable on {target_hint}."
    return f"{realm} looks promising in the latest rotating discovery batch, but it still needs more eligible runs before you should treat it as a stable source realm."


def _pair_to_item(pair: SuggestedPair) -> SuggestedRealmItemRead:
    return SuggestedRealmItemRead(
        item_id=pair.item.item_id,
        item_name=pair.item.name,
        undermine_url=build_undermine_item_url(pair.item.item_id, pair.source_realm),
        target_realm=pair.target_realm,
        buy_price=pair.buy_price,
        target_sell_price=pair.score.recommended_sell_price,
        estimated_profit=pair.score.estimated_profit,
        roi=pair.score.roi,
        confidence_score=pair.score.confidence_score,
        sellability_score=pair.score.sellability_score,
        turnover_label=pair.score.turnover_label,
    )


def _build_current_recommendations(
    *,
    session: Session,
    user_id: str,
    target_realms: list[str],
    source_realms: list[str],
    fetched_rows: list[ListingImportRow],
) -> tuple[list[SuggestedRealmRead], datetime | None]:
    latest_by_item_realm, generated_at = _hydrate_latest_rows(fetched_rows)
    item_ids = set(latest_by_item_realm.keys())
    items_by_id = _load_items(session, item_ids)
    history_realms = sorted(set(target_realms + source_realms), key=str.casefold)
    history_by_item = get_recent_snapshot_history_for_items(session, list(item_ids), history_realms, limit_per_realm=6)
    settings = session.query(AppSettings).filter(AppSettings.user_id == user_id).first() or AppSettings(user_id=user_id)
    app_settings = get_settings()

    cheapest_source_counts: dict[str, int] = defaultdict(int)
    preferred_target_counts_by_source: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    pairs_by_realm: dict[str, list[SuggestedPair]] = defaultdict(list)

    for item_id, realm_map in latest_by_item_realm.items():
        item = items_by_id.get(item_id)
        if item is None or item.is_commodity:
            continue

        target_snapshots = [realm_map[realm] for realm in target_realms if realm in realm_map and realm_map[realm].lowest_price > 0]
        if not target_snapshots:
            continue

        source_snapshots = [realm_map[realm] for realm in source_realms if realm in realm_map and realm_map[realm].lowest_price > 0]
        if not source_snapshots:
            continue

        strongest_target_snapshot = max(target_snapshots, key=lambda snapshot: snapshot.lowest_price)

        cheapest_snapshot = min(source_snapshots, key=lambda snapshot: snapshot.lowest_price)
        cheapest_source_counts[cheapest_snapshot.realm] += 1

        for buy_snapshot in source_snapshots:
            preferred_target_counts_by_source[buy_snapshot.realm][strongest_target_snapshot.realm] += 1
            sell_snapshot, score = select_best_sell_snapshot(
                item,
                buy_snapshot,
                target_snapshots,
                settings,
                include_losers=False,
                history_by_realm=history_by_item.get(item_id),
            )
            if sell_snapshot is None or score is None:
                continue
            pairs_by_realm[buy_snapshot.realm].append(
                SuggestedPair(
                    source_realm=buy_snapshot.realm,
                    target_realm=sell_snapshot.realm,
                    item=item,
                    score=score,
                    buy_price=buy_snapshot.lowest_price,
                )
            )

    recommendations: list[SuggestedRealmRead] = []
    for realm, pairs in pairs_by_realm.items():
        if not pairs:
            continue
        pairs.sort(key=lambda pair: (pair.score.final_score, pair.score.estimated_profit), reverse=True)
        opportunity_count = len(pairs)
        cheapest_source_count = cheapest_source_counts.get(realm, 0)
        average_profit = _round(sum(pair.score.estimated_profit for pair in pairs) / opportunity_count)
        average_roi = _round(sum(pair.score.roi for pair in pairs) / opportunity_count)
        average_confidence = _round(sum(pair.score.confidence_score for pair in pairs) / opportunity_count)
        average_sellability = _round(sum(pair.score.sellability_score for pair in pairs) / opportunity_count)
        median_buy_price = _round(median([pair.buy_price for pair in pairs])) if pairs else None
        target_counts: dict[str, int] = defaultdict(int)
        target_sell_totals: dict[str, float] = defaultdict(float)
        target_score_totals: dict[str, float] = defaultdict(float)
        for pair in pairs:
            target_counts[pair.target_realm] += 1
            target_sell_totals[pair.target_realm] += pair.score.recommended_sell_price
            target_score_totals[pair.target_realm] += pair.score.final_score
        preferred_targets = preferred_target_counts_by_source.get(realm, {})
        if preferred_targets:
            best_target_realm = max(
                preferred_targets,
                key=lambda realm_name: (
                    preferred_targets[realm_name],
                    target_sell_totals.get(realm_name, 0),
                    target_score_totals.get(realm_name, 0),
                ),
            )
        else:
            best_target_realm = max(
                target_counts,
                key=lambda realm_name: (
                    target_counts[realm_name],
                    target_sell_totals[realm_name],
                    target_score_totals[realm_name],
                ),
            ) if target_counts else None
        consistency_score = _round(
            min(
                100,
                (average_confidence * 0.34)
                + (average_sellability * 0.34)
                + (min(cheapest_source_count / max(opportunity_count, 1), 1.0) * 20)
                + (min(opportunity_count, 12) / 12 * 12),
            )
        )
        recommendations.append(
            SuggestedRealmRead(
                realm=realm,
                opportunity_count=opportunity_count,
                cheapest_source_count=cheapest_source_count,
                average_profit=average_profit,
                average_roi=average_roi,
                average_confidence=average_confidence,
                average_sellability=average_sellability,
                consistency_score=consistency_score,
                median_buy_price=median_buy_price,
                best_target_realm=best_target_realm,
                latest_captured_at=generated_at,
                explanation=_build_realm_explanation(
                    realm,
                    cheapest_source_count=cheapest_source_count,
                    opportunity_count=opportunity_count,
                    best_target_realm=best_target_realm,
                ),
                top_items=[_pair_to_item(pair) for pair in pairs[:5]],
            )
        )

    recommendations.sort(
        key=lambda recommendation: (
            recommendation.consistency_score,
            recommendation.average_profit,
            recommendation.opportunity_count,
        ),
        reverse=True,
    )
    return recommendations[:20], generated_at


def _run_matches_targets(run: RealmSuggestionRun, target_realms: list[str]) -> bool:
    return _normalize_target_realms(run.target_realms_json or []) == _normalize_target_realms(target_realms)


def _load_recent_runs_for_target_set(
    session: Session,
    *,
    target_set_key: str | None,
    limit: int,
    user_id: str | None = None,
) -> list[RealmSuggestionRun]:
    query = session.query(RealmSuggestionRun)
    if user_id is not None:
        query = query.filter(RealmSuggestionRun.user_id == user_id)
    if target_set_key is not None:
        query = query.filter(RealmSuggestionRun.target_set_key == target_set_key)
    return query.order_by(RealmSuggestionRun.generated_at.desc()).limit(limit).all()


def _serialize_run(
    run: RealmSuggestionRun | None,
    *,
    tracked_realms: set[str],
    prior_runs: list[RealmSuggestionRun] | None = None,
) -> SuggestedRealmReportRead | None:
    if run is None:
        return None

    comparison_runs = prior_runs or [run]
    realm_appearances: dict[str, int] = defaultdict(int)
    realm_eligible_runs: dict[str, int] = defaultdict(int)
    realm_cheap_runs: dict[str, int] = defaultdict(int)
    realm_last_seen_cheapest_at: dict[str, datetime] = {}
    for prior_run in comparison_runs:
        eligible_realms = set(prior_run.source_realms_json or [])
        for realm_name in eligible_realms:
            realm_eligible_runs[realm_name] += 1
        for recommendation in prior_run.recommendations:
            realm_appearances[recommendation.realm] += 1
            if recommendation.cheapest_source_count > 0:
                realm_cheap_runs[recommendation.realm] += 1
                seen_at = recommendation.latest_captured_at or prior_run.generated_at
                previous_seen_at = realm_last_seen_cheapest_at.get(recommendation.realm)
                if previous_seen_at is None or seen_at > previous_seen_at:
                    realm_last_seen_cheapest_at[recommendation.realm] = seen_at

    built_recommendations: list[SuggestedRealmRead] = []
    for recommendation in run.recommendations:
        eligible_runs = max(realm_eligible_runs.get(recommendation.realm, 0), 1)
        coverage_factor = min(eligible_runs / 4.0, 1.0)
        adjusted_consistency = round(float(recommendation.consistency_score) * (0.55 + (0.45 * coverage_factor)), 2)
        built_recommendations.append(
            SuggestedRealmRead(
                realm=recommendation.realm,
                opportunity_count=recommendation.opportunity_count,
                cheapest_source_count=recommendation.cheapest_source_count,
                average_profit=recommendation.average_profit,
                average_roi=recommendation.average_roi,
                average_confidence=recommendation.average_confidence,
                average_sellability=recommendation.average_sellability,
                consistency_score=adjusted_consistency,
                latest_captured_at=recommendation.latest_captured_at,
                appearance_count=realm_appearances.get(recommendation.realm, 0),
                cheap_run_count=realm_cheap_runs.get(recommendation.realm, 0),
                window_size=eligible_runs,
                recent_run_count=len(comparison_runs),
                median_buy_price=recommendation.median_buy_price,
                best_target_realm=recommendation.best_target_realm,
                last_seen_cheapest_at=realm_last_seen_cheapest_at.get(recommendation.realm),
                is_tracked=recommendation.realm in tracked_realms,
                explanation=_build_realm_explanation(
                    recommendation.realm,
                    appearance_count=realm_appearances.get(recommendation.realm, 0),
                    cheap_run_count=realm_cheap_runs.get(recommendation.realm, 0),
                    window_size=eligible_runs,
                    cheapest_source_count=recommendation.cheapest_source_count,
                    opportunity_count=recommendation.opportunity_count,
                    best_target_realm=recommendation.best_target_realm,
                ),
                top_items=[SuggestedRealmItemRead.model_validate(item) for item in (recommendation.top_items_json or [])],
            )
        )

    recommendations = sorted(
        built_recommendations,
        key=lambda recommendation: (recommendation.consistency_score, recommendation.average_profit),
        reverse=True,
    )

    return SuggestedRealmReportRead(
        generated_at=run.generated_at,
        target_realms=list(run.target_realms_json or []),
        source_realm_count=run.source_realm_count,
        warning_text=run.warning_text,
        recommendations=recommendations,
    )


def get_latest_realm_suggestions(session: Session, user_id: str, *, target_realms: list[str] | None = None) -> SuggestedRealmReportRead | None:
    normalized_targets = _normalize_target_realms(target_realms)
    tracked_realms = {realm.realm_name for realm in session.query(TrackedRealm).filter(TrackedRealm.user_id == user_id).all()}
    if normalized_targets:
        target_set_key = _target_set_key(normalized_targets)
        recent_runs = _load_recent_runs_for_target_set(session, target_set_key=target_set_key, limit=CONSISTENCY_WINDOW, user_id=user_id)
        latest_run = recent_runs[0] if recent_runs else None
        prior_runs = recent_runs[:CONSISTENCY_WINDOW]
    else:
        latest_run = session.query(RealmSuggestionRun).filter(RealmSuggestionRun.user_id == user_id).order_by(RealmSuggestionRun.generated_at.desc()).first()
        if latest_run is None:
            return None
        if latest_run.target_set_key:
            prior_runs = _load_recent_runs_for_target_set(session, target_set_key=latest_run.target_set_key, limit=CONSISTENCY_WINDOW, user_id=user_id)
        else:
            prior_runs = [latest_run]
    if latest_run is None:
        return None
    return _serialize_run(latest_run, tracked_realms=tracked_realms, prior_runs=prior_runs)


def run_realm_suggestions(session: Session, user_id: str, *, target_realms: list[str] | None = None) -> SuggestedRealmReportRead:
    selected_target_realms = _normalize_target_realms(target_realms)
    tracked_enabled_realms = get_enabled_realm_names(session, user_id)
    target_realms = _normalize_target_realms(selected_target_realms or tracked_enabled_realms)
    tracked_realms = {realm.realm_name for realm in session.query(TrackedRealm).filter(TrackedRealm.user_id == user_id).all()}
    if not target_realms:
        return SuggestedRealmReportRead(
            generated_at=None,
            target_realms=[],
            source_realm_count=0,
            warning_text="Add at least one enabled target realm before requesting source realm suggestions.",
            recommendations=[],
        )

    provider = get_provider_registry().get_listing_provider("blizzard_auctions")
    available, message = provider.is_available()
    if not available:
        return SuggestedRealmReportRead(
            generated_at=None,
            target_realms=target_realms,
            source_realm_count=0,
            warning_text=message,
            recommendations=[],
        )

    available_realms = [realm for realm in provider.list_available_realms() if realm not in target_realms]
    if not available_realms:
        return SuggestedRealmReportRead(
            generated_at=None,
            target_realms=target_realms,
            source_realm_count=0,
            warning_text="No additional US source realms are currently available for discovery.",
            recommendations=[],
        )

    target_set_key = _target_set_key(target_realms)
    prior_run_count = (
        session.query(RealmSuggestionRun)
        .filter(RealmSuggestionRun.user_id == user_id, RealmSuggestionRun.target_set_key == target_set_key)
        .count()
    )
    source_batch, batch_start = _select_realm_batch(sorted(available_realms), prior_run_count)
    rows = provider.fetch_listings(sorted(set(target_realms + source_batch)))
    if not rows:
        return SuggestedRealmReportRead(
            generated_at=None,
            target_realms=target_realms,
            source_realm_count=len(source_batch),
            warning_text=provider.last_error or "Blizzard realm discovery returned no listings.",
            recommendations=[],
        )

    recommendations, generated_at = _build_current_recommendations(
        session=session,
        user_id=user_id,
        target_realms=target_realms,
        source_realms=source_batch,
        fetched_rows=rows,
    )
    warning_text = None if recommendations else "This rotating discovery batch did not surface strong source realms for your current targets."
    run = RealmSuggestionRun(
        user_id=user_id,
        generated_at=generated_at or datetime.now(timezone.utc),
        target_set_key=target_set_key,
        target_realms_json=target_realms,
        source_realms_json=source_batch,
        batch_start=batch_start,
        batch_size=len(source_batch),
        source_realm_count=len(source_batch),
        warning_text=warning_text,
    )
    session.add(run)
    session.flush()
    session.add_all(
        [
            RealmSuggestionRecommendation(
                run_id=run.id,
                realm=recommendation.realm,
                opportunity_count=recommendation.opportunity_count,
                cheapest_source_count=recommendation.cheapest_source_count,
                average_profit=recommendation.average_profit,
                average_roi=recommendation.average_roi,
                average_confidence=recommendation.average_confidence,
                average_sellability=recommendation.average_sellability,
                consistency_score=recommendation.consistency_score,
                median_buy_price=recommendation.median_buy_price,
                best_target_realm=recommendation.best_target_realm,
                latest_captured_at=recommendation.latest_captured_at,
                explanation=recommendation.explanation,
                top_items_json=[item.model_dump() for item in recommendation.top_items],
            )
            for recommendation in recommendations
        ]
    )
    session.commit()
    session.refresh(run)

    prior_runs = _load_recent_runs_for_target_set(session, target_set_key=target_set_key, limit=CONSISTENCY_WINDOW, user_id=user_id)
    return _serialize_run(run, tracked_realms=tracked_realms, prior_runs=prior_runs) or SuggestedRealmReportRead(
        generated_at=run.generated_at,
        target_realms=target_realms,
        source_realm_count=len(source_batch),
        warning_text=warning_text,
        recommendations=[],
    )


def should_refresh_realm_suggestions(
    session: Session,
    *,
    target_realms: list[str] | None = None,
    cooldown_minutes: int,
) -> tuple[bool, RealmSuggestionRun | None]:
    resolved_targets = _normalize_target_realms(target_realms or get_enabled_realm_names(session))
    if not resolved_targets:
        return False, None

    target_set_key = _target_set_key(resolved_targets)
    latest_run = (
        session.query(RealmSuggestionRun)
        .filter(RealmSuggestionRun.target_set_key == target_set_key)
        .order_by(RealmSuggestionRun.generated_at.desc())
        .first()
    )
    if latest_run is None:
        return True, None

    generated_at = latest_run.generated_at
    if generated_at.tzinfo is None:
        generated_at = generated_at.replace(tzinfo=timezone.utc)
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=max(1, cooldown_minutes))
    return generated_at <= cutoff, latest_run
