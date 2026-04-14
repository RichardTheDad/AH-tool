from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.listing import ListingSnapshotRead
from app.schemas.scan import ScanResultRead


class ItemSearchRequest(BaseModel):
    query: str = Field(min_length=1)
    limit: int = Field(default=25, ge=1, le=100)


class ItemRefreshRequest(BaseModel):
    item_ids: list[int] = Field(min_length=1)


class ItemRead(BaseModel):
    item_id: int
    name: str
    class_name: str | None = None
    subclass_name: str | None = None
    quality: str | None = None
    icon_url: str | None = None
    metadata_json: dict | None = None
    metadata_updated_at: datetime | None = None
    is_commodity: bool = False

    model_config = ConfigDict(from_attributes=True)


class ItemSearchResult(ItemRead):
    undermine_url: str | None = None


class TsmRegionStatsRead(BaseModel):
    db_region_market_avg: float | None = None
    db_region_historical: float | None = None
    db_region_sale_avg: float | None = None
    db_region_sale_rate: float | None = None
    db_region_sold_per_day: float | None = None


class ItemHistoryPointRead(BaseModel):
    captured_at: datetime
    lowest_price: float | None = None
    average_price: float | None = None
    quantity: int | None = None
    listing_count: int | None = None


class ItemRealmHistoryRead(BaseModel):
    realm: str
    points: list[ItemHistoryPointRead] = Field(default_factory=list)


class ItemDetail(ItemRead):
    undermine_url: str | None = None
    metadata_status: str = "cached"
    metadata_message: str | None = None
    latest_listings: list[ListingSnapshotRead] = Field(default_factory=list)
    auction_history: list[ItemRealmHistoryRead] = Field(default_factory=list)
    tsm_status: str = "unavailable"
    tsm_message: str | None = None
    tsm_region_stats: TsmRegionStatsRead | None = None
    recent_scan: ScanResultRead | None = None
