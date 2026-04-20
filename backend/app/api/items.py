from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, get_optional_user
from app.core.config import SYSTEM_USER_ID
from app.core.limiter import limiter
from app.db.session import get_db
from app.schemas.item import ItemDetail, ItemRefreshRequest, ItemSearchRequest, ItemSearchResult
from app.schemas.listing import LiveListingLookupResponse
from app.services import metadata_service
from app.services.metadata_backfill_service import queue_missing_metadata_sweep


router = APIRouter(tags=["items"])


@router.post("/items/search", response_model=list[ItemSearchResult])
def search_items(payload: ItemSearchRequest, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)) -> list[ItemSearchResult]:
    items = metadata_service.search_items(db, payload.query, payload.limit)
    return metadata_service.to_search_results(db, items, current_user)


@router.get("/items/{item_id}", response_model=ItemDetail)
def get_item(item_id: int, refresh_metadata_if_missing: bool = Query(default=True), db: Session = Depends(get_db), current_user: str | None = Depends(get_optional_user)) -> ItemDetail:
    item = metadata_service.get_item_detail(db, item_id, current_user or SYSTEM_USER_ID, refresh_metadata_if_missing=refresh_metadata_if_missing)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found.")
    return item


@router.post("/items/refresh-metadata")
@limiter.limit("5/minute")
def refresh_metadata(request: Request, payload: ItemRefreshRequest, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)) -> dict[str, object]:
    return metadata_service.refresh_metadata(db, payload.item_ids)


@router.post("/items/refresh-missing-metadata")
@limiter.limit("2/minute")
def refresh_missing_metadata(request: Request, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)) -> dict[str, object]:
    del db
    queued_count = queue_missing_metadata_sweep(limit=250)
    return {
        "queued_count": queued_count,
        "warnings": [] if queued_count else ["No unresolved metadata items were queued."],
    }


@router.get("/items/{item_id}/live-listings", response_model=LiveListingLookupResponse)
def get_live_item_listings(item_id: int, db: Session = Depends(get_db), current_user: str | None = Depends(get_optional_user)) -> LiveListingLookupResponse:
    return metadata_service.get_live_item_listings(db, item_id, current_user or SYSTEM_USER_ID)
