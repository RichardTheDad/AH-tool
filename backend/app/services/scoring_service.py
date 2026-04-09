from __future__ import annotations

from dataclasses import dataclass
from statistics import median

from app.db.models import AppSettings, Item, ListingSnapshot


SCORING_PRESETS = {
    "safe": {
        "stale_penalty": 28,
        "missing_penalty": 24,
        "thin_penalty": 30,
        "bait_penalty": 28,
        "suspicious_spread": 2.4,
        "extreme_spread": 4.2,
    },
    "balanced": {
        "stale_penalty": 18,
        "missing_penalty": 16,
        "thin_penalty": 22,
        "bait_penalty": 20,
        "suspicious_spread": 3.0,
        "extreme_spread": 5.0,
    },
    "aggressive": {
        "stale_penalty": 10,
        "missing_penalty": 10,
        "thin_penalty": 12,
        "bait_penalty": 12,
        "suspicious_spread": 4.0,
        "extreme_spread": 6.5,
    },
}


@dataclass
class ScoreBreakdown:
    recommended_sell_price: float
    estimated_profit: float
    roi: float
    confidence_score: float
    sellability_score: float
    liquidity_score: float
    volatility_score: float
    bait_risk_score: float
    final_score: float
    turnover_label: str
    explanation: str
    has_stale_data: bool
    is_risky: bool


@dataclass
class MarketHistoryContext:
    sell_recent_prices: list[float]
    buy_recent_prices: list[float]
    freshness_gap_minutes: float


@dataclass
class TsmMarketContext:
    sale_rate: float | None = None
    sold_per_day: float | None = None
    realm_historical: float | None = None
    realm_market_value_recent: float | None = None
    personal_sale_count: int = 0
    personal_buy_count: int = 0
    personal_cancel_count: int = 0
    personal_expired_count: int = 0
    personal_avg_sale_price: float | None = None


def derive_recommended_sell_price(
    sell_snapshot: ListingSnapshot,
    history: MarketHistoryContext | None = None,
    tsm_market: TsmMarketContext | None = None,
) -> tuple[float, list[str]]:
    observed_price = float(sell_snapshot.lowest_price or 0)
    if observed_price <= 0:
        return 0.0, []

    caps: list[float] = [observed_price]
    reasons: list[str] = []
    quantity = sell_snapshot.quantity or 0
    listing_count = sell_snapshot.listing_count or 0
    thin_market = quantity <= 2 or listing_count <= 1

    average_price = float(sell_snapshot.average_price or 0)
    if average_price > 0:
        average_cap = average_price * (1.0 if thin_market else 1.03)
        caps.append(average_cap)
        if observed_price > average_cap:
            reasons.append("sell target capped near local average")

    if history is not None:
        sell_history = [price for price in history.sell_recent_prices if price > 0]
        if sell_history:
            history_median = median(sell_history)
            history_cap = history_median * (1.02 if thin_market else 1.08)
            caps.append(history_cap)
            if observed_price > history_cap:
                reasons.append("sell target capped by recent history")

    if tsm_market is not None:
        if tsm_market.realm_market_value_recent and tsm_market.realm_market_value_recent > 0:
            recent_cap = tsm_market.realm_market_value_recent * (1.0 if thin_market else 1.08)
            caps.append(recent_cap)
            if observed_price > recent_cap:
                reasons.append("sell target capped by TSM recent market value")
        if tsm_market.realm_historical and tsm_market.realm_historical > 0:
            historical_cap = tsm_market.realm_historical * (1.03 if thin_market else 1.12)
            caps.append(historical_cap)
            if observed_price > historical_cap:
                reasons.append("sell target capped by TSM historical value")

    if thin_market:
        thin_cap = observed_price * 0.95
        caps.append(thin_cap)
        reasons.append("thin sell market haircut applied")

    recommended = round(max(min(caps), 0), 2)
    normalized_reasons: list[str] = []
    for reason in reasons:
        if reason not in normalized_reasons:
            normalized_reasons.append(reason)
    return recommended, normalized_reasons


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def _turnover_label(sellability_score: float, tsm_market: TsmMarketContext | None) -> str:
    sold_per_day = tsm_market.sold_per_day if tsm_market is not None else None
    sale_rate = tsm_market.sale_rate if tsm_market is not None else None
    personal_sales = tsm_market.personal_sale_count if tsm_market is not None else 0

    if sold_per_day is not None and sold_per_day >= 1.5:
        return "fast"
    if sold_per_day is not None and sold_per_day >= 0.45:
        return "steady"
    if sold_per_day is not None and sold_per_day < 0.08:
        return "very slow"
    if sale_rate is not None and sale_rate >= 0.09:
        return "steady"
    if sale_rate is not None and sale_rate < 0.01:
        return "very slow"
    if personal_sales >= 6 and sellability_score >= 72:
        return "steady"
    if sellability_score >= 78:
        return "fast"
    if sellability_score >= 58:
        return "steady"
    if sellability_score >= 40:
        return "slow"
    return "very slow"


