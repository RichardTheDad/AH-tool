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
    pass


class ItemDetail(ItemRead):
    latest_listings: list[ListingSnapshotRead] = Field(default_factory=list)
    recent_scan: ScanResultRead | None = None

