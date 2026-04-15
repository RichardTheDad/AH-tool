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
    from datetime import datetime, timezone
    from app.db.models import Item, ListingSnapshot
    from app.db.session import get_session_factory

    provider = get_provider_registry().metadata_provider
    provider.settings.blizzard_client_id = "client-id"
    provider.settings.blizzard_client_secret = "client-secret"

    def fake_fetch_item(item_id: int) -> ItemRead | None:
        if item_id == 873:
            return ItemRead(item_id=873, name="Staff of Jordan", class_name="Weapon", is_commodity=False)
        return None

    monkeypatch.setattr(provider, "fetch_item", fake_fetch_item)

    # Insert an item with missing metadata directly
    session = get_session_factory()()
    try:
        session.add(Item(
            item_id=873,
            name="Item 873 (metadata unavailable)",
            metadata_json={"metadata_status": "missing"},
            is_commodity=False,
        ))
        session.commit()
    finally:
        session.close()

    # Trigger metadata refresh via the API endpoint
    response = client.post("/items/refresh-metadata", json={"item_ids": [873]})
    assert response.status_code == 200

    item = client.get("/items/873")
    assert item.status_code == 200
    assert item.json()["name"] == "Staff of Jordan"
    assert item.json()["metadata_status"] == "cached"
