from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ScanResultRead(BaseModel):
    id: int
    item_id: int
    item_name: str
    undermine_url: str | None = None
    item_quality: str | None = None
    item_class_name: str | None = None
    item_icon_url: str | None = None
    cheapest_buy_realm: str
    cheapest_buy_price: float
    best_sell_realm: str
    best_sell_price: float
    observed_sell_price: float | None = None
    estimated_profit: float
    roi: float
    confidence_score: float
    sellability_score: float = 0
    liquidity_score: float
    volatility_score: float
    bait_risk_score: float
    final_score: float
    turnover_label: str = "slow"
    explanation: str
    sell_history_prices: list[float] = Field(default_factory=list)
    generated_at: datetime
    has_stale_data: bool
    is_risky: bool
    has_missing_metadata: bool = False
    score_provenance: dict[str, Any] | None = None


class ScanSessionRead(BaseModel):
    id: int
    provider_name: str
    warning_text: str | None = None
    generated_at: datetime
    result_count: int
    results: list[ScanResultRead] = Field(default_factory=list)


class ScanRunRequest(BaseModel):
    preset_id: int | None = None
    refresh_live: bool = False
    include_losers: bool = False


class ScanLatestResponse(BaseModel):
    latest: ScanSessionRead | None = None


class RealmScanReadiness(BaseModel):
    realm: str
    has_data: bool
    fresh_item_count: int = 0
    stale_item_count: int = 0
    latest_item_count: int = 0
    freshest_captured_at: datetime | None = None
    latest_source_name: str | None = None


class ScanReadinessRead(BaseModel):
    status: str
    ready_for_scan: bool
    message: str
    enabled_realm_count: int
    realms_with_data: int
    realms_with_fresh_data: int
    unique_item_count: int
    items_missing_metadata: int
    stale_realm_count: int
    missing_realms: list[str] = Field(default_factory=list)
    stale_realms: list[str] = Field(default_factory=list)
    oldest_snapshot_at: datetime | None = None
    latest_snapshot_at: datetime | None = None
    realms: list[RealmScanReadiness] = Field(default_factory=list)


class ScanRuntimeStatusRead(BaseModel):
    status: str
    message: str
    provider_name: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None


class ScanResultFilterState(BaseModel):
    min_profit: float | None = None
    min_roi: float | None = None
    max_buy_price: float | None = None
    min_confidence: float | None = None
    allow_stale: bool = False
    hide_risky: bool = True
    category_filter: str | None = None


class ScanSessionSummary(BaseModel):
    id: int
    generated_at: datetime
    provider_name: str
    result_count: int

    model_config = ConfigDict(from_attributes=True)


class ScanHistoryResponse(BaseModel):
    scans: list[ScanSessionSummary] = Field(default_factory=list)


class CalibrationBandRead(BaseModel):
    band: str
    total: int
    realized: int
    profitable: int
    realized_rate: float
    profitable_rate: float
    avg_target_capture: float


class HorizonCalibrationRead(BaseModel):
    horizon_hours: int
    total_evaluated: int
    realized_rate: float
    profitable_rate: float
    avg_target_capture: float
    confidence_bands: list[CalibrationBandRead] = Field(default_factory=list)
    sellability_bands: list[CalibrationBandRead] = Field(default_factory=list)


class CalibrationSuggestionRead(BaseModel):
    level: str
    message: str
    action_id: str | None = None
    action_label: str | None = None


class CalibrationTrendPointRead(BaseModel):
    period_start: datetime
    period_end: datetime
    total: int
    realized: int
    profitable: int
    realized_rate: float
    profitable_rate: float
    avg_confidence: float
    avg_sellability: float
    avg_target_capture: float


class ScanCalibrationSummaryRead(BaseModel):
    total_evaluated: int
    confidence_bands: list[CalibrationBandRead] = Field(default_factory=list)
    sellability_bands: list[CalibrationBandRead] = Field(default_factory=list)
    horizons: list[HorizonCalibrationRead] = Field(default_factory=list)
    trends: list[CalibrationTrendPointRead] = Field(default_factory=list)
    suggestions: list[CalibrationSuggestionRead] = Field(default_factory=list)
