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


class TsmRealmStatsRead(BaseModel):
    realm: str
    min_buyout: float | None = None
    num_auctions: float | None = None
    market_value_recent: float | None = None
    historical: float | None = None


class TsmLedgerSaleRead(BaseModel):
    realm: str
    quantity: int | None = None
    price: float | None = None
    other_player: str | None = None
    player: str | None = None
    time: datetime | None = None
    source: str | None = None


class TsmLedgerSummaryRead(BaseModel):
    auction_sale_count: int = 0
    auction_units_sold: int = 0
    auction_avg_unit_sale_price: float | None = None
    last_auction_sale_at: datetime | None = None
    auction_buy_count: int = 0
    auction_units_bought: int = 0
    auction_avg_unit_buy_price: float | None = None
    last_auction_buy_at: datetime | None = None
    cancel_count: int = 0
    expired_count: int = 0
    last_cancel_at: datetime | None = None
    last_expired_at: datetime | None = None
    recent_sales: list[TsmLedgerSaleRead] = Field(default_factory=list)


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
    tsm_realm_stats: list[TsmRealmStatsRead] = Field(default_factory=list)
    tsm_ledger_status: str = "unavailable"
    tsm_ledger_message: str | None = None
    tsm_ledger_summary: TsmLedgerSummaryRead | None = None
    recent_scan: ScanResultRead | None = None
