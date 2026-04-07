from __future__ import annotations

import csv
import json
from dataclasses import dataclass
from io import StringIO
from pathlib import Path

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.schemas.listing import (
    ListingImportCoverage,
    ListingImportError,
    ListingImportPreviewRow,
    ListingImportResponse,
    ListingImportRow,
)
from app.services.metadata_service import refresh_missing_metadata
from app.services.listing_service import persist_listing_rows
from app.services.realm_service import get_enabled_realm_names


@dataclass
class ParsedListingImportRow:
    row_number: int
    row: ListingImportRow


def _normalize_value(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def parse_listing_rows(filename: str, file_bytes: bytes) -> tuple[list[ParsedListingImportRow], list[ListingImportError]]:
    suffix = Path(filename or "import.csv").suffix.lower()
    raw_rows: list[tuple[int, dict]] = []

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
                raw_rows.append((row_number, {"__row_error__": "JSON rows must be objects."}))
                continue
            raw_rows.append((row_number, row))
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
        raw_rows = [(reader.line_num, dict(row)) for row in reader]

    rows: list[ParsedListingImportRow] = []
    errors: list[ListingImportError] = []
    for row_number, raw in raw_rows:
        if "__row_error__" in raw:
            errors.append(ListingImportError(row_number=row_number, message=str(raw["__row_error__"])))
            continue
        normalized = {key: _normalize_value(value) for key, value in raw.items()}
        try:
            rows.append(ParsedListingImportRow(row_number=row_number, row=ListingImportRow.model_validate(normalized)))
        except ValidationError as exc:
            errors.append(ListingImportError(row_number=row_number, message=exc.errors()[0]["msg"]))

    return rows, errors


def _build_import_coverage(rows: list[ParsedListingImportRow], enabled_realm_names: list[str]) -> ListingImportCoverage:
    if not rows:
        return ListingImportCoverage()

    enabled_realms = {realm.casefold() for realm in enabled_realm_names}
    row_realms = {parsed.row.realm for parsed in rows}
    captured_at_values = [parsed.row.captured_at for parsed in rows if parsed.row.captured_at is not None]
    covered_enabled_realms = {realm for realm in row_realms if realm.casefold() in enabled_realms}

    return ListingImportCoverage(
        realm_count=len(row_realms),
        unique_item_count=len({parsed.row.item_id for parsed in rows}),
        oldest_captured_at=min(captured_at_values) if captured_at_values else None,
        latest_captured_at=max(captured_at_values) if captured_at_values else None,
        enabled_realms_covered=len(covered_enabled_realms),
        missing_enabled_realms=sorted(
            realm for realm in enabled_realm_names if realm.casefold() not in {imported.casefold() for imported in row_realms}
        ),
    )


def handle_listing_import(session: Session, filename: str, file_bytes: bytes, commit: bool) -> ListingImportResponse:
    rows, errors = parse_listing_rows(filename, file_bytes)
    enabled_realm_names = get_enabled_realm_names(session)
    enabled_realms = {realm.casefold() for realm in enabled_realm_names}
    coverage = _build_import_coverage(rows, enabled_realm_names)
    untracked_realms = sorted({parsed.row.realm for parsed in rows if enabled_realms and parsed.row.realm.casefold() not in enabled_realms})

    preview_rows = [
        ListingImportPreviewRow(
            row_number=parsed.row_number,
            item_id=parsed.row.item_id,
            realm=parsed.row.realm,
            lowest_price=parsed.row.lowest_price,
            average_price=parsed.row.average_price,
            quantity=parsed.row.quantity,
            listing_count=parsed.row.listing_count,
            captured_at=parsed.row.captured_at,
        )
        for parsed in rows[:50]
    ]

    if errors:
        return ListingImportResponse(
            committed=False,
            accepted_count=len(rows),
            preview_rows=preview_rows,
            errors=errors,
            untracked_realms=untracked_realms,
            coverage=coverage,
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
            coverage=coverage,
            summary=f"Validated {len(rows)} rows and found no blocking issues.",
            warning="Preview only. Re-submit with commit=true to save these rows.",
        )

    inserted, skipped_duplicates = persist_listing_rows(session, [parsed.row for parsed in rows], source_name="file_import")
    metadata_refresh = refresh_missing_metadata(session, [parsed.row.item_id for parsed in rows])
    warning_parts: list[str] = []
    if untracked_realms:
        warning_parts.append(f"Imported realms not currently tracked: {', '.join(untracked_realms)}.")
    if skipped_duplicates:
        warning_parts.append(f"Skipped {skipped_duplicates} duplicate rows already present in the preview or cache.")
    if metadata_refresh["warnings"]:
        warning_parts.append(" ".join(metadata_refresh["warnings"]))
    return ListingImportResponse(
        committed=True,
        accepted_count=len(rows),
        preview_rows=preview_rows,
        inserted_count=inserted,
        skipped_duplicates=skipped_duplicates,
        metadata_refreshed_count=int(metadata_refresh["refreshed_count"]),
        untracked_realms=untracked_realms,
        coverage=coverage,
        summary=f"Imported {inserted} listing rows from {len(rows)} validated rows.",
        warning=" ".join(warning_parts) if warning_parts else None,
    )