def calculate_profit_and_roi(buy_price: float, sell_price: float, settings: AppSettings) -> tuple[float, float]:
    estimated_profit = round((sell_price * (1 - settings.ah_cut_percent)) - buy_price - settings.flat_buffer, 2)
    roi = round((estimated_profit / buy_price) if buy_price > 0 else 0, 4)
    return estimated_profit, roi


def _is_thin_market(snapshot: ListingSnapshot) -> bool:
    return (snapshot.quantity or 0) <= 2 or (snapshot.listing_count or 0) <= 1


def _market_depth_score(snapshot: ListingSnapshot, tuning: dict[str, float], *, buy_side: bool) -> float:
    score = 100.0
    quantity = snapshot.quantity
    listing_count = snapshot.listing_count

    if quantity is None:
        score -= tuning["missing_penalty"] * (0.35 if buy_side else 0.55)
    elif quantity <= 1:
        score -= tuning["thin_penalty"] * (0.35 if buy_side else 0.9)
    elif quantity < 4:
        score -= tuning["thin_penalty"] * (0.2 if buy_side else 0.45)
    elif quantity < 8:
        score -= tuning["thin_penalty"] * (0.08 if buy_side else 0.12)

    if listing_count is None:
        score -= tuning["missing_penalty"] * (0.35 if buy_side else 0.55)
    elif listing_count <= 1:
        score -= tuning["thin_penalty"] * (0.4 if buy_side else 0.95)
    elif listing_count < 3:
        score -= tuning["thin_penalty"] * (0.2 if buy_side else 0.5)

    return clamp(score, 0, 100)


