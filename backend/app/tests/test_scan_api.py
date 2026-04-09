from __future__ import annotations

import app.services.scan_service as scan_service_module

from app.db.models import Item
from app.db.session import get_session_factory
from app.services.provider_service import get_provider_registry
from app.schemas.listing import ListingImportRow


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
    assert staff["observed_sell_price"] == 23900.0
    assert staff["estimated_profit"] > 0
    assert staff["sell_history_prices"] == [23900.0]


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


def test_scan_uses_imported_data_when_live_provider_is_unavailable(client) -> None:
    seed_listing_import_data(client)

    response = client.post("/scans/run", json={"provider_name": "blizzard_auctions", "refresh_live": True, "include_losers": False})
    assert response.status_code == 200

    payload = response.json()
    assert payload["result_count"] > 0
    assert payload["warning_text"] is not None
    assert "No Blizzard Battle.net client credentials are configured." in payload["warning_text"]


def test_scan_bootstraps_from_blizzard_provider_when_available(client, monkeypatch) -> None:
    for realm_name in ["Area 52", "Stormrage", "Zul'jin"]:
        response = client.post("/realms", json={"realm_name": realm_name, "region": "us", "enabled": True})
        assert response.status_code == 201

    provider = get_provider_registry().listing_providers["blizzard_auctions"]

    monkeypatch.setattr(provider, "is_available", lambda: (True, "Configured for live Blizzard Retail Auction House refreshes."))
    monkeypatch.setattr(
        provider,
        "fetch_listings",
        lambda realms: [
            ListingImportRow(item_id=873, realm="Area 52", lowest_price=12900, average_price=13400, quantity=6, listing_count=5, captured_at="2026-04-06T02:45:00+00:00"),
            ListingImportRow(item_id=873, realm="Stormrage", lowest_price=14500, average_price=15000, quantity=7, listing_count=4, captured_at="2026-04-06T02:45:00+00:00"),
            ListingImportRow(item_id=873, realm="Zul'jin", lowest_price=23900, average_price=24550, quantity=5, listing_count=4, captured_at="2026-04-06T02:50:00+00:00"),
        ],
    )

    response = client.post("/scans/run", json={"provider_name": "blizzard_auctions", "refresh_live": True, "include_losers": False})
    assert response.status_code == 200
    assert response.json()["result_count"] > 0


def test_scan_queues_background_metadata_refresh_for_blizzard_results(client, monkeypatch) -> None:
    for realm_name in ["Area 52", "Stormrage", "Zul'jin"]:
        response = client.post("/realms", json={"realm_name": realm_name, "region": "us", "enabled": True})
        assert response.status_code == 201

    registry = get_provider_registry()
    provider = registry.listing_providers["blizzard_auctions"]
    registry.metadata_provider.settings.blizzard_client_id = "client-id"
    registry.metadata_provider.settings.blizzard_client_secret = "client-secret"

    monkeypatch.setattr(provider, "is_available", lambda: (True, "Configured for live Blizzard Retail Auction House refreshes."))
    monkeypatch.setattr(
        provider,
        "fetch_listings",
        lambda realms: [
            ListingImportRow(item_id=873, realm="Area 52", lowest_price=12900, average_price=13400, quantity=6, listing_count=5, captured_at="2026-04-06T02:45:00+00:00"),
            ListingImportRow(item_id=873, realm="Stormrage", lowest_price=14500, average_price=15000, quantity=7, listing_count=4, captured_at="2026-04-06T02:45:00+00:00"),
            ListingImportRow(item_id=873, realm="Zul'jin", lowest_price=23900, average_price=24550, quantity=5, listing_count=4, captured_at="2026-04-06T02:50:00+00:00"),
        ],
    )

    queued: list[list[int]] = []
    monkeypatch.setattr(scan_service_module, "queue_missing_metadata_refresh", lambda item_ids: queued.append(list(item_ids)) or len(item_ids))

    response = client.post("/scans/run", json={"provider_name": "blizzard_auctions", "refresh_live": True, "include_losers": False})

    assert response.status_code == 200
    assert response.json()["result_count"] > 0
    assert queued == [[873]]
    assert "Queued live Blizzard metadata refresh for 1 scanned items." in (response.json()["warning_text"] or "")


