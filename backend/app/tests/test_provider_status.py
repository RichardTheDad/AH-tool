from __future__ import annotations

from app.services.provider_service import get_provider_registry


def test_provider_status_endpoint_reports_truthful_local_fallbacks(client) -> None:
    response = client.get("/providers/status")
    assert response.status_code == 200

    payload = response.json()
    names = {provider["name"]: provider for provider in payload["providers"]}

    assert set(names) == {"blizzard_auctions", "blizzard_metadata"}
    assert names["blizzard_auctions"]["available"] is False
    assert names["blizzard_auctions"]["status"] == "unavailable"
    assert names["blizzard_metadata"]["available"] is False
    assert names["blizzard_metadata"]["status"] == "unavailable"
    assert "mock" not in names


def test_provider_status_uses_source_specific_cache_counts(client) -> None:
    from datetime import datetime, timezone
    from app.db.models import Item, ListingSnapshot
    from app.db.session import get_session_factory

    client.post("/realms", json={"realm_name": "Stormrage", "region": "us", "enabled": True})
    session = get_session_factory()()
    try:
        session.add(Item(item_id=873, name="Test Item 873"))
        session.add(ListingSnapshot(
            item_id=873, realm="Stormrage", lowest_price=15000, average_price=15500,
            quantity=2, listing_count=2, source_name="blizzard_auctions",
            captured_at=datetime.now(timezone.utc),
        ))
        session.commit()
    finally:
        session.close()

    status = client.get("/providers/status")
    assert status.status_code == 200

    names = {provider["name"]: provider for provider in status.json()["providers"]}
    assert names["blizzard_auctions"]["cache_records"] == 1
    assert names["blizzard_metadata"]["cache_records"] == 0
    assert names["blizzard_metadata"]["status"] == "unavailable"


def test_provider_status_recovers_after_transient_metadata_failure(client, monkeypatch) -> None:
    provider = get_provider_registry().metadata_provider
    provider.settings.blizzard_client_id = "client-id"
    provider.settings.blizzard_client_secret = "client-secret"
    provider.mark_failure("Temporary network timeout")

    def fake_recheck_status() -> tuple[bool, str]:
        provider.mark_success()
        return True, "Configured for live Blizzard item metadata lookups."

    monkeypatch.setattr(provider, "recheck_status", fake_recheck_status)

    response = client.get("/providers/status")
    assert response.status_code == 200

    names = {entry["name"]: entry for entry in response.json()["providers"]}
    assert names["blizzard_metadata"]["status"] == "available"
    assert names["blizzard_metadata"]["last_error"] is None


def test_blizzard_listing_provider_failure_reports_error_when_credentials_exist(client) -> None:
    provider = get_provider_registry().listing_providers["blizzard_auctions"]
    provider.settings.blizzard_client_id = "client-id"
    provider.settings.blizzard_client_secret = "client-secret"
    provider.mark_failure("Lookup request failed")

    response = client.get("/providers/status")
    assert response.status_code == 200

    names = {entry["name"]: entry for entry in response.json()["providers"]}
    assert names["blizzard_auctions"]["status"] == "error"
    assert names["blizzard_auctions"]["last_error"] == "Lookup request failed"
