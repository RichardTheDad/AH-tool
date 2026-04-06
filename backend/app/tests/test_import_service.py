from __future__ import annotations

from app.services.import_service import parse_listing_rows


def test_import_validation_reports_bad_rows() -> None:
    payload = b"item_id,realm,lowest_price,quantity\n,Stormrage,15000,2\n873,Zul'jin,,5\n"
    rows, errors = parse_listing_rows("bad.csv", payload)

    assert rows == []
    assert len(errors) == 2
    assert errors[0].row_number == 1


def test_import_validation_rejects_future_timestamps() -> None:
    payload = b"item_id,realm,lowest_price,captured_at\n873,Stormrage,15000,2099-01-01T00:00:00+00:00\n"
    rows, errors = parse_listing_rows("future.csv", payload)

    assert rows == []
    assert errors[0].message == "Value error, captured_at cannot be in the future"


def test_import_validation_reports_bad_json() -> None:
    rows, errors = parse_listing_rows("bad.json", b"{")

    assert rows == []
    assert errors[0].row_number == 0
    assert "JSON could not be parsed" in errors[0].message


def test_import_validation_reports_non_object_json_rows() -> None:
    rows, errors = parse_listing_rows("rows.json", b"[1, 2]")

    assert rows == []
    assert len(errors) == 2
    assert errors[0].message == "JSON rows must be objects."


def test_import_validation_reports_missing_csv_headers() -> None:
    rows, errors = parse_listing_rows("missing.csv", b"item_id,realm\n873,Stormrage\n")

    assert rows == []
    assert errors[0].row_number == 0
    assert "missing required columns" in errors[0].message