def test_latest_scan_includes_recent_sell_history_for_chosen_sell_realm(client) -> None:
    for realm_name in ["Area 52", "Stormrage", "Zul'jin"]:
        response = client.post("/realms", json={"realm_name": realm_name, "region": "us", "enabled": True})
        assert response.status_code == 201

    payload = "\n".join(
        [
            "item_id,realm,lowest_price,average_price,quantity,listing_count,captured_at",
            "873,Area 52,12900,13400,6,5,2026-04-06T02:45:00+00:00",
            "873,Stormrage,14500,15000,7,4,2026-04-06T02:45:00+00:00",
            "873,Zul'jin,23900,24550,5,4,2026-04-06T02:50:00+00:00",
            "873,Zul'jin,23000,24000,5,4,2026-04-06T01:50:00+00:00",
            "873,Zul'jin,22000,23500,5,4,2026-04-06T00:50:00+00:00",
        ]
    ).encode("utf-8")
    response = client.post(
        "/imports/listings",
        data={"commit": "true"},
        files={"file": ("listings.csv", payload, "text/csv")},
    )
    assert response.status_code == 200

    scan = client.post("/scans/run", json={"provider_name": "file_import", "refresh_live": False, "include_losers": False})
    assert scan.status_code == 200

    latest = client.get("/scans/latest")
    assert latest.status_code == 200
    result = next(row for row in latest.json()["latest"]["results"] if row["item_id"] == 873)
    assert result["best_sell_realm"] == "Zul'jin"
    assert result["sell_history_prices"] == [23900.0, 23000.0, 22000.0]


def test_scan_warns_when_enabled_realms_have_no_listing_data(client) -> None:
    response = client.post("/realms", json={"realm_name": "Stormrage", "region": "us", "enabled": True})
    assert response.status_code == 201

    scan = client.post("/scans/run", json={"provider_name": "file_import", "refresh_live": False, "include_losers": False})
    assert scan.status_code == 200
    assert scan.json()["result_count"] == 0
    assert "No listing data found for enabled realms" in scan.json()["warning_text"]


def test_scan_readiness_reports_blocked_until_two_realms_have_listing_data(client) -> None:
    client.post("/realms", json={"realm_name": "Stormrage", "region": "us", "enabled": True})
    client.post("/realms", json={"realm_name": "Zul'jin", "region": "us", "enabled": True})

    readiness = client.get("/scans/readiness")
    assert readiness.status_code == 200
    assert readiness.json()["status"] == "blocked"
    assert readiness.json()["ready_for_scan"] is False

    payload = b"item_id,realm,lowest_price,average_price,quantity,listing_count,captured_at\n873,Stormrage,15000,15500,2,2,2026-04-06T02:45:00+00:00\n"
    client.post(
        "/imports/listings",
        data={"commit": "true"},
        files={"file": ("listings.csv", payload, "text/csv")},
    )

    readiness = client.get("/scans/readiness")
    assert readiness.status_code == 200
    assert readiness.json()["status"] == "blocked"
    assert readiness.json()["realms_with_data"] == 1


def test_scan_filters_commodities_by_default(client) -> None:
    seed_listing_import_data(client)

    session = get_session_factory()()
    try:
        item = session.get(Item, 873)
        assert item is not None
        item.is_commodity = True
        session.commit()
    finally:
        session.close()

    response = client.post("/scans/run", json={"provider_name": "file_import", "refresh_live": False, "include_losers": False})
    assert response.status_code == 200
    assert response.json()["result_count"] == 0


def test_scan_excludes_items_with_missing_metadata_from_non_commodity_mode(client) -> None:
    get_provider_registry().metadata_provider.settings.blizzard_client_id = "client-id"
    get_provider_registry().metadata_provider.settings.blizzard_client_secret = "client-secret"
    for realm_name in ["Area 52", "Stormrage", "Zul'jin"]:
        response = client.post("/realms", json={"realm_name": realm_name, "region": "us", "enabled": True})
        assert response.status_code == 201

    payload = "\n".join(
        [
            "item_id,realm,lowest_price,average_price,quantity,listing_count,captured_at",
            "999001,Area 52,12900,13400,6,5,2026-04-06T02:45:00+00:00",
            "999001,Stormrage,14500,15000,7,4,2026-04-06T02:45:00+00:00",
            "999001,Zul'jin,23900,24550,5,4,2026-04-06T02:50:00+00:00",
        ]
    ).encode("utf-8")
    response = client.post(
        "/imports/listings",
        data={"commit": "true"},
        files={"file": ("listings.csv", payload, "text/csv")},
    )
    assert response.status_code == 200

    scan = client.post("/scans/run", json={"provider_name": "file_import", "refresh_live": False, "include_losers": False})
    assert scan.status_code == 200
    assert scan.json()["result_count"] == 0
    assert "missing metadata" in (scan.json()["warning_text"] or "").lower()


def test_health_and_realms_smoke_flow(client) -> None:
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    create = client.post("/realms", json={"realm_name": "Mal'Ganis", "region": "us", "enabled": True})
    assert create.status_code == 201

    duplicate = client.post("/realms", json={"realm_name": "Mal'Ganis", "region": "us", "enabled": True})
    assert duplicate.status_code == 400


def test_scan_history_returns_recent_summaries(client) -> None:
    seed_listing_import_data(client)

    response = client.post("/scans/run", json={"provider_name": "file_import", "refresh_live": False, "include_losers": False})
    assert response.status_code == 200

    history = client.get("/scans/history")
    assert history.status_code == 200
    payload = history.json()
    assert payload["scans"]
    assert payload["scans"][0]["provider_name"] == "file_import"
    assert payload["scans"][0]["result_count"] >= 0
