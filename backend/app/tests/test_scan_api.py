from __future__ import annotations


def seed_listing_import_data(client) -> None:
    for realm_name in ["Area 52", "Stormrage", "Zul'jin"]:
        response = client.post("/realms", json={"realm_name": realm_name, "region": "us", "enabled": True})
        assert response.status_code == 201

    payload = "\n".join(
        [
            "item_id,realm,lowest_price,average_price,quantity,listing_count,captured_at",
            "873,Area 52,12900,13400,6,5,2026-04-06T02:45:00+00:00",
            "873,Stormrage,14500,15000,7,4,2026-04-06T02:45:00+00:00",
            "873,Zul'jin,23900,24550,5,4,2026-04-06T02:50:00+00:00",
        ]
    ).encode("utf-8")
    response = client.post(
        "/imports/listings",
        data={"commit": "true"},
        files={"file": ("listings.csv", payload, "text/csv")},
    )
    assert response.status_code == 200
    assert response.json()["inserted_count"] == 3


def test_scan_selects_best_buy_and_sell_realms(client) -> None:
    seed_listing_import_data(client)

    response = client.post("/scans/run", json={"provider_name": "file_import", "refresh_live": False, "include_losers": False})
    assert response.status_code == 200

    payload = response.json()
    assert payload["result_count"] > 0

    staff = next(result for result in payload["results"] if result["item_id"] == 873)
    assert staff["cheapest_buy_realm"] == "Area 52"
    assert staff["best_sell_realm"] == "Zul'jin"
    assert staff["estimated_profit"] > 0


def test_scan_returns_no_results_when_only_one_realm_has_data(client) -> None:
    response = client.post("/realms", json={"realm_name": "Stormrage", "region": "us", "enabled": True})
    assert response.status_code == 201

    payload = b"item_id,realm,lowest_price,average_price,quantity,listing_count,captured_at\n873,Stormrage,15000,15500,2,2,2026-04-06T02:45:00+00:00\n"
    imported = client.post(
        "/imports/listings",
        data={"commit": "true"},
        files={"file": ("listings.csv", payload, "text/csv")},
    )
    assert imported.status_code == 200

    scan = client.post("/scans/run", json={"provider_name": "file_import", "refresh_live": False, "include_losers": False})
    assert scan.status_code == 200
    assert scan.json()["result_count"] == 0


def test_health_and_realms_smoke_flow(client) -> None:
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    create = client.post("/realms", json={"realm_name": "Mal'Ganis", "region": "us", "enabled": True})
    assert create.status_code == 201

    duplicate = client.post("/realms", json={"realm_name": "Mal'Ganis", "region": "us", "enabled": True})
    assert duplicate.status_code == 400
