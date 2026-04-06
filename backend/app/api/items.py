from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.item import ItemDetail, ItemRefreshRequest, ItemSearchRequest, ItemSearchResult
from app.services import metadata_service


router = APIRouter(tags=["items"])


@router.post("/items/search", response_model=list[ItemSearchResult])
def search_items(payload: ItemSearchRequest, db: Session = Depends(get_db)) -> list[ItemSearchResult]:
    items = metadata_service.search_items(db, payload.query, payload.limit)
    return metadata_service.to_search_results(items)


@router.get("/items/{item_id}", response_model=ItemDetail)
def get_item(item_id: int, db: Session = Depends(get_db)) -> ItemDetail:
    item = metadata_service.get_item_detail(db, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found.")
    return item


@router.post("/items/refresh-metadata")
def refresh_metadata(payload: ItemRefreshRequest, db: Session = Depends(get_db)) -> dict[str, object]:
    return metadata_service.refresh_metadata(db, payload.item_ids)

