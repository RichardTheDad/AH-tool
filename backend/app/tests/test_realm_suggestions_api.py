from __future__ import annotations

from datetime import datetime, timezone

import app.services.realm_suggestion_service as realm_suggestion_module

from app.db.models import Item
from app.db.session import get_session_factory
from app.schemas.listing import ListingImportRow
from app.services.provider_service import get_provider_registry


def _create_tracked_realm(client, realm_name: str) -> None:
    response = client.post("/realms", json={"realm_name": realm_name, "region": "us", "enabled": True})
    assert response.status_code == 201


def _seed_item(item_id: int, *, name: str = "Test Item") -> None:
    session = get_session_factory()()
    try:
        session.add(
            Item(
                item_id=item_id,
                name=name,
                is_commodity=False,
                metadata_json={"metadata_status": "ready", "non_commodity_verified": True},
            )
        )
        session.commit()
    finally:
        session.close()


def test_realm_suggestions_require_enabled_targets(client) -> None:
    response = client.post("/realm-suggestions/run")

    assert response.status_code == 200
    payload = response.json()
    assert payload["recommendations"] == []
    assert "Add at least one enabled target realm" in payload["warning_text"]


def test_realm_suggestions_surface_provider_unavailable_message(client) -> None:
    _create_tracked_realm(client, "Stormrage")

    response = client.post("/realm-suggestions/run")

    assert response.status_code == 200
    payload = response.json()
    assert payload["recommendations"] == []
    assert payload["warning_text"] == "No Blizzard Battle.net client credentials are configured."


def test_realm_suggestions_rotate_batches_and_track_recent_appearances(client, monkeypatch) -> None:
    _create_tracked_realm(client, "Stormrage")
    _create_tracked_realm(client, "Zul'jin")
    _seed_item(1001)

    provider = get_provider_registry().listing_providers["blizzard_auctions"]
    monkeypatch.setattr(provider, "is_available", lambda: (True, "Configured for live Blizzard Retail Auction House refreshes."))
    monkeypatch.setattr(realm_suggestion_module, "DISCOVERY_BATCH_SIZE", 2)

    available_realms = ["Area 52", "Illidan", "Mal'Ganis"]
    monkeypatch.setattr(provider, "list_available_realms", lambda: available_realms)

    def fake_fetch_listings(realms: list[str]) -> list[ListingImportRow]:
        captured_at = datetime(2026, 4, 9, 12, 0, tzinfo=timezone.utc)
        rows = [
            ListingImportRow(
                item_id=1001,
                realm="Stormrage",
                lowest_price=50000,
                average_price=51000,
                quantity=5,
                listing_count=3,
                captured_at=captured_at,
            ),
            ListingImportRow(
                item_id=1001,
                realm="Zul'jin",
                lowest_price=65000,
                average_price=66000,
                quantity=4,
                listing_count=2,
                captured_at=captured_at,
            ),
        ]
        source_prices = {
            "Area 52": 12000,
            "Illidan": 18000,
            "Mal'Ganis": 24000,
        }
        for realm in realms:
            if realm in source_prices:
                rows.append(
                    ListingImportRow(
                        item_id=1001,
                        realm=realm,
                        lowest_price=source_prices[realm],
                        average_price=source_prices[realm] + 500,
                        quantity=4,
                        listing_count=2,
                        captured_at=captured_at,
                    )
                )
        return rows

    monkeypatch.setattr(provider, "fetch_listings", fake_fetch_listings)

    first = client.post("/realm-suggestions/run")
    assert first.status_code == 200
    first_payload = first.json()
    assert first_payload["source_realm_count"] == 2
    assert [row["realm"] for row in first_payload["recommendations"]] == ["Area 52", "Illidan"]

    second = client.post("/realm-suggestions/run")
    assert second.status_code == 200
    second_payload = second.json()
    realms = {row["realm"]: row for row in second_payload["recommendations"]}
    assert set(realms) == {"Area 52", "Mal'Ganis"}
    assert realms["Area 52"]["appearance_count"] == 2
    assert realms["Area 52"]["cheap_run_count"] == 2
    assert realms["Area 52"]["window_size"] == 2
    assert realms["Area 52"]["recent_run_count"] == 2
    assert realms["Area 52"]["median_buy_price"] == 12000
    assert realms["Area 52"]["best_target_realm"] == "Zul'jin"
    assert realms["Area 52"]["last_seen_cheapest_at"] is not None
    assert realms["Area 52"]["is_tracked"] is False
    assert realms["Mal'Ganis"]["appearance_count"] == 1
    assert realms["Mal'Ganis"]["cheap_run_count"] == 0
    assert realms["Mal'Ganis"]["window_size"] == 1

    latest = client.get("/realm-suggestions/latest")
    assert latest.status_code == 200
    latest_payload = latest.json()["latest"]
    assert latest_payload is not None
    latest_realms = {row["realm"]: row for row in latest_payload["recommendations"]}
    assert latest_realms["Area 52"]["appearance_count"] == 2


