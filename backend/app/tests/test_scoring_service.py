from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.db.models import AppSettings, Item, ListingSnapshot
from app.services.scoring_service import (
    MarketHistoryContext,
    TsmMarketContext,
    calculate_profit_and_roi,
    derive_recommended_sell_price,
    score_opportunity,
)
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


def test_tsm_slow_sell_realm_turnover_reduces_confidence_and_score() -> None:
    item = Item(item_id=1, name="Test Item", is_commodity=False)
    settings = AppSettings(id=1, scoring_preset="balanced", ah_cut_percent=0.05, flat_buffer=0)
    buy = make_snapshot(realm="Area 52", lowest_price=10_000, average_price=10_500, quantity=8, listing_count=5)
    sell = make_snapshot(realm="Zul'jin", lowest_price=19_000, average_price=18_700, quantity=8, listing_count=5)

    normal = score_opportunity(item, buy, sell, settings)
    slow = score_opportunity(
        item,
        buy,
        sell,
        settings,
        tsm_market=TsmMarketContext(realm_num_auctions=1),
    )

    assert slow.confidence_score < normal.confidence_score
    assert slow.final_score < normal.final_score
    assert "sell-side realm turnover" in slow.explanation.lower()


def test_region_sale_rate_does_not_drive_sellability_score() -> None:
    item = Item(item_id=1, name="Test Item", is_commodity=False)
    settings = AppSettings(id=1, scoring_preset="balanced", ah_cut_percent=0.05, flat_buffer=0)
    buy = make_snapshot(realm="Area 52", lowest_price=10_000, average_price=10_500, quantity=8, listing_count=5)
    sell = make_snapshot(realm="Zul'jin", lowest_price=19_000, average_price=18_700, quantity=8, listing_count=5)

    baseline = score_opportunity(item, buy, sell, settings)
    region_only = score_opportunity(
        item,
        buy,
        sell,
        settings,
        tsm_market=TsmMarketContext(sale_rate=0.12, sold_per_day=1.8),
    )

    assert region_only.sellability_score == baseline.sellability_score


def test_tsm_realm_history_caps_sell_target_and_profit() -> None:
    item = Item(item_id=1, name="Test Item", is_commodity=False)
    settings = AppSettings(id=1, scoring_preset="balanced", ah_cut_percent=0.05, flat_buffer=0)
    buy = make_snapshot(realm="Area 52", lowest_price=10_000, average_price=10_500, quantity=8, listing_count=5)
    sell = make_snapshot(realm="Zul'jin", lowest_price=30_000, average_price=28_000, quantity=4, listing_count=3)

    uncapped = score_opportunity(item, buy, sell, settings)
    capped = score_opportunity(
        item,
        buy,
        sell,
        settings,
        tsm_market=TsmMarketContext(realm_historical=18_500, realm_market_value_recent=19_200),
    )

    assert capped.recommended_sell_price < uncapped.recommended_sell_price
    assert capped.estimated_profit < uncapped.estimated_profit
    assert "tsm recent market value" in capped.explanation.lower() or "tsm historical value" in capped.explanation.lower()


def test_personal_tsm_ledger_history_changes_confidence_and_explanation() -> None:
    item = Item(item_id=1, name="Test Item", is_commodity=False)
    settings = AppSettings(id=1, scoring_preset="balanced", ah_cut_percent=0.05, flat_buffer=0)
    buy = make_snapshot(realm="Area 52", lowest_price=10_000, average_price=10_500, quantity=8, listing_count=5)
    sell = make_snapshot(realm="Zul'jin", lowest_price=19_000, average_price=18_700, quantity=8, listing_count=5)

    good_history = score_opportunity(
        item,
        buy,
        sell,
        settings,
        tsm_market=TsmMarketContext(personal_sale_count=6, personal_avg_sale_price=18_500),
    )
    poor_history = score_opportunity(
        item,
        buy,
        sell,
        settings,
        tsm_market=TsmMarketContext(
            personal_sale_count=1,
            personal_cancel_count=4,
            personal_expired_count=3,
            personal_avg_sale_price=12_000,
        ),
    )

    assert good_history.confidence_score > poor_history.confidence_score
    assert good_history.final_score > poor_history.final_score
    assert "sold successfully before" in good_history.explanation.lower()
    assert "frequent cancels or expirations" in poor_history.explanation.lower()


def test_stale_personal_sales_history_has_less_influence_than_recent_history() -> None:
    item = Item(item_id=1, name="Test Item", is_commodity=False)
    settings = AppSettings(id=1, scoring_preset="balanced", ah_cut_percent=0.05, flat_buffer=0)
    buy = make_snapshot(realm="Area 52", lowest_price=10_000, average_price=10_500, quantity=8, listing_count=5)
    sell = make_snapshot(realm="Zul'jin", lowest_price=19_000, average_price=18_700, quantity=8, listing_count=5)

    recent_history = score_opportunity(
        item,
        buy,
        sell,
        settings,
        tsm_market=TsmMarketContext(
            personal_sale_count=8,
            personal_avg_sale_price=18_500,
            personal_sale_recency_days=5,
        ),
    )
    stale_history = score_opportunity(
        item,
        buy,
        sell,
        settings,
        tsm_market=TsmMarketContext(
            personal_sale_count=8,
            personal_avg_sale_price=18_500,
            personal_sale_recency_days=220,
        ),
    )

    assert recent_history.sellability_score > stale_history.sellability_score
    assert recent_history.final_score > stale_history.final_score


