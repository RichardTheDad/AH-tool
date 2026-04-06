from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


SaddlebagRegion = Literal["US", "EU"]


def normalize_saddlebag_region(value: str | None) -> SaddlebagRegion:
    raw = str(value or "us").strip().upper()
    if raw in {"US", "NA"}:
        return "US"
    if raw == "EU":
        return "EU"
    raise ValueError(f"Unsupported Saddlebag region '{value}'.")


class WoWItemDataParams(BaseModel):
    ilvl: int = -1
    itemQuality: int = -1
    required_level: int = -1
    item_class: list[int] = Field(default_factory=lambda: [-1])
    item_subclass: list[int] = Field(default_factory=list)
    item_ids: list[int] = Field(default_factory=list)


class WoWItemNamesParams(BaseModel):
    item_ids: list[int] | None = None
    return_all: bool = False
    pets: bool = False
    use_db: bool = True


class WoWListingsParams(BaseModel):
    homeRealmId: int = Field(gt=0)
    region: SaddlebagRegion
    itemID: int = Field(gt=0)

    @field_validator("region", mode="before")
    @classmethod
    def validate_region(cls, value: object) -> SaddlebagRegion:
        return normalize_saddlebag_region(str(value) if value is not None else None)


class NormalizedSaddlebagItem(BaseModel):
    item_id: int
    name: str
    class_name: str | None = None
    subclass_name: str | None = None
    quality: str | None = None
    icon_url: str | None = None
    is_commodity: bool = False
    metadata_json: dict[str, Any] = Field(default_factory=dict)
