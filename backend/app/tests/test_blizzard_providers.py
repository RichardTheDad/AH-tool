from __future__ import annotations

from app.core.config import BACKEND_ROOT, Settings
from app.providers.blizzard_auctions import BlizzardAuctionListingProvider
from app.providers.blizzard_metadata import BlizzardMetadataProvider
from app.services.provider_service import ProviderRegistry


def make_settings() -> Settings:
    return Settings.model_construct(
        blizzard_client_id="client-id",
        blizzard_client_secret="client-secret",
        blizzard_api_region="us",
        blizzard_locale="en_US",
        request_timeout_seconds=8,
    )


def test_blizzard_metadata_fetch_normalizes_item_and_media() -> None:
    provider = BlizzardMetadataProvider(make_settings())
    captured: list[tuple[str, dict, bool]] = []

    def fake_api_get(client, path: str, *, params=None, fallback_query_token: bool = False):
        captured.append((path, params or {}, fallback_query_token))
        if path == "/data/wow/item/873":
            return (
                {
                    "id": 873,
                    "name": {"en_US": "Staff of Jordan"},
                    "item_class": {"id": 2, "name": {"en_US": "Weapon"}},
                    "item_subclass": {"id": 10, "name": {"en_US": "Staff"}},
                    "quality": {"type": "EPIC", "name": {"en_US": "Epic"}},
                },
                {},
            )
        return (
            {
                "assets": [
                    {"key": "icon", "value": "https://render.worldofwarcraft.com/us/icons/56/inv_staff_13.jpg"},
                ]
            },
            {},
        )

    provider._api_get = fake_api_get  # type: ignore[method-assign]
    provider._get_access_token = lambda client, force_refresh=False: "token"  # type: ignore[method-assign]

    item = provider.fetch_item(873)

    assert item is not None
    assert item.item_id == 873
    assert item.name == "Staff of Jordan"
    assert item.class_name == "Weapon"
    assert item.subclass_name == "Staff"
    assert item.quality == "Epic"
    assert item.icon_url is not None
    assert any(call[0] == "/data/wow/item/873" for call in captured)
    assert any(call[0] == "/data/wow/media/item/873" for call in captured)


def test_blizzard_metadata_search_uses_item_search_endpoint() -> None:
    provider = BlizzardMetadataProvider(make_settings())
    captured: list[tuple[str, dict, bool]] = []

    def fake_api_get(client, path: str, *, params=None, fallback_query_token: bool = False):
        captured.append((path, params or {}, fallback_query_token))
        return (
            {
                "results": [
                    {
                        "data": {
                            "id": 873,
                            "name": {"en_US": "Staff of Jordan"},
                            "item_class": {"name": {"en_US": "Weapon"}},
                            "item_subclass": {"name": {"en_US": "Staff"}},
                            "quality": {"name": {"en_US": "Epic"}},
                        }
                    }
                ]
            },
            {},
        )

    provider._api_get = fake_api_get  # type: ignore[method-assign]
    provider._get_access_token = lambda client, force_refresh=False: "token"  # type: ignore[method-assign]

    results = provider.search_items("Jordan", limit=10)

    assert len(results) == 1
    assert results[0].item_id == 873
    assert captured == [
        (
            "/data/wow/search/item",
            {
                "namespace": "static-us",
                "locale": "en_US",
                "name.en_US": "Jordan",
                "_pageSize": 10,
                "_page": 1,
                "orderby": "id",
            },
            True,
        )
    ]