def test_repeatable_stable_market_scores_higher_than_one_off_spike() -> None:
    item = Item(item_id=1, name="Test Item", is_commodity=False)
    settings = AppSettings(id=1, scoring_preset="balanced", ah_cut_percent=0.05, flat_buffer=0)
    buy = make_snapshot(realm="Area 52", lowest_price=10_000, average_price=10_300, quantity=9, listing_count=6)
    stable_sell = make_snapshot(realm="Stormrage", lowest_price=18_500, average_price=18_400, quantity=8, listing_count=6)
    spiky_sell = make_snapshot(realm="Zul'jin", lowest_price=18_900, average_price=18_600, quantity=4, listing_count=3)

    stable = score_opportunity(
        item,
        buy,
        stable_sell,
        settings,
        history=MarketHistoryContext(
            sell_recent_prices=[18_100, 18_300, 18_450, 18_400],
            buy_recent_prices=[10_050, 10_120, 10_180, 10_090],
            freshness_gap_minutes=12,
        ),
        tsm_market=TsmMarketContext(sale_rate=0.11, sold_per_day=1.6),
    )
    spiky = score_opportunity(
        item,
        buy,
        spiky_sell,
        settings,
        history=MarketHistoryContext(
            sell_recent_prices=[14_000, 18_000],
            buy_recent_prices=[9_800, 10_600],
            freshness_gap_minutes=85,
        ),
        tsm_market=TsmMarketContext(sale_rate=0.018, sold_per_day=0.18),
    )

    assert stable.confidence_score > spiky.confidence_score
    assert stable.final_score > spiky.final_score


def test_expensive_slow_item_gets_pushed_below_faster_more_sellable_item() -> None:
    item = Item(item_id=1, name="Test Item", is_commodity=False)
    settings = AppSettings(id=1, scoring_preset="balanced", ah_cut_percent=0.05, flat_buffer=0)

    expensive_buy = make_snapshot(realm="Stormrage", lowest_price=3_200_000, average_price=3_250_000, quantity=6, listing_count=4)
    expensive_sell = make_snapshot(realm="Zul'jin", lowest_price=4_400_000, average_price=4_350_000, quantity=3, listing_count=2)
    cheaper_buy = make_snapshot(realm="Stormrage", lowest_price=180_000, average_price=182_000, quantity=9, listing_count=6)
    cheaper_sell = make_snapshot(realm="Zul'jin", lowest_price=255_000, average_price=252_000, quantity=8, listing_count=5)

    expensive = score_opportunity(
        item,
        expensive_buy,
        expensive_sell,
        settings,
        history=MarketHistoryContext(
            sell_recent_prices=[4_250_000, 4_300_000, 4_350_000],
            buy_recent_prices=[3_150_000, 3_200_000, 3_210_000],
            freshness_gap_minutes=20,
        ),
        tsm_market=TsmMarketContext(
            sale_rate=0.003,
            sold_per_day=0.04,
            personal_sale_count=0,
            personal_cancel_count=3,
            personal_expired_count=2,
        ),
    )
    cheaper = score_opportunity(
        item,
        cheaper_buy,
        cheaper_sell,
        settings,
        history=MarketHistoryContext(
            sell_recent_prices=[250_000, 252_000, 255_000, 254_500],
            buy_recent_prices=[179_000, 180_500, 181_000, 180_200],
            freshness_gap_minutes=10,
        ),
        tsm_market=TsmMarketContext(
            sale_rate=0.12,
            sold_per_day=1.8,
            personal_sale_count=5,
            personal_avg_sale_price=248_000,
        ),
    )

    assert expensive.estimated_profit > 0
    assert cheaper.estimated_profit > 0
    assert cheaper.confidence_score > expensive.confidence_score
    assert cheaper.final_score > expensive.final_score


def test_persistent_positive_margin_history_boosts_repeatable_flip() -> None:
    item = Item(item_id=1, name="Test Item", is_commodity=False)
    settings = AppSettings(id=1, scoring_preset="balanced", ah_cut_percent=0.05, flat_buffer=0)
    buy = make_snapshot(realm="Stormrage", lowest_price=120_000, average_price=121_000, quantity=7, listing_count=5)
    sell = make_snapshot(realm="Zul'jin", lowest_price=198_000, average_price=194_000, quantity=6, listing_count=4)

    persistent = score_opportunity(
        item,
        buy,
        sell,
        settings,
        history=MarketHistoryContext(
            sell_recent_prices=[192_000, 194_000, 196_000, 197_000, 198_000],
            buy_recent_prices=[118_000, 119_000, 120_000, 121_000],
            freshness_gap_minutes=15,
        ),
        tsm_market=TsmMarketContext(sale_rate=0.09, sold_per_day=1.2),
    )
    fleeting = score_opportunity(
        item,
        buy,
        sell,
        settings,
        history=MarketHistoryContext(
            sell_recent_prices=[150_000, 198_000],
            buy_recent_prices=[115_000, 128_000],
            freshness_gap_minutes=75,
        ),
        tsm_market=TsmMarketContext(sale_rate=0.09, sold_per_day=1.2),
    )

    assert persistent.confidence_score > fleeting.confidence_score
    assert persistent.final_score > fleeting.final_score
