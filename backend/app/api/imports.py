from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.schemas.listing import ListingImportResponse
from app.services.import_service import handle_listing_import


router = APIRouter(tags=["imports"])


@router.post("/imports/listings", response_model=ListingImportResponse)
def import_listings(
    file: UploadFile = File(...),
    commit: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
) -> ListingImportResponse:
    content = file.file.read()
    return handle_listing_import(db, file.filename or "import.csv", content, commit)

