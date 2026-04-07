from __future__ import annotations

from app.schemas.item import ItemRead, ItemSearchResult
from app.services.provider_service import get_provider_registry


def test_numeric_item_search_returns_remote_upserted_item(client, monkeypatch) -> None:
    provider = get_provider_registry().metadata_provider

    def fake_search(query: str, limit: int = 25) -> list[ItemSearchResult]:
        if query == "873":
            return [ItemSearchResult(item_id=873, name="Staff of Jordan", is_commodity=False)]
        return []

    monkeypatch.setattr(provider, "search_items", fake_search)

    response = client.post("/items/search", json={"query": "873", "limit": 10})
    assert response.status_code == 200
    payload = response.json()
    assert [item["item_id"] for item in payload] == [873]
    assert payload[0]["name"] == "Staff of Jordan"

    repeated = client.post("/items/search", json={"query": "873", "limit": 10})
    assert repeated.status_code == 200
    assert [item["item_id"] for item in repeated.json()] == [873]


def test_name_item_search_returns_remote_upserted_item(client, monkeypatch) -> None:
    provider = get_provider_registry().metadata_provider

    def fake_search(query: str, limit: int = 25) -> list[ItemSearchResult]:
        if query == "Jordan":
            return [ItemSearchResult(item_id=873, name="Staff of Jordan", is_commodity=False)]
        return []

    monkeypatch.setattr(provider, "search_items", fake_search)

    response = client.post("/items/search", json={"query": "Jordan", "limit": 10})
    assert response.status_code == 200
    payload = response.json()
    assert [item["item_id"] for item in payload] == [873]
    assert payload[0]["name"] == "Staff of Jordan"


def test_import_commit_refreshes_missing_metadata_when_provider_is_available(client, monkeypatch) -> None:
    provider = get_provider_registry().metadata_provider
    provider.settings.blizzard_client_id = "client-id"
    provider.settings.blizzard_client_secret = "client-secret"

    def fake_fetch_item(item_id: int) -> ItemRead | None:
        if item_id == 873:
            return ItemRead(item_id=873, name="Staff of Jordan", class_name="Weapon", is_commodity=False)
        return None

    monkeypatch.setattr(provider, "fetch_item", fake_fetch_item)

    client.post("/realms", json={"realm_name": "Stormrage", "region": "us", "enabled": True})
    payload = b"item_id,realm,lowest_price,average_price,quantity,listing_count,captured_at\n873,Stormrage,15000,15500,2,2,2026-04-06T02:45:00+00:00\n"

    response = client.post(
        "/imports/listings",
        data={"commit": "true"},
        files={"file": ("listings.csv", payload, "text/csv")},
    )
    assert response.status_code == 200
    assert response.json()["metadata_refreshed_count"] == 1

    item = client.get("/items/873")
    assert item.status_code == 200
    assert item.json()["name"] == "Staff of Jordan"
    assert item.json()["metadata_status"] == "cached"
