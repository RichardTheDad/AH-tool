from __future__ import annotations


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
    assert set(names) == {"file_import", "saddlebag_public", "saddlebag_public_metadata"}


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
