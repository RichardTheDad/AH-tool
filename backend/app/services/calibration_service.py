from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.db.models import ListingSnapshot, ScanResult, ScoreCalibrationEvent
from app.schemas.scan import (
    CalibrationBandRead,
    CalibrationSuggestionRead,
    CalibrationTrendPointRead,
    HorizonCalibrationRead,
    ScanCalibrationSummaryRead,
)


HORIZONS_HOURS = [24, 48, 72]


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _confidence_band(score: float) -> str:
    if score >= 85:
        return "85-100"
    if score >= 75:
        return "75-84"
    if score >= 60:
        return "60-74"
    if score >= 40:
        return "40-59"
    return "0-39"


def _sellability_band(score: float) -> str:
    if score >= 85:
        return "85-100"
    if score >= 75:
        return "75-84"
    if score >= 60:
        return "60-74"
    if score >= 40:
        return "40-59"
    return "0-39"


def record_scan_predictions(
    session: Session,
    scan_session_id: int,
    user_id: str,
    results: list[ScanResult],
    *,
    evaluation_delay_hours: int = 24,
    evaluation_window_hours: int = 72,
) -> int:
    if not results:
        return 0

    now = datetime.now(timezone.utc)
    due_at = now + timedelta(hours=max(1, evaluation_delay_hours))
    expires_at = now + timedelta(hours=max(24, evaluation_window_hours))

    events = [
        ScoreCalibrationEvent(
            scan_result_id=result.id,
            scan_session_id=scan_session_id,
            user_id=user_id,
            item_id=result.item_id,
            buy_realm=result.cheapest_buy_realm,
            sell_realm=result.best_sell_realm,
            predicted_confidence=float(result.confidence_score),
            predicted_sellability=float(result.sellability_score),
            predicted_profit=float(result.estimated_profit),
            predicted_buy_price=float(result.cheapest_buy_price),
            predicted_sell_price=float(result.best_sell_price),
            generated_at=now,
            evaluation_due_at=due_at,
            evaluation_expires_at=expires_at,
            horizon_outcomes_json={},
        )
        for result in results
    ]
    session.add_all(events)
    return len(events)


def evaluate_due_predictions(session: Session, *, limit: int = 500) -> int:
    now = datetime.now(timezone.utc)
    events = (
        session.query(ScoreCalibrationEvent)
        .filter(
            ScoreCalibrationEvent.evaluated_at.is_(None),
            ScoreCalibrationEvent.evaluation_due_at <= now,
        )
        .order_by(ScoreCalibrationEvent.evaluation_due_at.asc())
        .limit(limit)
        .all()
    )

    evaluated = 0
    for event in events:
        event_generated_at = _as_utc(event.generated_at)
        event_expires_at = _as_utc(event.evaluation_expires_at)
        outcomes = dict(event.horizon_outcomes_json or {})
        snapshots = (
            session.query(ListingSnapshot)
            .filter(
                ListingSnapshot.item_id == event.item_id,
                ListingSnapshot.realm == event.sell_realm,
                ListingSnapshot.captured_at >= event_generated_at,
                ListingSnapshot.captured_at <= now,
            )
            .order_by(ListingSnapshot.captured_at.asc())
            .all()
        )
        snapshot_points = [
            (_as_utc(snapshot.captured_at), float(snapshot.lowest_price or 0))
            for snapshot in snapshots
        ]

        def _max_sell_until(hours: int) -> float | None:
            horizon_cutoff = event_generated_at + timedelta(hours=hours)
            horizon_prices = [price for captured_at, price in snapshot_points if captured_at <= horizon_cutoff and price > 0]
            if not horizon_prices:
                return None
            value = max(horizon_prices)
            return value if value > 0 else None

        for horizon in HORIZONS_HOURS:
            key = str(horizon)
            already_evaluated = isinstance(outcomes.get(key), dict) and bool(outcomes.get(key, {}).get("evaluated"))
            if already_evaluated:
                continue
            if now < (event_generated_at + timedelta(hours=horizon)):
                continue

            max_sell = _max_sell_until(horizon)
            realized = bool(max_sell is not None and max_sell >= (event.predicted_sell_price * 0.97))
            outcomes[key] = {
                "evaluated": True,
                "realized": realized,
                "max_sell": max_sell,
            }

        event.horizon_outcomes_json = outcomes

        horizon_72 = outcomes.get("72") if isinstance(outcomes.get("72"), dict) else None
        if horizon_72 and horizon_72.get("evaluated"):
            event.realized_outcome = bool(horizon_72.get("realized"))
            max_sell = horizon_72.get("max_sell")
            event.realized_sell_price = float(max_sell) if isinstance(max_sell, (float, int)) else None
            event.outcome_reason = (
                "72h horizon reached >=97% of recommended sell target."
                if event.realized_outcome
                else "72h horizon did not reach >=97% of recommended sell target."
            )
            event.evaluated_at = now
            evaluated += 1
        elif now >= event_expires_at:
            event.realized_outcome = False
            event.realized_sell_price = None
            event.outcome_reason = "Calibration window expired before a 72h horizon match could be confirmed."
            event.evaluated_at = now
            evaluated += 1

    if evaluated:
        session.commit()
    return evaluated


