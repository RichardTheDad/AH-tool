from __future__ import annotations

from datetime import datetime, timezone

import app.services.scan_service as scan_service_module

from app.db.models import Item, ListingSnapshot
from app.db.session import get_session_factory
from app.services.provider_service import get_provider_registry
from app.schemas.listing import ListingImportRow


_SNAPSHOTS_3_REALM = [
    {"item_id": 873, "realm": "Area 52",   "lowest_price": 12900, "average_price": 13400, "quantity": 6, "listing_count": 5, "captured_at": "2026-04-06T02:45:00+00:00"},
    {"item_id": 873, "realm": "Stormrage", "lowest_price": 14500, "average_price": 15000, "quantity": 7, "listing_count": 4, "captured_at": "2026-04-06T02:45:00+00:00"},
    {"item_id": 873, "realm": "Zul'jin",   "lowest_price": 23900, "average_price": 24550, "quantity": 5, "listing_count": 4, "captured_at": "2026-04-06T02:50:00+00:00"},
]


def _insert_snapshots(rows: list[dict], item_meta: dict[int, dict] | None = None) -> None:
    session = get_session_factory()()
    try:
        seen_item_ids: set[int] = set()
        for row in rows:
            captured = datetime.fromisoformat(row["captured_at"]).replace(tzinfo=timezone.utc)
            item_id = row["item_id"]
            if item_id not in seen_item_ids and session.get(Item, item_id) is None:
                meta = (item_meta or {}).get(item_id)
                session.add(Item(item_id=item_id, name=f"Test Item {item_id}", metadata_json=meta))
                session.flush()
            seen_item_ids.add(item_id)
            session.add(
                ListingSnapshot(
                    item_id=item_id,
                    realm=row["realm"],
                    lowest_price=row["lowest_price"],
                    average_price=row["average_price"],
                    quantity=row["quantity"],
                    listing_count=row["listing_count"],
                    source_name="blizzard_auctions",
                    captured_at=captured,
                )
            )
        session.commit()
    finally:
        session.close()


def seed_listing_data(client) -> None:
    for realm_name in ["Area 52", "Stormrage", "Zul'jin"]:
        response = client.post("/realms", json={"realm_name": realm_name, "region": "us", "enabled": True})
        assert response.status_code == 201
    _insert_snapshots(_SNAPSHOTS_3_REALM)


def test_scan_selects_best_buy_and_sell_realms(client) -> None:
    seed_listing_data(client)

    response = client.post("/scans/run", json={"refresh_live": False, "include_losers": False})
    assert response.status_code == 200

    payload = response.json()
    assert payload["result_count"] > 0

    staff = next(result for result in payload["results"] if result["item_id"] == 873)
    assert staff["cheapest_buy_realm"] == "Area 52"
    assert staff["best_sell_realm"] == "Zul'jin"
    assert staff["observed_sell_price"] == 23900.0
    assert staff["estimated_profit"] > 0
    assert staff["sell_history_prices"] == [23900.0]


def test_scan_includes_spread_metrics(client) -> None:
    seed_listing_data(client)

    response = client.post("/scans/run", json={"refresh_live": False, "include_losers": False})
    assert response.status_code == 200

    staff = next(result for result in response.json()["results"] if result["item_id"] == 873)
    assert "spread_percent" in staff
    assert "observed_spread_percent" in staff
    assert staff["spread_percent"] > 0
    assert staff["observed_spread_percent"] > 0


def test_scan_honors_buy_and_sell_realm_scope(client) -> None:
    seed_listing_data(client)

    response = client.post(
        "/scans/run",
        json={
            "refresh_live": False,
            "include_losers": False,
            "buy_realms": ["Stormrage"],
            "sell_realms": ["Zul'jin"],
        },
    )
    assert response.status_code == 200

    staff = next(result for result in response.json()["results"] if result["item_id"] == 873)
    assert staff["cheapest_buy_realm"] == "Stormrage"
    assert staff["best_sell_realm"] == "Zul'jin"


def test_scan_uses_preset_realm_scope_when_preset_id_is_provided(client) -> None:
    seed_listing_data(client)

    create_preset = client.post(
        "/presets",
        json={
            "name": "Scoped preset",
            "min_profit": None,
            "min_roi": None,
            "max_buy_price": None,
            "min_confidence": None,
            "allow_stale": False,
            "hide_risky": False,
            "category_filter": None,
            "buy_realms": ["Stormrage"],
            "sell_realms": ["Zul'jin"],
        },
    )
    assert create_preset.status_code == 201
    preset_id = create_preset.json()["id"]

    response = client.post(
        "/scans/run",
        json={
            "preset_id": preset_id,
            "refresh_live": False,
            "include_losers": False,
        },
    )
    assert response.status_code == 200

    staff = next(result for result in response.json()["results"] if result["item_id"] == 873)
    assert staff["cheapest_buy_realm"] == "Stormrage"
    assert staff["best_sell_realm"] == "Zul'jin"


def test_scan_returns_no_results_when_only_one_realm_has_data(client) -> None:
    response = client.post("/realms", json={"realm_name": "Stormrage", "region": "us", "enabled": True})
    assert response.status_code == 201

    _insert_snapshots([
        {"item_id": 873, "realm": "Stormrage", "lowest_price": 15000, "average_price": 15500, "quantity": 2, "listing_count": 2, "captured_at": "2026-04-06T02:45:00+00:00"},
    ])

    scan = client.post("/scans/run", json={"refresh_live": False, "include_losers": False})
    assert scan.status_code == 200
    assert scan.json()["result_count"] == 0


