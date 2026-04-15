from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.db.models import Item, ListingSnapshot, ScoreCalibrationEvent
from app.db.session import get_session_factory
from app.services.calibration_service import evaluate_due_predictions, get_calibration_summary


SYSTEM_USER_ID = "system"


def test_evaluate_due_predictions_tracks_target_capture_and_profitability(client) -> None:
    del client
    session = get_session_factory()()
    try:
        now = datetime.now(timezone.utc)
        generated_at = now - timedelta(hours=80)
        item = Item(item_id=101, name="Calibration Test Item", is_commodity=False)
        event = ScoreCalibrationEvent(
            user_id=SYSTEM_USER_ID,
            item_id=item.item_id,
            buy_realm="Area 52",
            sell_realm="Stormrage",
            predicted_confidence=82.0,
            predicted_sellability=76.0,
            predicted_profit=90.0,
            predicted_buy_price=100.0,
            predicted_sell_price=200.0,
            generated_at=generated_at,
            evaluation_due_at=generated_at + timedelta(hours=24),
            evaluation_expires_at=generated_at + timedelta(hours=72),
            horizon_outcomes_json={},
        )
        snapshots = [
            ListingSnapshot(
                item_id=item.item_id,
                realm="Stormrage",
                lowest_price=150.0,
                average_price=150.0,
                quantity=4,
                listing_count=2,
                source_name="test",
                captured_at=generated_at + timedelta(hours=20),
                is_stale=False,
            ),
            ListingSnapshot(
                item_id=item.item_id,
                realm="Stormrage",
                lowest_price=180.0,
                average_price=180.0,
                quantity=4,
                listing_count=2,
                source_name="test",
                captured_at=generated_at + timedelta(hours=40),
                is_stale=False,
            ),
            ListingSnapshot(
                item_id=item.item_id,
                realm="Stormrage",
                lowest_price=210.0,
                average_price=210.0,
                quantity=4,
                listing_count=2,
                source_name="test",
                captured_at=generated_at + timedelta(hours=60),
                is_stale=False,
            ),
        ]

        session.add(item)
        session.add(event)
        session.add_all(snapshots)
        session.commit()

        evaluated = evaluate_due_predictions(session)
        session.refresh(event)

        outcomes = event.horizon_outcomes_json or {}
        assert evaluated == 1
        assert outcomes["24"]["realized"] is False
        assert outcomes["24"]["profitable"] is True
        assert outcomes["24"]["peak_target_ratio"] == pytest.approx(0.75, rel=1e-4)
        assert outcomes["48"]["peak_target_ratio"] == pytest.approx(0.9, rel=1e-4)
        assert outcomes["72"]["realized"] is True
        assert outcomes["72"]["profitable"] is True
        assert outcomes["72"]["peak_target_ratio"] == pytest.approx(1.05, rel=1e-4)
        assert event.realized_outcome is True
        assert event.realized_sell_price == pytest.approx(210.0, rel=1e-4)
        assert "105.0%" in (event.outcome_reason or "")
    finally:
        session.close()


def test_calibration_summary_reports_target_capture_and_above_buy_rates(client) -> None:
    del client
    session = get_session_factory()()
    try:
        now = datetime.now(timezone.utc)
        item = Item(item_id=202, name="Summary Test Item", is_commodity=False)
        first_event = ScoreCalibrationEvent(
            user_id=SYSTEM_USER_ID,
            item_id=item.item_id,
            buy_realm="Area 52",
            sell_realm="Stormrage",
            predicted_confidence=88.0,
            predicted_sellability=78.0,
            predicted_profit=75.0,
            predicted_buy_price=100.0,
            predicted_sell_price=200.0,
            generated_at=now - timedelta(days=4),
            evaluation_due_at=now - timedelta(days=3),
            evaluation_expires_at=now - timedelta(days=1),
            horizon_outcomes_json={
                "72": {
                    "evaluated": True,
                    "realized": True,
                    "profitable": True,
                    "max_sell": 210.0,
                    "peak_target_ratio": 1.05,
                    "snapshot_count": 3,
                }
            },
            evaluated_at=now - timedelta(days=1),
            realized_outcome=True,
            realized_sell_price=210.0,
            outcome_reason="72h peak reached 105.0% of the recommended sell target.",
        )
        second_event = ScoreCalibrationEvent(
            user_id=SYSTEM_USER_ID,
            item_id=item.item_id,
            buy_realm="Illidan",
            sell_realm="Stormrage",
            predicted_confidence=86.0,
            predicted_sellability=79.0,
            predicted_profit=60.0,
            predicted_buy_price=100.0,
            predicted_sell_price=200.0,
            generated_at=now - timedelta(days=3),
            evaluation_due_at=now - timedelta(days=2),
            evaluation_expires_at=now - timedelta(hours=12),
            horizon_outcomes_json={
                "72": {
                    "evaluated": True,
                    "realized": False,
                    "profitable": True,
                    "max_sell": 164.0,
                    "peak_target_ratio": 0.82,
                    "snapshot_count": 3,
                }
            },
            evaluated_at=now - timedelta(hours=8),
            realized_outcome=False,
            realized_sell_price=164.0,
            outcome_reason="72h peak stayed above the buy price but only reached 82.0% of the recommended sell target.",
        )

        session.add(item)
        session.add_all([first_event, second_event])
        session.commit()

        summary = get_calibration_summary(session, SYSTEM_USER_ID, days=30)
        confidence_row = next(row for row in summary.confidence_bands if row.band == "85-100")
        sellability_row = next(row for row in summary.sellability_bands if row.band == "75-84")
        horizon_72 = next(row for row in summary.horizons if row.horizon_hours == 72)

        assert summary.total_evaluated == 2
        assert confidence_row.realized == 1
        assert confidence_row.profitable == 2
        assert confidence_row.realized_rate == pytest.approx(0.5, rel=1e-4)
        assert confidence_row.profitable_rate == pytest.approx(1.0, rel=1e-4)
        assert confidence_row.avg_target_capture == pytest.approx(0.935, rel=1e-4)
        assert sellability_row.avg_target_capture == pytest.approx(0.935, rel=1e-4)
        assert horizon_72.total_evaluated == 2
        assert horizon_72.realized_rate == pytest.approx(0.5, rel=1e-4)
        assert horizon_72.profitable_rate == pytest.approx(1.0, rel=1e-4)
        assert horizon_72.avg_target_capture == pytest.approx(0.935, rel=1e-4)
        assert len(summary.trends) == 1
        assert summary.trends[0].profitable == 2
        assert summary.trends[0].profitable_rate == pytest.approx(1.0, rel=1e-4)
        assert summary.trends[0].avg_target_capture == pytest.approx(0.935, rel=1e-4)
    finally:
        session.close()