def score_opportunity(
    item: Item,
    buy_snapshot: ListingSnapshot,
    sell_snapshot: ListingSnapshot,
    settings: AppSettings,
    history: MarketHistoryContext | None = None,
    tsm_market: TsmMarketContext | None = None,
) -> ScoreBreakdown:
    tuning = SCORING_PRESETS.get(settings.scoring_preset, SCORING_PRESETS["balanced"])
    buy_price = float(buy_snapshot.lowest_price or 0)
    observed_sell_price = float(sell_snapshot.lowest_price or 0)
    recommended_sell_price, sell_price_reasons = derive_recommended_sell_price(sell_snapshot, history, tsm_market)
    estimated_profit, roi = calculate_profit_and_roi(buy_price, recommended_sell_price, settings)

    sell_depth = _market_depth_score(sell_snapshot, tuning, buy_side=False)
    buy_depth = _market_depth_score(buy_snapshot, tuning, buy_side=True)
    liquidity_score = round(clamp((sell_depth * 0.75) + (buy_depth * 0.25), 0, 100), 2)
    tsm_slow_market = False
    tsm_very_slow_market = False
    stable_sell_history = False
    repeatable_market = False
    persistent_margin = False
    weak_turnover_market = False

    spread_ratio = (observed_sell_price / buy_price) if buy_price > 0 else 1
    sell_avg_ratio = (
        (observed_sell_price / float(sell_snapshot.average_price))
        if sell_snapshot.average_price and float(sell_snapshot.average_price) > 0
        else 1
    )
    buy_avg_ratio = (
        (float(buy_snapshot.average_price) / buy_price)
        if buy_snapshot.average_price and buy_price > 0
        else 1
    )

    volatility_score = 100.0
    limited_history = False
    inconsistent_sell_history = False
    sell_history_spike = False
    freshness_gap_flag = False
    sell_range_ratio = 1.0
    if spread_ratio > tuning["suspicious_spread"]:
        volatility_score -= min(32, (spread_ratio - tuning["suspicious_spread"]) * 10)
    if spread_ratio > tuning["extreme_spread"] and _is_thin_market(sell_snapshot):
        volatility_score -= 20
    if sell_avg_ratio > 1.45:
        volatility_score -= min(35, (sell_avg_ratio - 1.45) * 40)
    if buy_avg_ratio > 2.1:
        volatility_score -= min(16, (buy_avg_ratio - 2.1) * 10)
    if history is not None:
        sell_history = [price for price in history.sell_recent_prices if price > 0]
        buy_history = [price for price in history.buy_recent_prices if price > 0]
        if len(sell_history) < 2:
            limited_history = True
            volatility_score -= 8
        else:
            sell_median = median(sell_history)
            if sell_median > 0:
                buy_median = median(buy_history) if buy_history else 0
                sell_vs_history = observed_sell_price / sell_median
                if sell_vs_history > 1.35:
                    sell_history_spike = True
                    volatility_score -= min(26, (sell_vs_history - 1.35) * 26)
                sell_range_ratio = max(sell_history) / max(min(sell_history), 1)
                if sell_range_ratio > 1.7:
                    inconsistent_sell_history = True
                    volatility_score -= min(18, (sell_range_ratio - 1.7) * 12)
                elif len(sell_history) >= 3 and sell_range_ratio <= 1.18 and history.freshness_gap_minutes <= 30:
                    stable_sell_history = True
                    volatility_score += 6
                    liquidity_score += 5
                elif len(sell_history) >= 3 and sell_range_ratio <= 1.28:
                    volatility_score += 2
                    liquidity_score += 2
                if len(sell_history) >= 4 and sell_range_ratio <= 1.28:
                    repeatable_market = True
                    volatility_score += 2
                    liquidity_score += 3
                if len(sell_history) >= 5 and len(buy_history) >= 3 and buy_median > 0 and sell_median / buy_median >= 1.18:
                    persistent_margin = True
                    volatility_score += 5
                    liquidity_score += 4
        if len(buy_history) < 2:
            limited_history = True
            volatility_score -= 4
        elif len(buy_history) >= 3:
            buy_range_ratio = max(buy_history) / max(min(buy_history), 1)
            if buy_range_ratio <= 1.22:
                volatility_score += 2
        if history.freshness_gap_minutes > 90:
            freshness_gap_flag = True
            volatility_score -= min(14, ((history.freshness_gap_minutes - 90) / 30) * 3)

    if tsm_market is not None:
        if tsm_market.realm_market_value_recent and tsm_market.realm_market_value_recent > 0:
            recent_ratio = observed_sell_price / tsm_market.realm_market_value_recent
            if recent_ratio > 1.35:
                volatility_score -= min(18, (recent_ratio - 1.35) * 20)
        if tsm_market.realm_historical and tsm_market.realm_historical > 0:
            historical_ratio = observed_sell_price / tsm_market.realm_historical
            if historical_ratio > 1.45:
                volatility_score -= min(16, (historical_ratio - 1.45) * 18)
        if tsm_market.sale_rate is not None:
            if tsm_market.sale_rate < 0.005:
                tsm_very_slow_market = True
                weak_turnover_market = True
                liquidity_score -= 24
                volatility_score -= 10
            elif tsm_market.sale_rate < 0.02:
                tsm_slow_market = True
                weak_turnover_market = True
                liquidity_score -= 14
                volatility_score -= 5
            elif tsm_market.sale_rate >= 0.08:
                liquidity_score += 5
                volatility_score += 2
            elif tsm_market.sale_rate > 0.12:
                liquidity_score += 4
        if tsm_market.sold_per_day is not None:
            if tsm_market.sold_per_day < 0.05:
                tsm_very_slow_market = True
                weak_turnover_market = True
                liquidity_score -= 16
            elif tsm_market.sold_per_day < 0.2:
                tsm_slow_market = True
                weak_turnover_market = True
                liquidity_score -= 8
            elif tsm_market.sold_per_day >= 1.0:
                liquidity_score += 4
            elif tsm_market.sold_per_day > 3:
                liquidity_score += 3
        if tsm_market.personal_sale_count >= 6:
            liquidity_score += 7
            volatility_score += 4
        elif tsm_market.personal_sale_count >= 3:
            liquidity_score += 4
            volatility_score += 2
        if tsm_market.personal_cancel_count + tsm_market.personal_expired_count >= max(tsm_market.personal_sale_count, 1) * 2:
            liquidity_score -= 10
            volatility_score -= 8
        elif tsm_market.personal_cancel_count + tsm_market.personal_expired_count > tsm_market.personal_sale_count and (
            tsm_market.personal_cancel_count > 0 or tsm_market.personal_expired_count > 0
        ):
            liquidity_score -= 6
            volatility_score -= 4
            weak_turnover_market = True
        if tsm_market.personal_avg_sale_price and tsm_market.personal_avg_sale_price > 0:
            personal_realized_ratio = observed_sell_price / tsm_market.personal_avg_sale_price
            if personal_realized_ratio > 1.5:
                volatility_score -= min(16, (personal_realized_ratio - 1.5) * 14)
            elif personal_realized_ratio <= 1.12 and tsm_market.personal_sale_count >= 3:
                volatility_score += 4
                liquidity_score += 3
    volatility_score = round(clamp(volatility_score, 0, 100), 2)
    liquidity_score = round(clamp(liquidity_score, 0, 100), 2)

    bait_risk = 8.0
    if tsm_market is not None and tsm_market.realm_market_value_recent and tsm_market.realm_market_value_recent > 0:
        recent_ratio = observed_sell_price / tsm_market.realm_market_value_recent
        if recent_ratio > 1.35:
            bait_risk += min(14, (recent_ratio - 1.35) * 16)
    if tsm_market is not None and tsm_market.realm_historical and tsm_market.realm_historical > 0:
        historical_ratio = observed_sell_price / tsm_market.realm_historical
        if historical_ratio > 1.45:
            bait_risk += min(12, (historical_ratio - 1.45) * 14)
    if spread_ratio > tuning["suspicious_spread"]:
        bait_risk += tuning["bait_penalty"] * 0.8
    if spread_ratio > tuning["extreme_spread"]:
        bait_risk += tuning["bait_penalty"] * 0.8
    if sell_avg_ratio > 1.45:
        bait_risk += min(24, (sell_avg_ratio - 1.45) * 22)
    if sell_snapshot.quantity is None or sell_snapshot.listing_count is None:
        bait_risk += tuning["missing_penalty"] * 0.75
    if _is_thin_market(sell_snapshot):
        bait_risk += tuning["bait_penalty"] * 0.95
    if (sell_snapshot.quantity or 0) <= 1 and (sell_snapshot.listing_count or 0) <= 1:
        bait_risk += tuning["bait_penalty"] * 0.55
    if limited_history:
        bait_risk += 6
    if inconsistent_sell_history:
        bait_risk += 8
    if sell_history_spike:
        bait_risk += 12
    if freshness_gap_flag:
        bait_risk += 8
    if tsm_slow_market:
        bait_risk += 6
    if tsm_very_slow_market:
        bait_risk += 12
    if tsm_market is not None:
        if tsm_market.personal_cancel_count + tsm_market.personal_expired_count > tsm_market.personal_sale_count and (
            tsm_market.personal_cancel_count > 0 or tsm_market.personal_expired_count > 0
        ):
            bait_risk += 8
        if tsm_market.personal_avg_sale_price and tsm_market.personal_avg_sale_price > 0:
            personal_realized_ratio = observed_sell_price / tsm_market.personal_avg_sale_price
            if personal_realized_ratio > 1.5:
                bait_risk += min(12, (personal_realized_ratio - 1.5) * 12)

    has_stale_data = bool(buy_snapshot.is_stale or sell_snapshot.is_stale)
    if has_stale_data:
        bait_risk += tuning["stale_penalty"] * 0.75
    bait_risk = round(clamp(bait_risk, 0, 100), 2)

    sellability_score = (
        (liquidity_score * 0.45)
        + (volatility_score * 0.25)
        + ((100 - bait_risk) * 0.20)
        + (min(tsm_market.sale_rate * 420, 12) if tsm_market is not None and tsm_market.sale_rate is not None else 0)
        + (min(tsm_market.sold_per_day * 3.5, 12) if tsm_market is not None and tsm_market.sold_per_day is not None else 0)
        + (min(tsm_market.personal_sale_count * 1.8, 10) if tsm_market is not None else 0)
        - (min((tsm_market.personal_cancel_count + tsm_market.personal_expired_count) * 2.2, 14) if tsm_market is not None else 0)
    )
    if stable_sell_history:
        sellability_score += 6
    if repeatable_market:
        sellability_score += 5
    if persistent_margin:
        sellability_score += 8
    if limited_history:
        sellability_score -= 5
    if freshness_gap_flag:
        sellability_score -= 5
    if sell_history_spike:
        sellability_score -= 10
    if weak_turnover_market:
        sellability_score -= 10
    if item.name is None:
        sellability_score -= 4
    sellability_score = round(clamp(sellability_score, 0, 100), 2)
    turnover_label = _turnover_label(sellability_score, tsm_market)

    confidence = (
        (liquidity_score * 0.32)
        + (volatility_score * 0.24)
        + ((100 - bait_risk) * 0.16)
        + (sellability_score * 0.28)
        - (tuning["stale_penalty"] if has_stale_data else 0)
    )
    if persistent_margin:
        confidence += 2
    if repeatable_market:
        confidence += 1
    if sell_history_spike:
        confidence -= 4
    if inconsistent_sell_history:
        confidence -= 2
    if limited_history:
        confidence -= 2
    if freshness_gap_flag:
        confidence -= 2
    confidence = round(clamp(confidence, 0, 100), 2)

    profit_component = clamp((estimated_profit / max(buy_price, 1)) * 32, -35, 100)
    roi_component = clamp(roi * 85, -35, 100)
    capital_efficiency_score = clamp((roi * 120) + (sellability_score * 0.35) - ((buy_price / max(recommended_sell_price, 1)) * 25), 0, 100)
    final_score = (
        (confidence * 0.42)
        + (sellability_score * 0.28)
        + (capital_efficiency_score * 0.16)
        + (profit_component * 0.07)
        + (roi_component * 0.07)
    )
    if bait_risk > 75:
        final_score -= 12
    if liquidity_score < 40:
        final_score -= 10
    if sell_history_spike:
        final_score -= 18
    if inconsistent_sell_history:
        final_score -= 10
    if freshness_gap_flag:
        final_score -= 6
    if limited_history:
        final_score -= 4
    if tsm_slow_market:
        final_score -= 8
    if tsm_very_slow_market:
        final_score -= 14
    if buy_price >= 2_500_000 and weak_turnover_market:
        final_score -= 12
    elif buy_price >= 1_000_000 and weak_turnover_market:
        final_score -= 7
    if buy_price >= 2_500_000 and roi < 0.18:
        final_score -= 8
    if stable_sell_history:
        final_score += 5
    if repeatable_market:
        final_score += 4
    if persistent_margin:
        final_score += 7
    if tsm_market is not None:
        if tsm_market.personal_sale_count >= 3:
            final_score += 5
        if (
            tsm_market.personal_sale_count >= 5
            and tsm_market.personal_avg_sale_price
            and recommended_sell_price <= tsm_market.personal_avg_sale_price * 1.1
        ):
            final_score += 6
        if tsm_market.personal_cancel_count + tsm_market.personal_expired_count > tsm_market.personal_sale_count and (
            tsm_market.personal_cancel_count > 0 or tsm_market.personal_expired_count > 0
        ):
            final_score -= 10
    final_score = round(clamp(final_score, 0, 100), 2)

    is_risky = confidence < 50 or bait_risk >= 65 or liquidity_score < 45
    explanation = build_explanation(
        buy_snapshot.realm,
        sell_snapshot.realm,
        confidence,
        liquidity_score,
        bait_risk,
        has_stale_data,
        spread_ratio,
        sell_avg_ratio,
        limited_history=limited_history,
        inconsistent_sell_history=inconsistent_sell_history,
        sell_history_spike=sell_history_spike,
        freshness_gap_flag=freshness_gap_flag,
        tsm_slow_market=tsm_slow_market,
        tsm_very_slow_market=tsm_very_slow_market,
        personal_sale_count=tsm_market.personal_sale_count if tsm_market is not None else 0,
        personal_cancel_count=tsm_market.personal_cancel_count if tsm_market is not None else 0,
        personal_expired_count=tsm_market.personal_expired_count if tsm_market is not None else 0,
        observed_sell_price=observed_sell_price,
        recommended_sell_price=recommended_sell_price,
        sell_price_reasons=sell_price_reasons,
    )

    return ScoreBreakdown(
        recommended_sell_price=recommended_sell_price,
        estimated_profit=estimated_profit,
        roi=roi,
        confidence_score=confidence,
        sellability_score=sellability_score,
        liquidity_score=liquidity_score,
        volatility_score=volatility_score,
        bait_risk_score=bait_risk,
        final_score=final_score,
        turnover_label=turnover_label,
        explanation=explanation,
        has_stale_data=has_stale_data,
        is_risky=is_risky,
    )


