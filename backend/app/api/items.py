from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.item import ItemDetail, ItemRefreshRequest, ItemSearchRequest, ItemSearchResult
from app.schemas.listing import LiveListingLookupResponse
from app.services import metadata_service
from app.services.metadata_backfill_service import queue_missing_metadata_sweep


router = APIRouter(tags=["items"])


@router.post("/items/search", response_model=list[ItemSearchResult])
def search_items(payload: ItemSearchRequest, db: Session = Depends(get_db)) -> list[ItemSearchResult]:
    items = metadata_service.search_items(db, payload.query, payload.limit)
    return metadata_service.to_search_results(items)


@router.get("/items/{item_id}", response_model=ItemDetail)
def get_item(item_id: int, refresh_metadata_if_missing: bool = Query(default=True), db: Session = Depends(get_db)) -> ItemDetail:
    item = metadata_service.get_item_detail(db, item_id, refresh_metadata_if_missing=refresh_metadata_if_missing)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found.")
    return item


@router.post("/items/refresh-metadata")
def refresh_metadata(payload: ItemRefreshRequest, db: Session = Depends(get_db)) -> dict[str, object]:
    return metadata_service.refresh_metadata(db, payload.item_ids)


@router.post("/items/refresh-missing-metadata")
def refresh_missing_metadata(db: Session = Depends(get_db)) -> dict[str, object]:
    del db
    queued_count = queue_missing_metadata_sweep(limit=250)
    return {
        "queued_count": queued_count,
        "warnings": [] if queued_count else ["No unresolved metadata items were queued."],
    }


@router.get("/items/{item_id}/live-listings", response_model=LiveListingLookupResponse)
def get_live_item_listings(item_id: int, db: Session = Depends(get_db)) -> LiveListingLookupResponse:
    return metadata_service.get_live_item_listings(db, item_id)
