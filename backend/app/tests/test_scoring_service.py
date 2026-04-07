from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.db.models import AppSettings, Item, ListingSnapshot
from app.services.scoring_service import MarketHistoryContext, calculate_profit_and_roi, derive_recommended_sell_price, score_opportunity
from app.services.scan_service import select_best_sell_snapshot, select_cheapest_buy_snapshot


def make_snapshot(**overrides) -> ListingSnapshot:
    data = {
        "item_id": 1,
        "realm": "Stormrage",
        "lowest_price": 10000,
        "average_price": 10500,
        "quantity": 6,
        "listing_count": 4,
        "source_name": "test",
        "captured_at": datetime.now(timezone.utc),
        "is_stale": False,
    }
    data.update(overrides)
    return ListingSnapshot(**data)


def test_safe_preset_penalizes_thin_stale_market_more_than_aggressive() -> None:
    item = Item(item_id=1, name="Test Item", is_commodity=False)
    buy = make_snapshot(lowest_price=10000, quantity=1, listing_count=1, is_stale=True)
    sell = make_snapshot(
        realm="Zul'jin",
        lowest_price=24000,
        average_price=16000,
        quantity=1,
        listing_count=1,
        is_stale=True,
        captured_at=datetime.now(timezone.utc) - timedelta(hours=4),
    )

    safe = score_opportunity(item, buy, sell, AppSettings(id=1, scoring_preset="safe", ah_cut_percent=0.05, flat_buffer=0))
    aggressive = score_opportunity(
        item,
        buy,
        sell,
        AppSettings(id=1, scoring_preset="aggressive", ah_cut_percent=0.05, flat_buffer=0),
    )

    assert aggressive.confidence_score > safe.confidence_score
    assert safe.bait_risk_score >= aggressive.bait_risk_score


def test_profit_and_roi_calculation_matches_formula() -> None:
    settings = AppSettings(id=1, ah_cut_percent=0.05, flat_buffer=500)
    profit, roi = calculate_profit_and_roi(10_000, 20_000, settings)

    assert profit == 8_500
    assert roi == 0.85


def test_cheapest_buy_realm_selection_uses_lowest_price() -> None:
    snapshots = [
        make_snapshot(realm="Stormrage", lowest_price=12_000),
        make_snapshot(realm="Area 52", lowest_price=9_000),
        make_snapshot(realm="Zul'jin", lowest_price=18_000),
    ]

    cheapest = select_cheapest_buy_snapshot(snapshots)
    assert cheapest.realm == "Area 52"


def test_best_sell_selection_avoids_thin_suspicious_market() -> None:
    item = Item(item_id=1, name="Test Item", is_commodity=False)
    settings = AppSettings(id=1, scoring_preset="balanced", ah_cut_percent=0.05, flat_buffer=0)
    buy = make_snapshot(realm="Area 52", lowest_price=10_000, average_price=11_000, quantity=8, listing_count=5)
    suspicious_sell = make_snapshot(
        realm="Zul'jin",
        lowest_price=25_000,
        average_price=15_000,
        quantity=1,
        listing_count=1,
    )
    healthier_sell = make_snapshot(
        realm="Stormrage",
        lowest_price=22_000,
        average_price=21_500,
        quantity=7,
        listing_count=5,
    )

    best_sell, best_score = select_best_sell_snapshot(item, buy, [buy, suspicious_sell, healthier_sell], settings, include_losers=False)

    assert best_sell is not None
    assert best_score is not None
    assert best_sell.realm == "Stormrage"


def test_same_realm_rejection_returns_no_sell_candidate() -> None:
    item = Item(item_id=1, name="Test Item", is_commodity=False)
    settings = AppSettings(id=1, scoring_preset="balanced", ah_cut_percent=0.05, flat_buffer=0)
    only_snapshot = make_snapshot(realm="Area 52", lowest_price=10_000)

    best_sell, best_score = select_best_sell_snapshot(item, only_snapshot, [only_snapshot], settings, include_losers=False)

    assert best_sell is None
    assert best_score is None


def test_suspicious_spread_penalty_pushes_down_confidence() -> None:
    item = Item(item_id=1, name="Test Item", is_commodity=False)
    settings = AppSettings(id=1, scoring_preset="balanced", ah_cut_percent=0.05, flat_buffer=0)
    buy = make_snapshot(lowest_price=10_000, average_price=10_500, quantity=8, listing_count=5)
    suspicious_sell = make_snapshot(realm="Zul'jin", lowest_price=42_000, average_price=18_000, quantity=1, listing_count=1)
    normal_sell = make_snapshot(realm="Illidan", lowest_price=18_500, average_price=18_200, quantity=8, listing_count=5)

    suspicious = score_opportunity(item, buy, suspicious_sell, settings)
    normal = score_opportunity(item, buy, normal_sell, settings)

    assert suspicious.bait_risk_score > normal.bait_risk_score
    assert suspicious.final_score < normal.final_score


def test_sell_price_far_above_recent_history_gets_penalized() -> None:
    item = Item(item_id=1, name="Test Item", is_commodity=False)
    settings = AppSettings(id=1, scoring_preset="balanced", ah_cut_percent=0.05, flat_buffer=0)
    buy = make_snapshot(realm="Area 52", lowest_price=10_000, average_price=10_500, quantity=8, listing_count=5)
    stable_sell = make_snapshot(realm="Stormrage", lowest_price=18_000, average_price=18_100, quantity=8, listing_count=5)
    spiky_sell = make_snapshot(realm="Zul'jin", lowest_price=26_500, average_price=18_200, quantity=5, listing_count=4)

    stable = score_opportunity(
        item,
        buy,
        stable_sell,
        settings,
        history=MarketHistoryContext(
            sell_recent_prices=[17_800, 18_000, 18_250],
            buy_recent_prices=[10_100, 10_200, 10_000],
            freshness_gap_minutes=10,
        ),
    )
    spiky = score_opportunity(
        item,
        buy,
        spiky_sell,
        settings,
        history=MarketHistoryContext(
            sell_recent_prices=[17_900, 18_100, 18_250],
            buy_recent_prices=[10_100, 10_200, 10_000],
            freshness_gap_minutes=10,
        ),
    )

    assert spiky.bait_risk_score > stable.bait_risk_score
    assert spiky.final_score < stable.final_score
    assert "recent history" in spiky.explanation.lower()


def test_recommended_sell_price_is_more_conservative_for_thin_spiky_markets() -> None:
    sell_snapshot = make_snapshot(
        realm="Zul'jin",
        lowest_price=40_000,
        average_price=22_000,
        quantity=1,
        listing_count=1,
    )
    recommended, reasons = derive_recommended_sell_price(
        sell_snapshot,
        MarketHistoryContext(
            sell_recent_prices=[20_500, 21_000, 22_000],
            buy_recent_prices=[10_000, 10_100, 10_200],
            freshness_gap_minutes=10,
        ),
    )

    assert recommended < float(sell_snapshot.lowest_price or 0)
    assert reasons
