from __future__ import annotations

from dataclasses import dataclass

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
    estimated_profit: float
    roi: float
    confidence_score: float
    liquidity_score: float
    volatility_score: float
    bait_risk_score: float
    final_score: float
    explanation: str
    has_stale_data: bool
    is_risky: bool


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


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
) -> ScoreBreakdown:
    tuning = SCORING_PRESETS.get(settings.scoring_preset, SCORING_PRESETS["balanced"])
    buy_price = float(buy_snapshot.lowest_price or 0)
    sell_price = float(sell_snapshot.lowest_price or 0)
    estimated_profit, roi = calculate_profit_and_roi(buy_price, sell_price, settings)

    sell_depth = _market_depth_score(sell_snapshot, tuning, buy_side=False)
    buy_depth = _market_depth_score(buy_snapshot, tuning, buy_side=True)
    liquidity_score = round(clamp((sell_depth * 0.75) + (buy_depth * 0.25), 0, 100), 2)

    spread_ratio = (sell_price / buy_price) if buy_price > 0 else 1
    sell_avg_ratio = (
        (sell_price / float(sell_snapshot.average_price))
        if sell_snapshot.average_price and float(sell_snapshot.average_price) > 0
        else 1
    )
    buy_avg_ratio = (
        (float(buy_snapshot.average_price) / buy_price)
        if buy_snapshot.average_price and buy_price > 0
        else 1
    )

    volatility_score = 100.0
    if spread_ratio > tuning["suspicious_spread"]:
        volatility_score -= min(32, (spread_ratio - tuning["suspicious_spread"]) * 10)
    if spread_ratio > tuning["extreme_spread"] and _is_thin_market(sell_snapshot):
        volatility_score -= 20
    if sell_avg_ratio > 1.45:
        volatility_score -= min(35, (sell_avg_ratio - 1.45) * 40)
    if buy_avg_ratio > 2.1:
        volatility_score -= min(16, (buy_avg_ratio - 2.1) * 10)
    volatility_score = round(clamp(volatility_score, 0, 100), 2)

    bait_risk = 8.0
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

    has_stale_data = bool(buy_snapshot.is_stale or sell_snapshot.is_stale)
    if has_stale_data:
        bait_risk += tuning["stale_penalty"] * 0.75
    bait_risk = round(clamp(bait_risk, 0, 100), 2)

    confidence = (
        (liquidity_score * 0.42)
        + (volatility_score * 0.33)
        + ((100 - bait_risk) * 0.25)
        - (tuning["stale_penalty"] if has_stale_data else 0)
    )
    confidence = round(clamp(confidence, 0, 100), 2)

    profit_component = clamp((estimated_profit / max(buy_price, 1)) * 32, -35, 100)
    roi_component = clamp(roi * 85, -35, 100)
    final_score = (confidence * 0.58) + (profit_component * 0.17) + (roi_component * 0.15) + (sell_depth * 0.10)
    if bait_risk > 75:
        final_score -= 12
    if liquidity_score < 40:
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
    )

    return ScoreBreakdown(
        estimated_profit=estimated_profit,
        roi=roi,
        confidence_score=confidence,
        liquidity_score=liquidity_score,
        volatility_score=volatility_score,
        bait_risk_score=bait_risk,
        final_score=final_score,
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
) -> str:
    if has_stale_data:
        return f"High margin detected, but confidence reduced due to stale target data on {sell_realm}."
    if bait_risk >= 72:
        return f"High spread between {buy_realm} and {sell_realm}, but the sell-side market looks suspicious."
    if liquidity_score < 48:
        return f"Good spread, but sell-side market is thin on {sell_realm}."
    if sell_avg_ratio > 1.45 or spread_ratio > 3.8:
        return f"Cheapest on {buy_realm}, strongest sell on {sell_realm}, but the spread needs caution."
    if confidence >= 78:
        return f"Strong current opportunity across tracked realms: cheapest on {buy_realm}, strongest sell on {sell_realm}, with acceptable liquidity."
    return f"Cheapest on {buy_realm}, strongest sell on {sell_realm}, with acceptable liquidity."
