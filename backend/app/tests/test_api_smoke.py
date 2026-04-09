from __future__ import annotations

from sqlalchemy import text

from app.db.session import get_engine


def test_settings_presets_imports_and_providers_smoke(client) -> None:
    settings = client.get("/settings")
    assert settings.status_code == 200
    assert settings.json()["scoring_preset"] == "balanced"

    update_settings = client.put(
        "/settings",
        json={
            "ah_cut_percent": 0.07,
            "flat_buffer": 250,
            "refresh_interval_minutes": 45,
            "stale_after_minutes": 180,
            "scoring_preset": "safe",
            "non_commodity_only": True,
        },
    )
    assert update_settings.status_code == 200
    assert update_settings.json()["ah_cut_percent"] == 0.07

    presets = client.get("/presets")
    assert presets.status_code == 200
    assert len(presets.json()) >= 3

    create_preset = client.post(
        "/presets",
        json={
            "name": "Smoke Preset",
            "min_profit": 1234,
            "min_roi": 0.15,
            "max_buy_price": 50000,
            "min_confidence": 60,
            "allow_stale": False,
            "hide_risky": True,
            "category_filter": "Weapon",
        },
    )
    assert create_preset.status_code == 201
    preset_id = create_preset.json()["id"]

    update_preset = client.put(f"/presets/{preset_id}", json={"min_profit": 2222})
    assert update_preset.status_code == 200
    assert update_preset.json()["min_profit"] == 2222

    delete_preset = client.delete(f"/presets/{preset_id}")
    assert delete_preset.status_code == 204

    client.post("/realms", json={"realm_name": "Stormrage", "region": "us", "enabled": True})
    payload = b"item_id,realm,lowest_price,average_price,quantity,listing_count,captured_at\n873,Stormrage,15000,15500,2,2,2026-04-06T02:45:00+00:00\n"

    preview_import = client.post(
        "/imports/listings",
        data={"commit": "false"},
        files={"file": ("listings.csv", payload, "text/csv")},
    )
    assert preview_import.status_code == 200
    assert preview_import.json()["accepted_count"] == 1
    assert preview_import.json()["committed"] is False
    assert preview_import.json()["coverage"]["realm_count"] == 1
    assert preview_import.json()["coverage"]["unique_item_count"] == 1

    commit_import = client.post(
        "/imports/listings",
        data={"commit": "true"},
        files={"file": ("listings.csv", payload, "text/csv")},
    )
    assert commit_import.status_code == 200
    assert commit_import.json()["inserted_count"] == 1

    providers = client.get("/providers/status")
    assert providers.status_code == 200
    names = {provider["name"]: provider for provider in providers.json()["providers"]}
    assert set(names) == {"blizzard_auctions", "blizzard_metadata", "file_import"}

    readiness = client.get("/scans/readiness")
    assert readiness.status_code == 200
    assert "status" in readiness.json()

    status = client.get("/scans/status")
    assert status.status_code == 200
    assert status.json()["status"] in {"idle", "running"}


def test_items_endpoints_smoke(client) -> None:
    client.post("/realms", json={"realm_name": "Stormrage", "region": "us", "enabled": True})
    payload = b"item_id,realm,lowest_price,average_price,quantity,listing_count,captured_at\n873,Stormrage,15000,15500,2,2,2026-04-06T02:45:00+00:00\n"
    client.post(
        "/imports/listings",
        data={"commit": "true"},
        files={"file": ("listings.csv", payload, "text/csv")},
    )

    search = client.post("/items/search", json={"query": "873", "limit": 10})
    assert search.status_code == 200
    assert search.json()[0]["item_id"] == 873

    detail = client.get("/items/873")
    assert detail.status_code == 200
    assert detail.json()["item_id"] == 873
    assert detail.json()["metadata_status"] in {"cached", "missing", "live"}

    live_listings = client.get("/items/873/live-listings")
    assert live_listings.status_code == 200
    assert live_listings.json()["status"] == "unavailable"

    refresh_missing = client.post("/items/refresh-missing-metadata")
    assert refresh_missing.status_code == 200
    assert "queued_count" in refresh_missing.json()


def test_tuning_preset_cooldown_and_audit_history(client) -> None:
    first_apply = client.post("/settings/apply-tuning-preset", json={"preset_id": "safe_calibration"})
    assert first_apply.status_code == 200
    assert first_apply.json()["scoring_preset"] == "safe"

    second_apply = client.post("/settings/apply-tuning-preset", json={"preset_id": "balanced_default"})
    assert second_apply.status_code == 429
    assert "cooldown" in second_apply.json()["detail"].lower()

    audit = client.get("/settings/tuning-audit")
    assert audit.status_code == 200
    entries = audit.json()["entries"]
    assert len(entries) >= 2
    assert entries[0]["blocked"] is True
    assert entries[1]["blocked"] is False


def test_duplicate_import_rows_are_skipped_gracefully(client) -> None:
    client.post("/realms", json={"realm_name": "Stormrage", "region": "us", "enabled": True})
    payload = b"item_id,realm,lowest_price,average_price,quantity,listing_count,captured_at\n873,Stormrage,15000,15500,2,2,2026-04-06T02:45:00+00:00\n"

    first = client.post(
        "/imports/listings",
        data={"commit": "true"},
        files={"file": ("listings.csv", payload, "text/csv")},
    )
    assert first.status_code == 200
    assert first.json()["inserted_count"] == 1

    second = client.post(
        "/imports/listings",
        data={"commit": "true"},
        files={"file": ("listings.csv", payload, "text/csv")},
    )
    assert second.status_code == 200
    assert second.json()["inserted_count"] == 0
    assert second.json()["skipped_duplicates"] == 1


def test_listing_snapshot_indexes_exist(client) -> None:
    with get_engine().connect() as connection:
        rows = connection.execute(text("PRAGMA index_list('listing_snapshots')")).mappings().all()

    index_names = {row["name"] for row in rows}
    assert {
        "ix_listing_snapshots_item_realm_captured",
        "ix_listing_snapshots_realm_item_captured",
        "ix_listing_snapshots_source_realm_captured",
        "ux_listing_snapshots_exact",
    }.issubset(index_names)


def test_sqlite_runtime_pragmas_favor_local_concurrency(client) -> None:
    with get_engine().connect() as connection:
        journal_mode = connection.execute(text("PRAGMA journal_mode")).scalar()
        busy_timeout = connection.execute(text("PRAGMA busy_timeout")).scalar()

    assert str(journal_mode).lower() == "wal"
    assert int(busy_timeout) == 30000
