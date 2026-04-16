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

SELLABILITY_WEIGHTS = {
    "liquidity": 0.45,
    "volatility": 0.25,
    "anti_bait": 0.20,
}

CONFIDENCE_WEIGHTS = {
    "liquidity": 0.42,
    "volatility": 0.34,
    "anti_bait": 0.24,
}

FINAL_SCORE_WEIGHTS = {
    "confidence": 0.42,
    "sellability": 0.28,
    "capital_efficiency": 0.16,
    "profit_component": 0.07,
    "roi_component": 0.07,
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
    score_provenance: dict[str, object]


@dataclass
class MarketHistoryContext:
    sell_recent_prices: list[float]
    buy_recent_prices: list[float]
    freshness_gap_minutes: float


@dataclass
class ExecutionRiskPenalty:
    total: float
    reasons: list[str]


@dataclass
class RegionalValueAnchor:
    value: float
    source: str
    sale_rate: float | None
    sold_per_day: float | None


def _to_positive_float(value: object) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def _regional_value_anchor(item: Item) -> RegionalValueAnchor | None:
    metadata = item.metadata_json if isinstance(item.metadata_json, dict) else {}
    stats = metadata.get("tsm_region_stats")
    if not isinstance(stats, dict):
        return None

    candidates = [
        ("db_region_sale_avg", stats.get("db_region_sale_avg")),
        ("db_region_historical", stats.get("db_region_historical")),
        ("db_region_market_avg", stats.get("db_region_market_avg")),
    ]
    for source, raw_value in candidates:
        value = _to_positive_float(raw_value)
        if value is not None:
            return RegionalValueAnchor(
                value=value,
                source=source,
                sale_rate=_to_positive_float(stats.get("db_region_sale_rate")),
                sold_per_day=_to_positive_float(stats.get("db_region_sold_per_day")),
            )
    return None


def _has_regional_sale_evidence(anchor: RegionalValueAnchor | None) -> bool:
    if anchor is None:
        return False
    return anchor.source == "db_region_sale_avg" or bool(anchor.sale_rate) or bool(anchor.sold_per_day)


def derive_recommended_sell_price(
    sell_snapshot: ListingSnapshot,
    history: MarketHistoryContext | None = None,
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


def _turnover_label(sellability_score: float) -> str:
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


def _evidence_gate_cap(*, sell_depth_ok: bool, history_coverage_ok: bool, recency_ok: bool) -> float | None:
    """Return an optional score cap when minimum evidence is incomplete.

    Graded caps avoid flattening every weak-evidence case to one hard threshold.
    """
    if sell_depth_ok and history_coverage_ok and recency_ok:
        return None

    failures = int(not sell_depth_ok) + int(not history_coverage_ok) + int(not recency_ok)
    if failures >= 3:
        return 55.0
    if failures == 2:
        return 62.0
    if not recency_ok:
        return 66.0
    if not history_coverage_ok:
        return 68.0
    return 72.0


def _execution_risk_penalty(
    *,
    bait_risk: float,
    liquidity_score: float,
    limited_history: bool,
    inconsistent_sell_history: bool,
    sell_history_spike: bool,
    freshness_gap_flag: bool,
) -> ExecutionRiskPenalty:
    total = 0.0
    reasons: list[str] = []

    if bait_risk > 75:
        total += 8.0
        reasons.append("extreme_bait_risk")
    elif bait_risk >= 65:
        total += 4.0
        reasons.append("elevated_bait_risk")

    if liquidity_score < 40:
        total += 7.0
        reasons.append("thin_sell_liquidity")
    elif liquidity_score < 48:
        total += 3.0
        reasons.append("shallow_sell_liquidity")

    if sell_history_spike:
        total += 6.0
        reasons.append("sell_history_spike")
    if inconsistent_sell_history:
        total += 4.0
        reasons.append("inconsistent_sell_history")
    if freshness_gap_flag:
        total += 4.0
        reasons.append("freshness_gap")
    if limited_history:
        total += 2.0
        reasons.append("limited_history")

    return ExecutionRiskPenalty(total=round(total, 2), reasons=reasons)


def score_opportunity(
    item: Item,
    buy_snapshot: ListingSnapshot,
    sell_snapshot: ListingSnapshot,
    settings: AppSettings,
    history: MarketHistoryContext | None = None,
) -> ScoreBreakdown:
    tuning = SCORING_PRESETS.get(settings.scoring_preset, SCORING_PRESETS["balanced"])
    buy_price = float(buy_snapshot.lowest_price or 0)
    observed_sell_price = float(sell_snapshot.lowest_price or 0)
    recommended_sell_price, sell_price_reasons = derive_recommended_sell_price(sell_snapshot, history)
    regional_anchor = _regional_value_anchor(item)
    regional_target_ratio = (recommended_sell_price / regional_anchor.value) if regional_anchor and regional_anchor.value > 0 else None
    original_regional_target_ratio = regional_target_ratio
    regional_cap_applied = False
    regional_cap_multiplier = None
    if regional_anchor and regional_target_ratio is not None and regional_target_ratio > 1.75:
        regional_cap_multiplier = 1.65 if regional_anchor.sold_per_day is not None and regional_anchor.sold_per_day <= 0.03 else 1.45
        regional_cap = round(regional_anchor.value * regional_cap_multiplier, 2)
        if recommended_sell_price > regional_cap:
            recommended_sell_price = regional_cap
            regional_target_ratio = recommended_sell_price / regional_anchor.value
            regional_cap_applied = True
            sell_price_reasons.append("regional historical value cap applied")
    estimated_profit, roi = calculate_profit_and_roi(buy_price, recommended_sell_price, settings)

    sell_depth = _market_depth_score(sell_snapshot, tuning, buy_side=False)
    buy_depth = _market_depth_score(buy_snapshot, tuning, buy_side=True)
    liquidity_score = round(clamp((sell_depth * 0.75) + (buy_depth * 0.25), 0, 100), 2)
    stable_sell_history = False
    repeatable_market = False
    persistent_margin = False

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
    sell_history_count = 0
    buy_history_count = 0
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
        sell_history_count = len(sell_history)
        buy_history_count = len(buy_history)
        if len(sell_history) < 2:
            limited_history = True
            volatility_score -= 4
        else:
            sell_median = median(sell_history)
            if sell_median > 0:
                buy_median = median(buy_history) if buy_history else 0
                sell_vs_history = observed_sell_price / sell_median
                if sell_vs_history > 1.35:
                    sell_history_spike = True
                    volatility_score -= min(26, (sell_vs_history - 1.35) * 26)
                sell_range_ratio = max(sell_history) / max(min(sell_history), sell_median * 0.05)
                if sell_range_ratio > 1.7:
                    inconsistent_sell_history = True
                    volatility_score -= min(18, (sell_range_ratio - 1.7) * 12)
                elif len(sell_history) >= 3 and sell_range_ratio <= 1.18 and history.freshness_gap_minutes <= 30:
                    stable_sell_history = True
                elif len(sell_history) >= 3 and sell_range_ratio <= 1.28:
                    volatility_score += 2
                    liquidity_score += 2
                if len(sell_history) >= 4 and sell_range_ratio <= 1.28:
                    repeatable_market = True
                if len(sell_history) >= 5 and len(buy_history) >= 3 and buy_median > 0 and sell_median / buy_median >= 1.18:
                    persistent_margin = True
        if len(buy_history) < 2:
            limited_history = True
            volatility_score -= 2
        elif len(buy_history) >= 3:
            buy_range_ratio = max(buy_history) / max(min(buy_history), 1)
            if buy_range_ratio <= 1.22:
                volatility_score += 2
        if history.freshness_gap_minutes > 180:
            freshness_gap_flag = True
            volatility_score -= min(14, ((history.freshness_gap_minutes - 180) / 30) * 3)

    rare_market_detected = bool(
        regional_anchor
        and _is_thin_market(sell_snapshot)
        and sell_history_count < 3
        and _has_regional_sale_evidence(regional_anchor)
    )
    rare_market_supported_by_region = bool(
        rare_market_detected
        and regional_target_ratio is not None
        and regional_target_ratio <= 1.35
    )
    rare_market_overpriced_vs_region = bool(
        regional_anchor
        and original_regional_target_ratio is not None
        and original_regional_target_ratio > 1.75
    )
    rare_liquidity_relief = 0.0
    rare_volatility_relief = 0.0
    if rare_market_supported_by_region:
        rare_liquidity_relief = 8.0
        rare_volatility_relief = 4.0
        liquidity_score += rare_liquidity_relief
        volatility_score += rare_volatility_relief

    volatility_score = round(clamp(volatility_score, 0, 100), 2)
    liquidity_score = round(clamp(liquidity_score, 0, 100), 2)

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
    if limited_history:
        bait_risk += 3
    if inconsistent_sell_history:
        bait_risk += 8
    if sell_history_spike:
        bait_risk += 12
    if freshness_gap_flag:
        bait_risk += 8
    rare_bait_relief = 0.0
    if rare_market_supported_by_region:
        rare_bait_relief = 8.0
        bait_risk -= rare_bait_relief
    if rare_market_overpriced_vs_region:
        bait_risk += 10
    has_stale_data = bool(buy_snapshot.is_stale or sell_snapshot.is_stale)
    if has_stale_data:
        bait_risk += tuning["stale_penalty"] * 0.75
    bait_risk = round(clamp(bait_risk, 0, 100), 2)

    liquidity_component = liquidity_score * SELLABILITY_WEIGHTS["liquidity"]
    volatility_component = volatility_score * SELLABILITY_WEIGHTS["volatility"]
    anti_bait_component = (100 - bait_risk) * SELLABILITY_WEIGHTS["anti_bait"]
    sellability_score = (
        liquidity_component
        + volatility_component
        + anti_bait_component
    )
    stable_history_bonus = 0.0
    repeatable_market_bonus = 0.0
    persistent_margin_bonus = 0.0
    limited_history_penalty = 0.0
    freshness_gap_penalty = 0.0
    sell_history_spike_penalty = 0.0
    if stable_sell_history:
        stable_history_bonus = 6.0
        sellability_score += stable_history_bonus
    if repeatable_market:
        repeatable_market_bonus = 5.0
        sellability_score += repeatable_market_bonus
    if persistent_margin:
        persistent_margin_bonus = 8.0
        sellability_score += persistent_margin_bonus
    if limited_history:
        limited_history_penalty = 1.0 if rare_market_supported_by_region else 2.5
        sellability_score -= limited_history_penalty
    if freshness_gap_flag:
        freshness_gap_penalty = 5.0
        sellability_score -= freshness_gap_penalty
    if sell_history_spike:
        sell_history_spike_penalty = 10.0
        sellability_score -= sell_history_spike_penalty
    if item.name is None:
        sellability_score -= 4
    sellability_score = round(clamp(sellability_score, 0, 100), 2)
    turnover_label = _turnover_label(sellability_score)

    confidence = (
        (liquidity_score * CONFIDENCE_WEIGHTS["liquidity"])
        + (volatility_score * CONFIDENCE_WEIGHTS["volatility"])
        + ((100 - bait_risk) * CONFIDENCE_WEIGHTS["anti_bait"])
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
        confidence -= 0.25 if rare_market_supported_by_region else 1
    if freshness_gap_flag:
        confidence -= 2

    # Minimum-evidence gate: prevent high labels when depth/coverage/recency is weak.
    sell_depth_ok = (sell_snapshot.quantity or 0) >= 4 and (sell_snapshot.listing_count or 0) >= 3
    history_coverage_ok = False
    if history is not None:
        history_coverage_ok = len([price for price in history.sell_recent_prices if price > 0]) >= 3
    if rare_market_supported_by_region:
        history_coverage_ok = True
    # Treat missing history as unknown, not stale — freshness_gap_flag handles the penalty separately.
    recency_ok = history is None or history.freshness_gap_minutes <= 120
    sufficient_evidence = sell_depth_ok and history_coverage_ok and recency_ok
    evidence_gate_applied = not sufficient_evidence
    gate_reasons: list[str] = []
    if evidence_gate_applied:
        if not sell_depth_ok:
            gate_reasons.append("sell_depth_below_minimum")
        if not history_coverage_ok:
            gate_reasons.append("insufficient_history")
        if not recency_ok:
            gate_reasons.append("snapshot_recency_gap_too_large")

    confidence = round(clamp(confidence, 0, 100), 2)
    sellability_score = round(clamp(sellability_score, 0, 100), 2)

    profit_component = clamp((estimated_profit / max(buy_price, 1)) * 32, -35, 100)
    roi_component = clamp(roi * 85, -35, 100)
    capital_efficiency_score = clamp((roi * 120) + (sellability_score * 0.35) - ((buy_price / max(recommended_sell_price, 1)) * 25), 0, 100)
    final_score = (
        (confidence * FINAL_SCORE_WEIGHTS["confidence"])
        + (sellability_score * FINAL_SCORE_WEIGHTS["sellability"])
        + (capital_efficiency_score * FINAL_SCORE_WEIGHTS["capital_efficiency"])
        + (profit_component * FINAL_SCORE_WEIGHTS["profit_component"])
        + (roi_component * FINAL_SCORE_WEIGHTS["roi_component"])
    )
    execution_risk = _execution_risk_penalty(
        bait_risk=bait_risk,
        liquidity_score=liquidity_score,
        limited_history=limited_history,
        inconsistent_sell_history=inconsistent_sell_history,
        sell_history_spike=sell_history_spike,
        freshness_gap_flag=freshness_gap_flag,
    )
    final_score -= execution_risk.total
    if buy_price >= 2_500_000 and roi < 0.18:
        final_score -= 8
    if stable_sell_history:
        final_score += 5
    if repeatable_market:
        final_score += 4
    if persistent_margin:
        final_score += 7
    if rare_market_overpriced_vs_region:
        final_score -= 6
    final_score = round(clamp(final_score, 0, 100), 2)
    evidence_cap = _evidence_gate_cap(
        sell_depth_ok=sell_depth_ok,
        history_coverage_ok=history_coverage_ok,
        recency_ok=recency_ok,
    )
    if evidence_cap is not None:
        final_score = min(final_score, evidence_cap)

    score_provenance = {
        "components": {
            "liquidity": round(liquidity_component, 2),
            "volatility": round(volatility_component, 2),
            "anti_bait": round(anti_bait_component, 2),
        },
        "confidence_components": {
            "liquidity": round(liquidity_score * CONFIDENCE_WEIGHTS["liquidity"], 2),
            "volatility": round(volatility_score * CONFIDENCE_WEIGHTS["volatility"], 2),
            "anti_bait": round((100 - bait_risk) * CONFIDENCE_WEIGHTS["anti_bait"], 2),
        },
        "final_components": {
            "confidence": round(confidence * FINAL_SCORE_WEIGHTS["confidence"], 2),
            "sellability": round(sellability_score * FINAL_SCORE_WEIGHTS["sellability"], 2),
            "capital_efficiency": round(capital_efficiency_score * FINAL_SCORE_WEIGHTS["capital_efficiency"], 2),
            "profit_component": round(profit_component * FINAL_SCORE_WEIGHTS["profit_component"], 2),
            "roi_component": round(roi_component * FINAL_SCORE_WEIGHTS["roi_component"], 2),
        },
        "adjustments": {
            "stable_history_bonus": stable_history_bonus,
            "repeatable_market_bonus": repeatable_market_bonus,
            "persistent_margin_bonus": persistent_margin_bonus,
            "limited_history_penalty": limited_history_penalty,
            "freshness_gap_penalty": freshness_gap_penalty,
            "sell_history_spike_penalty": sell_history_spike_penalty,
            "rare_market_liquidity_relief": rare_liquidity_relief,
            "rare_market_volatility_relief": rare_volatility_relief,
            "rare_market_bait_relief": rare_bait_relief,
            "execution_risk_penalty": execution_risk.total,
            "execution_risk_reasons": execution_risk.reasons,
        },
        "evidence": {
            "sell_depth_ok": sell_depth_ok,
            "history_coverage_ok": history_coverage_ok,
            "recency_ok": recency_ok,
            "gate_applied": evidence_gate_applied,
            "gate_cap": evidence_cap,
            "gate_reasons": gate_reasons,
        },
        "regional_anchor": {
            "value": regional_anchor.value if regional_anchor else None,
            "source": regional_anchor.source if regional_anchor else None,
            "sale_rate": regional_anchor.sale_rate if regional_anchor else None,
            "sold_per_day": regional_anchor.sold_per_day if regional_anchor else None,
            "target_vs_region": round(regional_target_ratio, 4) if regional_target_ratio is not None else None,
            "original_target_vs_region": round(original_regional_target_ratio, 4) if original_regional_target_ratio is not None else None,
            "rare_market_detected": rare_market_detected,
            "rare_market_supported": rare_market_supported_by_region,
            "regional_cap_applied": regional_cap_applied,
            "regional_cap_multiplier": regional_cap_multiplier,
            "overpriced_vs_region": rare_market_overpriced_vs_region,
            "sell_history_count": sell_history_count,
            "buy_history_count": buy_history_count,
        },
    }

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
        observed_sell_price=observed_sell_price,
        recommended_sell_price=recommended_sell_price,
        sell_price_reasons=sell_price_reasons,
        rare_market_supported_by_region=rare_market_supported_by_region,
        regional_cap_applied=regional_cap_applied,
        rare_market_overpriced_vs_region=rare_market_overpriced_vs_region,
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
        score_provenance=score_provenance,
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
    observed_sell_price: float | None = None,
    recommended_sell_price: float | None = None,
    sell_price_reasons: list[str] | None = None,
    rare_market_supported_by_region: bool = False,
    regional_cap_applied: bool = False,
    rare_market_overpriced_vs_region: bool = False,
) -> str:
    sell_target_note = ""
    if observed_sell_price and recommended_sell_price and recommended_sell_price < observed_sell_price:
        sell_target_note = f" Conservative sell target used instead of the raw lowest listing on {sell_realm}."
    if sell_price_reasons:
        sell_target_note = f"{sell_target_note} " + "; ".join(sell_price_reasons).capitalize() + "."
        sell_target_note = sell_target_note.strip()
    if regional_cap_applied:
        sell_target_note = f"{sell_target_note} Regional value anchor capped the sell target.".strip()
    elif rare_market_supported_by_region:
        sell_target_note = f"{sell_target_note} Rare-item safeguard softened thin-market penalties because regional sale history supports the target.".strip()
    elif rare_market_overpriced_vs_region:
        sell_target_note = f"{sell_target_note} Regional history suggests the target price is high for this item.".strip()
    if has_stale_data:
        return f"High margin detected, but confidence reduced due to stale target data on {sell_realm}.{sell_target_note}".strip()
    if sell_history_spike:
        return f"Sell price looks far above recent history on {sell_realm}, so confidence is reduced.{sell_target_note}".strip()
    if inconsistent_sell_history:
        return f"Cheapest on {buy_realm}, but recent sell-side pricing on {sell_realm} has been inconsistent.{sell_target_note}".strip()
    if freshness_gap_flag:
        return f"Cheapest on {buy_realm}, strongest sell on {sell_realm}, but the market snapshots are not closely timed.{sell_target_note}".strip()
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
