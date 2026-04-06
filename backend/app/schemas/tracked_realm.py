from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class TrackedRealmBase(BaseModel):
    realm_name: str = Field(min_length=1, max_length=120)
    region: str = Field(default="us", min_length=2, max_length=16)
    enabled: bool = True


class TrackedRealmCreate(TrackedRealmBase):
    pass


class TrackedRealmUpdate(BaseModel):
    realm_name: str | None = Field(default=None, min_length=1, max_length=120)
    region: str | None = Field(default=None, min_length=2, max_length=16)
    enabled: bool | None = None


class TrackedRealmRead(TrackedRealmBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

