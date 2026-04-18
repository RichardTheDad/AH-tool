from __future__ import annotations

from datetime import datetime, timezone

import app.services.scan_service as scan_service_module
import app.api.scans as scans_api

from app.core.auth import get_optional_user
from app.db.models import Item, ListingSnapshot, TrackedRealm
from app.db.session import get_session_factory
from app.core.config import SYSTEM_USER_ID
from app.schemas.scan import ScanRunRequest
from app.services.provider_service import get_provider_registry
from app.schemas.listing import ListingImportRow
from app.tests.conftest import TEST_USER_ID


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


def run_scan(payload: dict | None = None, user_id: str = TEST_USER_ID, realms: list[str] | None = None) -> dict:
    session = get_session_factory()()
    try:
        scan = scan_service_module.run_user_scan(
            session,
            user_id=user_id,
            payload=ScanRunRequest(**(payload or {"refresh_live": False, "include_losers": False})),
            realms=realms,
        )
        return scan.model_dump(mode="json")
    finally:
        session.close()


def test_scan_selects_best_buy_and_sell_realms(client) -> None:
    seed_listing_data(client)

    payload = run_scan()
    assert payload["result_count"] > 0

    staff = next(result for result in payload["results"] if result["item_id"] == 873)
    assert staff["cheapest_buy_realm"] == "Area 52"
    assert staff["best_sell_realm"] == "Zul'jin"
    assert staff["observed_sell_price"] == 23900.0
    assert staff["estimated_profit"] > 0
    assert staff["sell_history_prices"] == [23900.0]


def test_scan_includes_spread_metrics(client) -> None:
    seed_listing_data(client)

    staff = next(result for result in run_scan()["results"] if result["item_id"] == 873)
    assert "spread_percent" in staff
    assert "spread_absolute" in staff
    assert "observed_spread_percent" in staff
    assert "observed_spread_absolute" in staff
    assert "sale_average_spread_percent" in staff
    assert "sale_average_spread_absolute" in staff
    assert staff["spread_percent"] > 0
    assert staff["observed_spread_percent"] > 0


def test_scan_honors_buy_and_sell_realm_scope(client) -> None:
    seed_listing_data(client)

    payload = run_scan(
        {
            "refresh_live": False,
            "include_losers": False,
            "buy_realms": ["Stormrage"],
            "sell_realms": ["Zul'jin"],
        }
    )

    staff = next(result for result in payload["results"] if result["item_id"] == 873)
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

    payload = run_scan(
        {
            "preset_id": preset_id,
            "refresh_live": False,
            "include_losers": False,
        }
    )

    staff = next(result for result in payload["results"] if result["item_id"] == 873)
    assert staff["cheapest_buy_realm"] == "Stormrage"
    assert staff["best_sell_realm"] == "Zul'jin"


def test_scan_payload_realms_override_preset_scope(client) -> None:
    seed_listing_data(client)

    create_preset = client.post(
        "/presets",
        json={
            "name": "Override preset",
            "min_profit": None,
            "min_roi": None,
            "max_buy_price": None,
            "min_confidence": None,
            "allow_stale": False,
            "hide_risky": False,
            "category_filter": None,
            "buy_realms": ["Area 52"],
            "sell_realms": ["Zul'jin"],
        },
    )
    assert create_preset.status_code == 201
    preset_id = create_preset.json()["id"]

    payload = run_scan(
        {
            "preset_id": preset_id,
            "refresh_live": False,
            "include_losers": False,
            "buy_realms": ["Stormrage"],
            "sell_realms": ["Zul'jin"],
        }
    )

    staff = next(result for result in payload["results"] if result["item_id"] == 873)
    assert staff["cheapest_buy_realm"] == "Stormrage"
    assert staff["best_sell_realm"] == "Zul'jin"


def test_scan_returns_no_results_when_only_one_realm_has_data(client) -> None:
    response = client.post("/realms", json={"realm_name": "Stormrage", "region": "us", "enabled": True})
    assert response.status_code == 201

    _insert_snapshots([
        {"item_id": 873, "realm": "Stormrage", "lowest_price": 15000, "average_price": 15500, "quantity": 2, "listing_count": 2, "captured_at": "2026-04-06T02:45:00+00:00"},
    ])

    payload = run_scan({"refresh_live": False, "include_losers": False})
    assert payload["result_count"] == 0


