from __future__ import annotations

from datetime import datetime, timedelta, timezone

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ListingSnapshotRead(BaseModel):
    id: int
    item_id: int
    realm: str
    lowest_price: float | None = None
    average_price: float | None = None
    quantity: int | None = None
    listing_count: int | None = None
    source_name: str
    captured_at: datetime
    is_stale: bool

    model_config = ConfigDict(from_attributes=True)


class ListingImportRow(BaseModel):
    item_id: int = Field(gt=0)
    realm: str = Field(min_length=1, max_length=120)
    lowest_price: float | None = Field(default=None, ge=0)
    average_price: float | None = Field(default=None, ge=0)
    quantity: int | None = Field(default=None, ge=0)
    listing_count: int | None = Field(default=None, ge=0)
    captured_at: datetime | None = None

    @field_validator("realm", mode="before")
    @classmethod
    def normalize_realm(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("captured_at", mode="after")
    @classmethod
    def normalize_captured_at(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return value
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    @model_validator(mode="after")
    def validate_price_presence(self) -> "ListingImportRow":
        if self.lowest_price is None:
            raise ValueError("lowest_price is required")
        if self.captured_at is None:
            self.captured_at = datetime.now(timezone.utc)
        if self.captured_at > datetime.now(timezone.utc) + timedelta(minutes=5):
            raise ValueError("captured_at cannot be in the future")
        return self


class ListingImportPreviewRow(BaseModel):
    row_number: int
    item_id: int
    realm: str
    lowest_price: float | None = None
    average_price: float | None = None
    quantity: int | None = None
    listing_count: int | None = None
    captured_at: datetime


class ListingImportError(BaseModel):
    row_number: int
    message: str


class ListingImportResponse(BaseModel):
    committed: bool
    provider_name: str = "file_import"
    accepted_count: int = 0
    inserted_count: int = 0
    skipped_duplicates: int = 0
    preview_rows: list[ListingImportPreviewRow] = Field(default_factory=list)
    errors: list[ListingImportError] = Field(default_factory=list)
    untracked_realms: list[str] = Field(default_factory=list)
    summary: str | None = None
    warning: str | None = None
