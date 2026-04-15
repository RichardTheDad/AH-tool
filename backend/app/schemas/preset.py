from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class ScanPresetBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    min_profit: float | None = Field(default=None, ge=0)
    min_roi: float | None = Field(default=None, ge=0)
    max_buy_price: float | None = Field(default=None, ge=0)
    min_confidence: float | None = Field(default=None, ge=0, le=100)
    allow_stale: bool = False
    hide_risky: bool = True
    category_filter: str | None = None
    buy_realms: list[str] | None = None
    sell_realms: list[str] | None = None


class ScanPresetCreate(ScanPresetBase):
    pass


class ScanPresetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    min_profit: float | None = Field(default=None, ge=0)
    min_roi: float | None = Field(default=None, ge=0)
    max_buy_price: float | None = Field(default=None, ge=0)
    min_confidence: float | None = Field(default=None, ge=0, le=100)
    allow_stale: bool | None = None
    hide_risky: bool | None = None
    category_filter: str | None = None
    buy_realms: list[str] | None = None
    sell_realms: list[str] | None = None


class ScanPresetRead(ScanPresetBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

