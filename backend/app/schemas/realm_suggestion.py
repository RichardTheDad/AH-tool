from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class SuggestedRealmItemRead(BaseModel):
    item_id: int
    item_name: str
    undermine_url: str | None = None
    target_realm: str
    buy_price: float
    target_sell_price: float
    estimated_profit: float
    roi: float
    confidence_score: float
    sellability_score: float
    turnover_label: str


class SuggestedRealmRead(BaseModel):
    realm: str
    opportunity_count: int
    cheapest_source_count: int
    average_profit: float
    average_roi: float
    average_confidence: float
    average_sellability: float
    consistency_score: float
    latest_captured_at: datetime | None = None
    appearance_count: int = 0
    cheap_run_count: int = 0
    window_size: int = 0
    recent_run_count: int = 0
    median_buy_price: float | None = None
    best_target_realm: str | None = None
    last_seen_cheapest_at: datetime | None = None
    is_tracked: bool = False
    explanation: str
    top_items: list[SuggestedRealmItemRead] = Field(default_factory=list)


class SuggestedRealmReportRead(BaseModel):
    generated_at: datetime | None = None
    target_realms: list[str] = Field(default_factory=list)
    source_realm_count: int = 0
    warning_text: str | None = None
    recommendations: list[SuggestedRealmRead] = Field(default_factory=list)


class SuggestedRealmLatestResponse(BaseModel):
    latest: SuggestedRealmReportRead | None = None


class SuggestedRealmRunRequest(BaseModel):
    target_realms: list[str] = Field(default_factory=list)