def test_scan_warns_when_live_provider_unavailable(client) -> None:
    seed_listing_data(client)

    payload = run_scan({"refresh_live": True, "include_losers": False})
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

    payload = run_scan({"refresh_live": True, "include_losers": False})
    assert payload["result_count"] > 0


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

    payload = run_scan({"refresh_live": True, "include_losers": False})

    assert payload["result_count"] > 0
    assert queued == [[873]]
    assert "Queued live Blizzard item-detail refresh for 1 scanned items" in (payload["warning_text"] or "")


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

    run_scan({"refresh_live": False, "include_losers": False}, user_id=SYSTEM_USER_ID, realms=["Area 52", "Stormrage", "Zul'jin"])

    latest = client.get("/scans/latest")
    assert latest.status_code == 200
    result = next(row for row in latest.json()["latest"]["results"] if row["item_id"] == 873)
    assert result["best_sell_realm"] == "Zul'jin"
    assert result["sell_history_prices"] == [23900.0, 23000.0, 22000.0]


def test_scan_warns_when_enabled_realms_have_no_listing_data(client) -> None:
    response = client.post("/realms", json={"realm_name": "Stormrage", "region": "us", "enabled": True})
    assert response.status_code == 201

    payload = run_scan({"refresh_live": False, "include_losers": False})
    assert payload["result_count"] == 0
    assert "No listing data found for enabled realms" in payload["warning_text"]


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


def test_scan_readiness_scopes_realms_to_authenticated_user(client) -> None:
    client.app.dependency_overrides[get_optional_user] = lambda: TEST_USER_ID
    session = get_session_factory()()
    try:
        session.add_all(
            [
                TrackedRealm(user_id=TEST_USER_ID, realm_name="Area 52", region="us", enabled=True),
                TrackedRealm(user_id=TEST_USER_ID, realm_name="Stormrage", region="us", enabled=True),
                TrackedRealm(user_id="other-user", realm_name="Illidan", region="us", enabled=True),
            ]
        )
        session.commit()
    finally:
        session.close()

    _insert_snapshots([
        {"item_id": 873, "realm": "Area 52", "lowest_price": 12900, "average_price": 13400, "quantity": 6, "listing_count": 5, "captured_at": "2026-04-06T02:45:00+00:00"},
        {"item_id": 873, "realm": "Stormrage", "lowest_price": 14500, "average_price": 15000, "quantity": 7, "listing_count": 4, "captured_at": "2026-04-06T02:45:00+00:00"},
        {"item_id": 873, "realm": "Illidan", "lowest_price": 23900, "average_price": 24550, "quantity": 5, "listing_count": 4, "captured_at": "2026-04-06T02:50:00+00:00"},
    ])

    readiness = client.get("/scans/readiness")

    client.app.dependency_overrides.pop(get_optional_user, None)

    assert readiness.status_code == 200
    readiness_realms = {row["realm"] for row in readiness.json()["realms"]}
    assert readiness_realms == {"Area 52", "Stormrage"}


def test_scan_readiness_cache_key_is_user_scoped(client, monkeypatch) -> None:
    captured_keys: list[str] = []

    def _capture_key(key: str, ttl_seconds: float, loader):
        captured_keys.append(key)
        return loader()

    monkeypatch.setattr(scans_api, "_read_through_cache", _capture_key)
    client.app.dependency_overrides[get_optional_user] = lambda: TEST_USER_ID

    response = client.get("/scans/readiness")

    client.app.dependency_overrides.pop(get_optional_user, None)

    assert response.status_code == 200
    assert captured_keys
    assert captured_keys[0] == f"scans.readiness:{TEST_USER_ID}"


def test_scan_status_exposes_diagnostic_scope_and_realm_counts(client) -> None:
    seed_listing_data(client)
    run_scan(
        {"refresh_live": False, "include_losers": False},
        user_id=SYSTEM_USER_ID,
        realms=["Area 52", "Stormrage", "Zul'jin"],
    )

    response = client.get("/scans/status?buy_realm=__tracked_realms__&sell_realm=__tracked_realms__")

    assert response.status_code == 200
    payload = response.json()
    assert payload["diagnostic_active_scope"] == "tracked_realms"
    assert payload["diagnostic_latest_scan_id"] is not None
    assert payload["diagnostic_latest_scan_result_count"] >= 0
    assert payload["diagnostic_latest_buy_realm_count"] >= 1
    assert payload["diagnostic_latest_sell_realm_count"] >= 1
    assert payload["diagnostic_tracked_realm_count"] >= 1


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

    payload = run_scan({"refresh_live": False, "include_losers": False})
    assert payload["result_count"] == 0


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

    payload = run_scan({"refresh_live": False, "include_losers": False})
    assert payload["result_count"] == 0
    assert "incomplete item details" in (payload["warning_text"] or "").lower()


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

    run_scan({"refresh_live": False, "include_losers": False}, user_id=SYSTEM_USER_ID, realms=["Area 52", "Stormrage", "Zul'jin"])

    history = client.get("/scans/history")
    assert history.status_code == 200
    payload = history.json()
    assert payload["scans"]
    assert payload["scans"][0]["provider_name"] == "blizzard_auctions"
    assert payload["scans"][0]["result_count"] >= 0