def test_scan_warns_when_live_provider_unavailable(client) -> None:
    seed_listing_data(client)

    response = client.post("/scans/run", json={"refresh_live": True, "include_losers": False})
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

    response = client.post("/scans/run", json={"refresh_live": True, "include_losers": False})
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

    response = client.post("/scans/run", json={"refresh_live": True, "include_losers": False})

    assert response.status_code == 200
    assert response.json()["result_count"] > 0
    assert queued == [[873]]
    assert "Queued live Blizzard item-detail refresh for 1 scanned items" in (response.json()["warning_text"] or "")


def test_latest_scan_includes_recent_sell_history_for_chosen_sell_realm(client) -> None:
    for realm_name in ["Area 52", "Stormrage", "Zul'jin"]:
        response = client.post("/realms", json={"realm_name": realm_name, "region": "us", "enabled": True})
        assert response.status_code == 201

    _insert_snapshots([
        {"item_id": 873, "realm": "Area 52",   "lowest_price": 12900, "average_price": 13400, "quantity": 6, "listing_count": 5, "captured_at": "2026-04-06T02:45:00+00:00"},
        {"item_id": 873, "realm": "Stormrage", "lowest_price": 14500, "average_price": 15000, "quantity": 7, "listing_count": 4, "captured_at": "2026-04-06T02:45:00+00:00"},
        {"item_id": 873, "realm": "Zul'jin",   "lowest_price": 23900, "average_price": 24550, "quantity": 5, "listing_count": 4, "captured_at": "2026-04-06T02:50:00+00:00"},
        {"item_id": 873, "realm": "Zul'jin",   "lowest_price": 23000, "average_price": 24000, "quantity": 5, "listing_count": 4, "captured_at": "2026-04-06T01:50:00+00:00"},
        {"item_id": 873, "realm": "Zul'jin",   "lowest_price": 22000, "average_price": 23500, "quantity": 5, "listing_count": 4, "captured_at": "2026-04-06T00:50:00+00:00"},
    ])

    scan = client.post("/scans/run", json={"refresh_live": False, "include_losers": False})
    assert scan.status_code == 200

    latest = client.get("/scans/latest")
    assert latest.status_code == 200
    result = next(row for row in latest.json()["latest"]["results"] if row["item_id"] == 873)
    assert result["best_sell_realm"] == "Zul'jin"
    assert result["sell_history_prices"] == [23900.0, 23000.0, 22000.0]


def test_scan_warns_when_enabled_realms_have_no_listing_data(client) -> None:
    response = client.post("/realms", json={"realm_name": "Stormrage", "region": "us", "enabled": True})
    assert response.status_code == 201

    scan = client.post("/scans/run", json={"refresh_live": False, "include_losers": False})
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

    _insert_snapshots([
        {"item_id": 873, "realm": "Stormrage", "lowest_price": 15000, "average_price": 15500, "quantity": 2, "listing_count": 2, "captured_at": "2026-04-06T02:45:00+00:00"},
    ])

    readiness = client.get("/scans/readiness")
    assert readiness.status_code == 200
    assert readiness.json()["status"] == "blocked"
    assert readiness.json()["realms_with_data"] == 1


def test_scan_filters_commodities_by_default(client) -> None:
    seed_listing_data(client)

    session = get_session_factory()()
    try:
        item = session.get(Item, 873)
        assert item is not None
        item.is_commodity = True
        session.commit()
    finally:
        session.close()

    response = client.post("/scans/run", json={"refresh_live": False, "include_losers": False})
    assert response.status_code == 200
    assert response.json()["result_count"] == 0


def test_scan_excludes_items_with_missing_metadata_from_non_commodity_mode(client) -> None:
    get_provider_registry().metadata_provider.settings.blizzard_client_id = "client-id"
    get_provider_registry().metadata_provider.settings.blizzard_client_secret = "client-secret"
    for realm_name in ["Area 52", "Stormrage", "Zul'jin"]:
        response = client.post("/realms", json={"realm_name": realm_name, "region": "us", "enabled": True})
        assert response.status_code == 201

    _insert_snapshots([
        {"item_id": 999001, "realm": "Area 52",   "lowest_price": 12900, "average_price": 13400, "quantity": 6, "listing_count": 5, "captured_at": "2026-04-06T02:45:00+00:00"},
        {"item_id": 999001, "realm": "Stormrage", "lowest_price": 14500, "average_price": 15000, "quantity": 7, "listing_count": 4, "captured_at": "2026-04-06T02:45:00+00:00"},
        {"item_id": 999001, "realm": "Zul'jin",   "lowest_price": 23900, "average_price": 24550, "quantity": 5, "listing_count": 4, "captured_at": "2026-04-06T02:50:00+00:00"},
    ], item_meta={999001: {"metadata_status": "missing"}})

    scan = client.post("/scans/run", json={"refresh_live": False, "include_losers": False})
    assert scan.status_code == 200
    assert scan.json()["result_count"] == 0
    assert "incomplete item details" in (scan.json()["warning_text"] or "").lower()


def test_health_and_realms_smoke_flow(client) -> None:
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    create = client.post("/realms", json={"realm_name": "Mal'Ganis", "region": "us", "enabled": True})
    assert create.status_code == 201

    duplicate = client.post("/realms", json={"realm_name": "Mal'Ganis", "region": "us", "enabled": True})
    assert duplicate.status_code == 400


def test_scan_history_returns_recent_summaries(client) -> None:
    seed_listing_data(client)

    response = client.post("/scans/run", json={"refresh_live": False, "include_losers": False})
    assert response.status_code == 200

    history = client.get("/scans/history")
    assert history.status_code == 200
    payload = history.json()
    assert payload["scans"]
    assert payload["scans"][0]["provider_name"] == "blizzard_auctions"
    assert payload["scans"][0]["result_count"] >= 0
