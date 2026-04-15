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
TARGET_REALIZATION_RATIO = 0.97
MAX_TARGET_CAPTURE_RATIO = 1.25


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


def _peak_target_capture(max_sell: float | None, predicted_sell_price: float) -> float:
    if max_sell is None or predicted_sell_price <= 0:
        return 0.0
    ratio = max_sell / predicted_sell_price
    return round(max(0.0, min(MAX_TARGET_CAPTURE_RATIO, ratio)), 4)


def _is_profitable_follow_through(max_sell: float | None, predicted_buy_price: float) -> bool:
    return bool(max_sell is not None and max_sell > predicted_buy_price)


def _empty_bucket() -> dict[str, float]:
    return {
        "total": 0,
        "realized": 0,
        "profitable": 0,
        "target_capture_sum": 0.0,
    }


def _apply_outcome(bucket: dict[str, float], outcome: dict[str, object]) -> None:
    bucket["total"] += 1
    bucket["realized"] += 1 if outcome.get("realized") else 0
    bucket["profitable"] += 1 if outcome.get("profitable") else 0
    bucket["target_capture_sum"] += float(outcome.get("peak_target_ratio") or 0.0)


def _build_horizon_outcome(
    *,
    event_generated_at: datetime,
    now: datetime,
    snapshot_points: list[tuple[datetime, float]],
    predicted_buy_price: float,
    predicted_sell_price: float,
    horizon_hours: int,
) -> dict[str, object] | None:
    if now < (event_generated_at + timedelta(hours=horizon_hours)):
        return None

    horizon_cutoff = event_generated_at + timedelta(hours=horizon_hours)
    horizon_prices = [price for captured_at, price in snapshot_points if captured_at <= horizon_cutoff and price > 0]
    max_sell = max(horizon_prices) if horizon_prices else None
    peak_target_ratio = _peak_target_capture(max_sell, predicted_sell_price)
    return {
        "evaluated": True,
        "realized": peak_target_ratio >= TARGET_REALIZATION_RATIO,
        "profitable": _is_profitable_follow_through(max_sell, predicted_buy_price),
        "max_sell": max_sell,
        "peak_target_ratio": peak_target_ratio,
        "snapshot_count": len(horizon_prices),
    }


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

        for horizon in HORIZONS_HOURS:
            key = str(horizon)
            already_evaluated = isinstance(outcomes.get(key), dict) and bool(outcomes.get(key, {}).get("evaluated"))
            if already_evaluated:
                continue
            outcome = _build_horizon_outcome(
                event_generated_at=event_generated_at,
                now=now,
                snapshot_points=snapshot_points,
                predicted_buy_price=float(event.predicted_buy_price),
                predicted_sell_price=float(event.predicted_sell_price),
                horizon_hours=horizon,
            )
            if outcome is None:
                continue
            outcomes[key] = outcome

        event.horizon_outcomes_json = outcomes

        horizon_72 = outcomes.get("72") if isinstance(outcomes.get("72"), dict) else None
        if horizon_72 and horizon_72.get("evaluated"):
            event.realized_outcome = bool(horizon_72.get("realized"))
            max_sell = horizon_72.get("max_sell")
            event.realized_sell_price = float(max_sell) if isinstance(max_sell, (float, int)) else None
            peak_target_ratio = float(horizon_72.get("peak_target_ratio") or 0.0)
            profitable = bool(horizon_72.get("profitable"))
            if event.realized_outcome:
                event.outcome_reason = f"72h peak reached {peak_target_ratio * 100:.1f}% of the recommended sell target."
            elif profitable:
                event.outcome_reason = (
                    f"72h peak stayed above the buy price but only reached {peak_target_ratio * 100:.1f}% of the recommended sell target."
                )
            else:
                event.outcome_reason = (
                    f"72h peak only reached {peak_target_ratio * 100:.1f}% of the recommended sell target and never cleared the buy price."
                )
            event.evaluated_at = now
            evaluated += 1
        elif now >= event_expires_at:
            event.realized_outcome = False
            event.realized_sell_price = None
            outcomes.setdefault(
                "72",
                {
                    "evaluated": True,
                    "realized": False,
                    "profitable": False,
                    "max_sell": None,
                    "peak_target_ratio": 0.0,
                    "snapshot_count": 0,
                },
            )
            event.horizon_outcomes_json = outcomes
            event.outcome_reason = "Calibration window expired before later sell snapshots showed any target follow-through."
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

    confidence_buckets: dict[str, dict[str, float]] = {}
    sellability_buckets: dict[str, dict[str, float]] = {}
    horizon_confidence: dict[int, dict[str, dict[str, float]]] = {h: {} for h in HORIZONS_HOURS}
    horizon_sellability: dict[int, dict[str, dict[str, float]]] = {h: {} for h in HORIZONS_HOURS}

    for event in events:
        confidence_band = _confidence_band(event.predicted_confidence)
        sellability_band = _sellability_band(event.predicted_sellability)
        outcomes = event.horizon_outcomes_json if isinstance(event.horizon_outcomes_json, dict) else {}
        summary_outcome = outcomes.get("72") if isinstance(outcomes.get("72"), dict) else None
        if summary_outcome is None:
            summary_outcome = {
                "evaluated": True,
                "realized": bool(event.realized_outcome),
                "profitable": _is_profitable_follow_through(event.realized_sell_price, event.predicted_buy_price),
                "peak_target_ratio": _peak_target_capture(event.realized_sell_price, event.predicted_sell_price),
            }

        confidence_stats = confidence_buckets.setdefault(confidence_band, _empty_bucket())
        _apply_outcome(confidence_stats, summary_outcome)

        sellability_stats = sellability_buckets.setdefault(sellability_band, _empty_bucket())
        _apply_outcome(sellability_stats, summary_outcome)

        for horizon in HORIZONS_HOURS:
            row = outcomes.get(str(horizon)) if isinstance(outcomes.get(str(horizon)), dict) else None
            if not row or not row.get("evaluated"):
                continue
            c_bucket = horizon_confidence[horizon].setdefault(confidence_band, _empty_bucket())
            _apply_outcome(c_bucket, row)

            s_bucket = horizon_sellability[horizon].setdefault(sellability_band, _empty_bucket())
            _apply_outcome(s_bucket, row)

    def _to_rows(buckets: dict[str, dict[str, float]]) -> list[CalibrationBandRead]:
        order = ["85-100", "75-84", "60-74", "40-59", "0-39"]
        rows: list[CalibrationBandRead] = []
        for band in order:
            stats = buckets.get(band)
            if not stats:
                continue
            total = int(stats["total"])
            realized = int(stats["realized"])
            profitable = int(stats["profitable"])
            rows.append(
                CalibrationBandRead(
                    band=band,
                    total=total,
                    realized=realized,
                    profitable=profitable,
                    realized_rate=round((realized / total) if total else 0.0, 4),
                    profitable_rate=round((profitable / total) if total else 0.0, 4),
                    avg_target_capture=round((stats["target_capture_sum"] / total) if total else 0.0, 4),
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
            if row.profitable_rate >= 0.65 and row.avg_target_capture >= 0.85:
                message = (
                    f"Confidence band {row.band} stays above the buy price {row.profitable_rate * 100:.0f}% of the time, but only captures "
                    f"about {row.avg_target_capture * 100:.0f}% of the sell target on average. Current sell targets look too ambitious."
                )
            else:
                message = (
                    f"Confidence band {row.band} is overconfident by about {abs(delta) * 100:.1f} points. "
                    f"Average target capture is only {row.avg_target_capture * 100:.0f}%. Consider reducing volatility weight or increasing thin-market penalties."
                )
            suggestions.append(
                CalibrationSuggestionRead(
                    level="warning",
                    message=message,
                    action_id="safe_calibration",
                    action_label="Apply safer tuning",
                )
            )
        elif delta >= 0.12:
            suggestions.append(
                CalibrationSuggestionRead(
                    level="info",
                    message=(
                        f"Confidence band {row.band} is conservative by about {delta * 100:.1f} points and captures "
                        f"{row.avg_target_capture * 100:.0f}% of the sell target on average. You can cautiously relax penalties if this persists."
                    ),
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
                    message=(
                        f"Sellability band {row.band} is overpredicting outcomes. It only captures about {row.avg_target_capture * 100:.0f}% of the sell target "
                        f"on average, with profitable follow-through in {row.profitable_rate * 100:.0f}% of cases. Consider increasing evidence gate strictness or depth requirements."
                    ),
                    action_id="safe_calibration",
                    action_label="Apply safer tuning",
                )
            )

    horizons: list[HorizonCalibrationRead] = []
    for horizon in HORIZONS_HOURS:
        confidence_rows = _to_rows(horizon_confidence[horizon])
        sellability_rows = _to_rows(horizon_sellability[horizon])
        total_horizon = sum(row.total for row in confidence_rows)
        realized_horizon = sum(row.realized for row in confidence_rows)
        profitable_horizon = sum(row.profitable for row in confidence_rows)
        target_capture_sum = sum(row.avg_target_capture * row.total for row in confidence_rows)
        horizons.append(
            HorizonCalibrationRead(
                horizon_hours=horizon,
                total_evaluated=total_horizon,
                realized_rate=round((realized_horizon / total_horizon) if total_horizon else 0.0, 4),
                profitable_rate=round((profitable_horizon / total_horizon) if total_horizon else 0.0, 4),
                avg_target_capture=round((target_capture_sum / total_horizon) if total_horizon else 0.0, 4),
                confidence_bands=confidence_rows,
                sellability_bands=sellability_rows,
            )
        )

    weekly_buckets: dict[tuple[datetime, datetime], dict[str, float]] = {}
    for event in events:
        event_generated_at = _as_utc(event.generated_at)
        outcomes = event.horizon_outcomes_json if isinstance(event.horizon_outcomes_json, dict) else {}
        period_start = event_generated_at - timedelta(days=event_generated_at.weekday())
        period_start = period_start.replace(hour=0, minute=0, second=0, microsecond=0)
        period_end = period_start + timedelta(days=7)
        bucket = weekly_buckets.setdefault(
            (period_start, period_end),
            {
                "total": 0,
                "realized": 0,
                "profitable": 0,
                "confidence_sum": 0.0,
                "sellability_sum": 0.0,
                "target_capture_sum": 0.0,
            },
        )
        summary_outcome = outcomes.get("72") if isinstance(outcomes.get("72"), dict) else None
        target_capture = float(summary_outcome.get("peak_target_ratio") or 0.0) if summary_outcome else _peak_target_capture(event.realized_sell_price, event.predicted_sell_price)
        profitable = bool(summary_outcome.get("profitable")) if summary_outcome else _is_profitable_follow_through(event.realized_sell_price, event.predicted_buy_price)
        bucket["total"] += 1
        bucket["realized"] += 1 if event.realized_outcome else 0
        bucket["profitable"] += 1 if profitable else 0
        bucket["confidence_sum"] += float(event.predicted_confidence)
        bucket["sellability_sum"] += float(event.predicted_sellability)
        bucket["target_capture_sum"] += target_capture

    trends: list[CalibrationTrendPointRead] = []
    for period_start, period_end in sorted(weekly_buckets.keys()):
        stats = weekly_buckets[(period_start, period_end)]
        total = int(stats["total"])
        realized = int(stats["realized"])
        profitable = int(stats["profitable"])
        trends.append(
            CalibrationTrendPointRead(
                period_start=period_start,
                period_end=period_end,
                total=total,
                realized=realized,
                profitable=profitable,
                realized_rate=round((realized / total) if total else 0.0, 4),
                profitable_rate=round((profitable / total) if total else 0.0, 4),
                avg_confidence=round((stats["confidence_sum"] / total) if total else 0.0, 2),
                avg_sellability=round((stats["sellability_sum"] / total) if total else 0.0, 2),
                avg_target_capture=round((stats["target_capture_sum"] / total) if total else 0.0, 4),
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