def test_realm_suggestions_can_focus_on_selected_target_realms(client, monkeypatch) -> None:
    _create_tracked_realm(client, "Stormrage")
    _create_tracked_realm(client, "Zul'jin")
    _seed_item(2001, name="Focused Test Item")

    provider = get_provider_registry().listing_providers["blizzard_auctions"]
    monkeypatch.setattr(provider, "is_available", lambda: (True, "Configured for live Blizzard Retail Auction House refreshes."))
    monkeypatch.setattr(provider, "list_available_realms", lambda: ["Area 52"])

    def fake_fetch_listings(realms: list[str]) -> list[ListingImportRow]:
        captured_at = datetime(2026, 4, 9, 13, 0, tzinfo=timezone.utc)
        rows = [
            ListingImportRow(item_id=2001, realm="Stormrage", lowest_price=70000, average_price=71000, quantity=5, listing_count=3, captured_at=captured_at),
            ListingImportRow(item_id=2001, realm="Area 52", lowest_price=15000, average_price=16000, quantity=5, listing_count=3, captured_at=captured_at),
        ]
        if "Zul'jin" in realms:
            rows.append(
                ListingImportRow(item_id=2001, realm="Zul'jin", lowest_price=45000, average_price=46000, quantity=5, listing_count=3, captured_at=captured_at)
            )
        return rows

    monkeypatch.setattr(provider, "fetch_listings", fake_fetch_listings)

    response = client.post("/realm-suggestions/run", json={"target_realms": ["Stormrage"]})
    assert response.status_code == 200
    payload = response.json()
    assert payload["target_realms"] == ["Stormrage"]
    assert payload["recommendations"]
    assert payload["recommendations"][0]["top_items"][0]["target_realm"] == "Stormrage"

    latest = client.get("/realm-suggestions/latest?target_realms=Stormrage")
    assert latest.status_code == 200
    assert latest.json()["latest"]["target_realms"] == ["Stormrage"]


def test_realm_suggestions_rotate_batches_per_target_set(client, monkeypatch) -> None:
    _create_tracked_realm(client, "Stormrage")
    _create_tracked_realm(client, "Zul'jin")
    _seed_item(3001, name="Rotation Test Item")

    provider = get_provider_registry().listing_providers["blizzard_auctions"]
    monkeypatch.setattr(provider, "is_available", lambda: (True, "Configured for live Blizzard Retail Auction House refreshes."))
    monkeypatch.setattr(realm_suggestion_module, "DISCOVERY_BATCH_SIZE", 1)
    monkeypatch.setattr(provider, "list_available_realms", lambda: ["Area 52", "Illidan"])

    def fake_fetch_listings(realms: list[str]) -> list[ListingImportRow]:
        captured_at = datetime(2026, 4, 9, 14, 0, tzinfo=timezone.utc)
        source_prices = {
            "Area 52": 15000,
            "Illidan": 21000,
        }
        target_prices = {
            "Stormrage": 68000,
            "Zul'jin": 72000,
        }
        rows: list[ListingImportRow] = []
        for realm in realms:
            if realm in source_prices:
                rows.append(
                    ListingImportRow(
                        item_id=3001,
                        realm=realm,
                        lowest_price=source_prices[realm],
                        average_price=source_prices[realm] + 500,
                        quantity=4,
                        listing_count=2,
                        captured_at=captured_at,
                    )
                )
            if realm in target_prices:
                rows.append(
                    ListingImportRow(
                        item_id=3001,
                        realm=realm,
                        lowest_price=target_prices[realm],
                        average_price=target_prices[realm] + 500,
                        quantity=4,
                        listing_count=2,
                        captured_at=captured_at,
                    )
                )
        return rows

    monkeypatch.setattr(provider, "fetch_listings", fake_fetch_listings)

    stormrage_first = client.post("/realm-suggestions/run", json={"target_realms": ["Stormrage"]})
    assert stormrage_first.status_code == 200
    assert stormrage_first.json()["recommendations"][0]["realm"] == "Area 52"

    stormrage_second = client.post("/realm-suggestions/run", json={"target_realms": ["Stormrage"]})
    assert stormrage_second.status_code == 200
    assert stormrage_second.json()["recommendations"][0]["realm"] == "Illidan"

    zuljin_first = client.post("/realm-suggestions/run", json={"target_realms": ["Zul'jin"]})
    assert zuljin_first.status_code == 200
    assert zuljin_first.json()["recommendations"][0]["realm"] == "Area 52"

    latest_zuljin = client.get("/realm-suggestions/latest?target_realms=Zul%27jin")
    assert latest_zuljin.status_code == 200
    assert latest_zuljin.json()["latest"]["recommendations"][0]["realm"] == "Area 52"