def get_calibration_summary(session: Session, user_id: str, *, days: int = 30) -> ScanCalibrationSummaryRead:
    cutoff = datetime.now(timezone.utc) - timedelta(days=max(1, days))
    events = (
        session.query(ScoreCalibrationEvent)
        .filter(
            ScoreCalibrationEvent.user_id == user_id,
            ScoreCalibrationEvent.evaluated_at.is_not(None),
            ScoreCalibrationEvent.generated_at >= cutoff,
        )
        .all()
    )

    confidence_buckets: dict[str, dict[str, int]] = {}
    sellability_buckets: dict[str, dict[str, int]] = {}
    horizon_confidence: dict[int, dict[str, dict[str, int]]] = {h: {} for h in HORIZONS_HOURS}
    horizon_sellability: dict[int, dict[str, dict[str, int]]] = {h: {} for h in HORIZONS_HOURS}

    for event in events:
        confidence_band = _confidence_band(event.predicted_confidence)
        sellability_band = _sellability_band(event.predicted_sellability)
        realized = 1 if event.realized_outcome else 0

        confidence_stats = confidence_buckets.setdefault(confidence_band, {"total": 0, "realized": 0})
        confidence_stats["total"] += 1
        confidence_stats["realized"] += realized

        sellability_stats = sellability_buckets.setdefault(sellability_band, {"total": 0, "realized": 0})
        sellability_stats["total"] += 1
        sellability_stats["realized"] += realized

        outcomes = event.horizon_outcomes_json if isinstance(event.horizon_outcomes_json, dict) else {}
        for horizon in HORIZONS_HOURS:
            row = outcomes.get(str(horizon)) if isinstance(outcomes.get(str(horizon)), dict) else None
            if not row or not row.get("evaluated"):
                continue
            horizon_realized = 1 if row.get("realized") else 0

            c_bucket = horizon_confidence[horizon].setdefault(confidence_band, {"total": 0, "realized": 0})
            c_bucket["total"] += 1
            c_bucket["realized"] += horizon_realized

            s_bucket = horizon_sellability[horizon].setdefault(sellability_band, {"total": 0, "realized": 0})
            s_bucket["total"] += 1
            s_bucket["realized"] += horizon_realized

    def _to_rows(buckets: dict[str, dict[str, int]]) -> list[CalibrationBandRead]:
        order = ["85-100", "75-84", "60-74", "40-59", "0-39"]
        rows: list[CalibrationBandRead] = []
        for band in order:
            stats = buckets.get(band)
            if not stats:
                continue
            total = stats["total"]
            realized = stats["realized"]
            rows.append(
                CalibrationBandRead(
                    band=band,
                    total=total,
                    realized=realized,
                    realized_rate=round((realized / total) if total else 0.0, 4),
                )
            )
        return rows

    def _expected_from_band(band: str) -> float:
        start, end = band.split("-")
        return ((float(start) + float(end)) / 2.0) / 100.0

    suggestions: list[CalibrationSuggestionRead] = []

    for row in _to_rows(confidence_buckets):
        if row.total < 25:
            continue
        expected = _expected_from_band(row.band)
        delta = row.realized_rate - expected
        if delta <= -0.12:
            suggestions.append(
                CalibrationSuggestionRead(
                    level="warning",
                    message=f"Confidence band {row.band} is overconfident by about {abs(delta) * 100:.1f} points. Consider reducing volatility weight or increasing thin-market penalties.",
                    action_id="safe_calibration",
                    action_label="Apply safer tuning",
                )
            )
        elif delta >= 0.12:
            suggestions.append(
                CalibrationSuggestionRead(
                    level="info",
                    message=f"Confidence band {row.band} is conservative by about {delta * 100:.1f} points. You can cautiously relax penalties if this persists.",
                    action_id="balanced_default",
                    action_label="Restore balanced tuning",
                )
            )

    for row in _to_rows(sellability_buckets):
        if row.total < 25:
            continue
        expected = _expected_from_band(row.band)
        delta = row.realized_rate - expected
        if delta <= -0.12:
            suggestions.append(
                CalibrationSuggestionRead(
                    level="warning",
                    message=f"Sellability band {row.band} is overpredicting outcomes. Consider increasing evidence gate strictness or depth requirements.",
                    action_id="safe_calibration",
                    action_label="Apply safer tuning",
                )
            )

    horizons: list[HorizonCalibrationRead] = []
    for horizon in HORIZONS_HOURS:
        confidence_rows = _to_rows(horizon_confidence[horizon])
        sellability_rows = _to_rows(horizon_sellability[horizon])
        total_horizon = sum(row.total for row in confidence_rows)
        horizons.append(
            HorizonCalibrationRead(
                horizon_hours=horizon,
                total_evaluated=total_horizon,
                confidence_bands=confidence_rows,
                sellability_bands=sellability_rows,
            )
        )

    weekly_buckets: dict[tuple[datetime, datetime], dict[str, float]] = {}
    for event in events:
        event_generated_at = _as_utc(event.generated_at)
        period_start = event_generated_at - timedelta(days=event_generated_at.weekday())
        period_start = period_start.replace(hour=0, minute=0, second=0, microsecond=0)
        period_end = period_start + timedelta(days=7)
        bucket = weekly_buckets.setdefault(
            (period_start, period_end),
            {
                "total": 0,
                "realized": 0,
                "confidence_sum": 0.0,
                "sellability_sum": 0.0,
            },
        )
        bucket["total"] += 1
        bucket["realized"] += 1 if event.realized_outcome else 0
        bucket["confidence_sum"] += float(event.predicted_confidence)
        bucket["sellability_sum"] += float(event.predicted_sellability)

    trends: list[CalibrationTrendPointRead] = []
    for period_start, period_end in sorted(weekly_buckets.keys()):
        stats = weekly_buckets[(period_start, period_end)]
        total = int(stats["total"])
        realized = int(stats["realized"])
        trends.append(
            CalibrationTrendPointRead(
                period_start=period_start,
                period_end=period_end,
                total=total,
                realized=realized,
                realized_rate=round((realized / total) if total else 0.0, 4),
                avg_confidence=round((stats["confidence_sum"] / total) if total else 0.0, 2),
                avg_sellability=round((stats["sellability_sum"] / total) if total else 0.0, 2),
            )
        )

    return ScanCalibrationSummaryRead(
        total_evaluated=len(events),
        confidence_bands=_to_rows(confidence_buckets),
        sellability_bands=_to_rows(sellability_buckets),
        horizons=horizons,
        trends=trends,
        suggestions=suggestions,
    )
