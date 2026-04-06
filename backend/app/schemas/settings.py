from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class AppSettingsRead(BaseModel):
    id: int
    ah_cut_percent: float
    flat_buffer: float
    refresh_interval_minutes: int
    stale_after_minutes: int
    scoring_preset: str
    non_commodity_only: bool

    model_config = ConfigDict(from_attributes=True)


class AppSettingsUpdate(BaseModel):
    ah_cut_percent: float | None = Field(default=None, ge=0, le=0.95)
    flat_buffer: float | None = Field(default=None, ge=0)
    refresh_interval_minutes: int | None = Field(default=None, ge=5, le=1440)
    stale_after_minutes: int | None = Field(default=None, ge=5, le=10080)
    scoring_preset: str | None = Field(default=None, pattern="^(safe|balanced|aggressive)$")
    non_commodity_only: bool | None = None