def build_explanation(
    buy_realm: str,
    sell_realm: str,
    confidence: float,
    liquidity_score: float,
    bait_risk: float,
    has_stale_data: bool,
    spread_ratio: float,
    sell_avg_ratio: float,
    *,
    limited_history: bool = False,
    inconsistent_sell_history: bool = False,
    sell_history_spike: bool = False,
    freshness_gap_flag: bool = False,
    tsm_slow_market: bool = False,
    tsm_very_slow_market: bool = False,
    personal_sale_count: int = 0,
    personal_cancel_count: int = 0,
    personal_expired_count: int = 0,
    observed_sell_price: float | None = None,
    recommended_sell_price: float | None = None,
    sell_price_reasons: list[str] | None = None,
) -> str:
    sell_target_note = ""
    if observed_sell_price and recommended_sell_price and recommended_sell_price < observed_sell_price:
        sell_target_note = f" Conservative sell target used instead of the raw lowest listing on {sell_realm}."
    if sell_price_reasons:
        sell_target_note = f"{sell_target_note} " + "; ".join(sell_price_reasons).capitalize() + "."
        sell_target_note = sell_target_note.strip()
    if has_stale_data:
        return f"High margin detected, but confidence reduced due to stale target data on {sell_realm}.{sell_target_note}".strip()
    if sell_history_spike:
        return f"Sell price looks far above recent history on {sell_realm}, so confidence is reduced.{sell_target_note}".strip()
    if inconsistent_sell_history:
        return f"Cheapest on {buy_realm}, but recent sell-side pricing on {sell_realm} has been inconsistent.{sell_target_note}".strip()
    if freshness_gap_flag:
        return f"Cheapest on {buy_realm}, strongest sell on {sell_realm}, but the market snapshots are not closely timed.{sell_target_note}".strip()
    if tsm_very_slow_market:
        return f"Cheapest on {buy_realm}, strongest sell on {sell_realm}, but TSM shows extremely slow regional turnover.{sell_target_note}".strip()
    if tsm_slow_market:
        return f"Cheapest on {buy_realm}, strongest sell on {sell_realm}, but TSM shows low regional turnover.{sell_target_note}".strip()
    if personal_cancel_count + personal_expired_count > personal_sale_count and (personal_cancel_count > 0 or personal_expired_count > 0):
        return (
            f"Cheapest on {buy_realm}, strongest sell on {sell_realm}, but your TSM ledger shows frequent cancels or expirations."
            f"{sell_target_note}"
        ).strip()
    if personal_sale_count >= 3:
        return (
            f"Cheapest on {buy_realm}, strongest sell on {sell_realm}, and your TSM ledger shows this item has sold successfully before."
            f"{sell_target_note}"
        ).strip()
    if limited_history:
        return f"Cheapest on {buy_realm}, strongest sell on {sell_realm}, but recent history is limited.{sell_target_note}".strip()
    if bait_risk >= 72:
        return f"High spread between {buy_realm} and {sell_realm}, but the sell-side market looks suspicious.{sell_target_note}".strip()
    if liquidity_score < 48:
        return f"Good spread, but sell-side market is thin on {sell_realm}.{sell_target_note}".strip()
    if sell_avg_ratio > 1.45 or spread_ratio > 3.8:
        return f"Cheapest on {buy_realm}, strongest sell on {sell_realm}, but the spread needs caution.{sell_target_note}".strip()
    if confidence >= 78:
        return f"Strong current opportunity across tracked realms: cheapest on {buy_realm}, strongest sell on {sell_realm}, with acceptable liquidity.{sell_target_note}".strip()
    return f"Cheapest on {buy_realm}, strongest sell on {sell_realm}, with acceptable liquidity.{sell_target_note}".strip()
