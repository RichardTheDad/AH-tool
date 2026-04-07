from __future__ import annotations

from app.services.import_service import _build_import_coverage, parse_listing_rows


def test_import_validation_reports_bad_rows() -> None:
    payload = b"item_id,realm,lowest_price,quantity\n,Stormrage,15000,2\n873,Zul'jin,,5\n"
    rows, errors = parse_listing_rows("bad.csv", payload)

    assert rows == []
    assert len(errors) == 2
    assert errors[0].row_number == 2
    assert errors[1].row_number == 3


def test_import_preview_rows_preserve_original_source_row_numbers() -> None:
    payload = (
        b"item_id,realm,lowest_price,quantity\n"
        b"873,Stormrage,15000,2\n"
        b",Illidan,12000,1\n"
        b"1745,Zul'jin,22000,4\n"
    )
    rows, errors = parse_listing_rows("mixed.csv", payload)

    assert [row.row_number for row in rows] == [2, 4]
    assert [row.row.item_id for row in rows] == [873, 1745]
    assert len(errors) == 1
    assert errors[0].row_number == 3


def test_import_validation_rejects_future_timestamps() -> None:
    payload = b"item_id,realm,lowest_price,captured_at\n873,Stormrage,15000,2099-01-01T00:00:00+00:00\n"
    rows, errors = parse_listing_rows("future.csv", payload)

    assert rows == []
    assert errors[0].row_number == 2
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
    assert [error.row_number for error in errors] == [1, 2]
    assert errors[0].message == "JSON rows must be objects."


def test_import_validation_reports_missing_csv_headers() -> None:
    rows, errors = parse_listing_rows("missing.csv", b"item_id,realm\n873,Stormrage\n")

    assert rows == []
    assert errors[0].row_number == 0
    assert "missing required columns" in errors[0].message


def test_import_coverage_reports_missing_enabled_realms() -> None:
    payload = (
        b"item_id,realm,lowest_price,quantity,captured_at\n"
        b"873,Stormrage,15000,2,2026-04-06T02:45:00+00:00\n"
        b"1745,Illidan,12000,1,2026-04-06T02:50:00+00:00\n"
    )
    rows, errors = parse_listing_rows("coverage.csv", payload)

    assert errors == []
    coverage = _build_import_coverage(rows, ["Stormrage", "Zul'jin"])
    assert coverage.realm_count == 2
    assert coverage.unique_item_count == 2
    assert coverage.enabled_realms_covered == 1
    assert coverage.missing_enabled_realms == ["Zul'jin"]