def test_blizzard_provider_normalizes_connected_realm_auctions() -> None:
    provider = BlizzardAuctionListingProvider(make_settings())
    captured_calls: list[tuple[str, dict | None, bool]] = []

    def fake_get_access_token(client, *, force_refresh: bool = False) -> str:
        return "test-token"

    def fake_api_get(client, path_or_url: str, *, params=None, absolute: bool = False):
        captured_calls.append((path_or_url, params, absolute))
        if path_or_url == "/data/wow/connected-realm/index":
            return ({"connected_realms": [{"href": "https://us.api.blizzard.com/data/wow/connected-realm/11"}]}, {})
        if absolute:
            return (
                {
                    "id": 11,
                    "realms": [
                        {"name": {"en_US": "Stormrage"}},
                    ],
                },
                {},
            )
        return (
            {
                "auctions": [
                    {"item": {"id": 873}, "buyout": 10_000, "quantity": 2},
                    {"item": {"id": 873}, "buyout": 12_000, "quantity": 1},
                    {"item": {"id": 1745}, "buyout": 20_000, "quantity": 3},
                ]
            },
            {"Last-Modified": "Wed, 06 Apr 2026 02:45:00 GMT"},
        )

    provider._get_access_token = fake_get_access_token  # type: ignore[method-assign]
    provider._api_get = fake_api_get  # type: ignore[method-assign]

    rows = provider.fetch_listings(["Stormrage"])

    assert rows
    staff = next(row for row in rows if row.item_id == 873)
    assert staff.realm == "Stormrage"
    assert staff.lowest_price == 10_000
    assert staff.average_price == 10_666.67
    assert staff.quantity == 3
    assert staff.listing_count == 2
    assert any(call[0] == "/data/wow/connected-realm/index" for call in captured_calls)


def test_blizzard_live_item_market_lookup_filters_to_requested_item() -> None:
    provider = BlizzardAuctionListingProvider(make_settings())

    def fake_get_access_token(client, *, force_refresh: bool = False) -> str:
        return "test-token"

    def fake_api_get(client, path_or_url: str, *, params=None, absolute: bool = False):
        if path_or_url == "/data/wow/connected-realm/index":
            return ({"connected_realms": [{"href": "https://us.api.blizzard.com/data/wow/connected-realm/11"}]}, {})
        if absolute:
            return (
                {
                    "id": 11,
                    "realms": [
                        {"name": {"en_US": "Stormrage"}},
                    ],
                },
                {},
            )
        return (
            {
                "auctions": [
                    {"item": {"id": 873}, "buyout": 10_000, "quantity": 2},
                    {"item": {"id": 1745}, "buyout": 20_000, "quantity": 3},
                ]
            },
            {"Last-Modified": "Wed, 06 Apr 2026 02:45:00 GMT"},
        )

    provider._get_access_token = fake_get_access_token  # type: ignore[method-assign]
    provider._api_get = fake_api_get  # type: ignore[method-assign]

    rows, message = provider.fetch_item_market(item_id=873, region="us", tracked_realms=["Stormrage"])

    assert len(rows) == 1
    assert rows[0].item_id == 873
    assert rows[0].realm == "Stormrage"
    assert "item 873" in message


def test_blizzard_providers_report_missing_credentials_truthfully() -> None:
    settings = Settings.model_construct(
        blizzard_client_id="",
        blizzard_client_secret="",
        blizzard_api_region="us",
        blizzard_locale="en_US",
        request_timeout_seconds=8,
    )

    listing_provider = BlizzardAuctionListingProvider(settings)
    metadata_provider = BlizzardMetadataProvider(settings)

    listing_available, listing_message = listing_provider.is_available()
    metadata_available, metadata_message = metadata_provider.is_available()

    assert listing_available is False
    assert metadata_available is False
    assert "client credentials" in listing_message.lower()
    assert "client credentials" in metadata_message.lower()


def test_runtime_registry_has_no_mock_provider_or_demo_seed_files() -> None:
    registry = ProviderRegistry()

    assert "mock" not in registry.listing_providers
    assert "blizzard_auctions" in registry.listing_providers
    assert registry.metadata_provider.name == "blizzard_metadata"
    assert not (BACKEND_ROOT / "seed" / "demo_seed.json").exists()
    assert not (BACKEND_ROOT / "seed" / "sample_listings.csv").exists()
    assert not (BACKEND_ROOT / "seed" / "sample_listings.json").exists()
