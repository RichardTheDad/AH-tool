from __future__ import annotations

from app.core.config import BACKEND_ROOT, Settings
from app.providers.saddlebag_listings import SaddlebagPublicListingProvider
from app.providers.saddlebag_metadata import SaddlebagPublicMetadataProvider
from app.services.provider_service import ProviderRegistry


def make_settings() -> Settings:
    return Settings.model_construct(
        saddlebag_metadata_url="https://example.test",
        saddlebag_listing_url="https://example.test",
        request_timeout_seconds=8,
    )


def test_metadata_fetch_builds_itemdata_request_from_spec() -> None:
    provider = SaddlebagPublicMetadataProvider(make_settings())
    captured: list[tuple[str, dict]] = []

    def fake_post(path: str, payload: dict):
        captured.append((path, payload))
        return [{"itemID": 873, "name": "Staff of Jordan"}]

    provider._post = fake_post  # type: ignore[method-assign]

    item = provider.fetch_item(873)

    assert item is not None
    assert item.item_id == 873
    assert captured == [
        (
            "/api/wow/itemdata",
            {
                "ilvl": -1,
                "itemQuality": -1,
                "required_level": -1,
                "item_class": [-1],
                "item_subclass": [],
                "item_ids": [873],
            },
        )
    ]


def test_metadata_search_builds_itemnames_request_from_spec() -> None:
    provider = SaddlebagPublicMetadataProvider(make_settings())
    captured: list[tuple[str, dict]] = []

    def fake_post(path: str, payload: dict):
        captured.append((path, payload))
        return [{"itemID": 873, "name": "Staff of Jordan"}]

    provider._post = fake_post  # type: ignore[method-assign]

    results = provider.search_items("Jordan", limit=10)

    assert len(results) == 1
    assert results[0].item_id == 873
    assert captured == [
        (
            "/api/wow/itemnames",
            {
                "item_ids": [],
                "return_all": False,
                "pets": False,
                "use_db": True,
            },
        )
    ]


def test_listing_provider_builds_spec_request_shape() -> None:
    provider = SaddlebagPublicListingProvider(make_settings())
    payload = provider.build_request(home_realm_id=60, region="us", item_id=873)

    assert payload.model_dump() == {
        "homeRealmId": 60,
        "region": "US",
        "itemID": 873,
    }


def test_listing_provider_normalizes_listing_payload() -> None:
    provider = SaddlebagPublicListingProvider(make_settings())

    listing = provider._normalize_listing_payload(  # type: ignore[attr-defined]
        [
            {"price": 10_000, "quantity": 2},
            {"buyout": 12_000, "count": 1},
        ],
        item_id=873,
        realm_name="Stormrage",
    )

    assert listing is not None
    assert listing.item_id == 873
    assert listing.realm == "Stormrage"
    assert listing.lowest_price == 10_000
    assert listing.average_price == 10_666.67
    assert listing.quantity == 3
    assert listing.listing_count == 2


def test_listing_provider_reports_bulk_scan_unavailable_without_faking_data() -> None:
    provider = SaddlebagPublicListingProvider(make_settings())

    rows = provider.fetch_listings(["Stormrage", "Area 52"])

    assert rows == []
    assert provider.last_error is not None
    assert "homeRealmId + itemID" in provider.last_error


def test_runtime_registry_has_no_mock_provider_or_demo_seed_files() -> None:
    registry = ProviderRegistry()

    assert "mock" not in registry.listing_providers
    assert not (BACKEND_ROOT / "seed" / "demo_seed.json").exists()
    assert not (BACKEND_ROOT / "seed" / "sample_listings.csv").exists()
    assert not (BACKEND_ROOT / "seed" / "sample_listings.json").exists()
