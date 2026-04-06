from __future__ import annotations

import csv
import json
from io import StringIO
from pathlib import Path

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.schemas.listing import (
    ListingImportError,
    ListingImportPreviewRow,
    ListingImportResponse,
    ListingImportRow,
)
from app.services.listing_service import persist_listing_rows
from app.services.realm_service import get_enabled_realm_names


def _normalize_value(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def parse_listing_rows(filename: str, file_bytes: bytes) -> tuple[list[ListingImportRow], list[ListingImportError]]:
    suffix = Path(filename or "import.csv").suffix.lower()
    raw_rows: list[dict] = []

    if suffix not in {".csv", ".json"}:
        return [], [ListingImportError(row_number=0, message="Only CSV and JSON files are supported.")]

    if suffix == ".json":
        try:
            payload = json.loads(file_bytes.decode("utf-8"))
        except UnicodeDecodeError:
            return [], [ListingImportError(row_number=0, message="JSON file must be UTF-8 encoded.")]
        except json.JSONDecodeError as exc:
            return [], [ListingImportError(row_number=0, message=f"JSON could not be parsed: {exc.msg}.")]
        if isinstance(payload, dict):
            payload = payload.get("records", [])
        if not isinstance(payload, list):
            return [], [ListingImportError(row_number=0, message="JSON payload must be an array or {records: []}.")]
        for row_number, row in enumerate(payload, start=1):
            if not isinstance(row, dict):
                raw_rows.append({"__row_error__": "JSON rows must be objects."})
                continue
            raw_rows.append(row)
    else:
        try:
            decoded = file_bytes.decode("utf-8-sig")
        except UnicodeDecodeError:
            return [], [ListingImportError(row_number=0, message="CSV file must be UTF-8 encoded.")]
        reader = csv.DictReader(StringIO(decoded))
        if not reader.fieldnames:
            return [], [ListingImportError(row_number=0, message="CSV file is missing a header row.")]
        required_headers = {"item_id", "realm", "lowest_price"}
        missing_headers = required_headers.difference({field.strip() for field in reader.fieldnames if field})
        if missing_headers:
            missing = ", ".join(sorted(missing_headers))
            return [], [ListingImportError(row_number=0, message=f"CSV file is missing required columns: {missing}.")]
        raw_rows = [dict(row) for row in reader]

    rows: list[ListingImportRow] = []
    errors: list[ListingImportError] = []
    for row_number, raw in enumerate(raw_rows, start=1):
        if "__row_error__" in raw:
            errors.append(ListingImportError(row_number=row_number, message=str(raw["__row_error__"])))
            continue
        normalized = {key: _normalize_value(value) for key, value in raw.items()}
        try:
            rows.append(ListingImportRow.model_validate(normalized))
        except ValidationError as exc:
            errors.append(ListingImportError(row_number=row_number, message=exc.errors()[0]["msg"]))

    return rows, errors


def handle_listing_import(session: Session, filename: str, file_bytes: bytes, commit: bool) -> ListingImportResponse:
    rows, errors = parse_listing_rows(filename, file_bytes)
    enabled_realms = {realm.casefold() for realm in get_enabled_realm_names(session)}
    untracked_realms = sorted({row.realm for row in rows if enabled_realms and row.realm.casefold() not in enabled_realms})

    preview_rows = [
        ListingImportPreviewRow(
            row_number=index,
            item_id=row.item_id,
            realm=row.realm,
            lowest_price=row.lowest_price,
            average_price=row.average_price,
            quantity=row.quantity,
            listing_count=row.listing_count,
            captured_at=row.captured_at,
        )
        for index, row in enumerate(rows[:50], start=1)
    ]

    if errors:
        return ListingImportResponse(
            committed=False,
            accepted_count=len(rows),
            preview_rows=preview_rows,
            errors=errors,
            untracked_realms=untracked_realms,
            summary=f"Validated {len(rows)} rows and found {len(errors)} errors." if rows or errors else None,
            warning="Fix validation errors before committing the import.",
        )

    if not commit:
        return ListingImportResponse(
            committed=False,
            accepted_count=len(rows),
            preview_rows=preview_rows,
            inserted_count=0,
            untracked_realms=untracked_realms,
            summary=f"Validated {len(rows)} rows and found no blocking issues.",
            warning="Preview only. Re-submit with commit=true to save these rows.",
        )

    inserted, skipped_duplicates = persist_listing_rows(session, rows, source_name="file_import")
    warning_parts: list[str] = []
    if untracked_realms:
        warning_parts.append(f"Imported realms not currently tracked: {', '.join(untracked_realms)}.")
    if skipped_duplicates:
        warning_parts.append(f"Skipped {skipped_duplicates} duplicate rows already present in the preview or cache.")
    return ListingImportResponse(
        committed=True,
        accepted_count=len(rows),
        preview_rows=preview_rows,
        inserted_count=inserted,
        skipped_duplicates=skipped_duplicates,
        untracked_realms=untracked_realms,
        summary=f"Imported {inserted} listing rows from {len(rows)} validated rows.",
        warning=" ".join(warning_parts) if warning_parts else None,
    )
