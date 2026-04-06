from __future__ import annotations


def test_provider_status_endpoint_reports_truthful_local_fallbacks(client) -> None:
    response = client.get("/providers/status")
    assert response.status_code == 200

    payload = response.json()
    names = {provider["name"]: provider for provider in payload["providers"]}

    assert set(names) == {"file_import", "saddlebag_public", "saddlebag_public_metadata"}
    assert names["file_import"]["available"] is True
    assert names["file_import"]["status"] == "available"
    assert names["saddlebag_public"]["available"] is False
    assert names["saddlebag_public"]["status"] == "unavailable"
    assert names["saddlebag_public"]["supports_live_fetch"] is False
    assert "No Saddlebag WoW listings API base URL is configured." == names["saddlebag_public"]["message"]
    assert "mock" not in names


def test_provider_status_uses_source_specific_cache_counts(client) -> None:
    client.post("/realms", json={"realm_name": "Stormrage", "region": "us", "enabled": True})
    payload = b"item_id,realm,lowest_price,quantity,captured_at\n873,Stormrage,15000,2,2026-04-06T02:45:00+00:00\n"
    response = client.post(
        "/imports/listings",
        data={"commit": "true"},
        files={"file": ("listings.csv", payload, "text/csv")},
    )
    assert response.status_code == 200

    status = client.get("/providers/status")
    assert status.status_code == 200

    names = {provider["name"]: provider for provider in status.json()["providers"]}
    assert names["file_import"]["cache_records"] == 1
    assert names["saddlebag_public"]["cache_records"] == 0
    assert names["saddlebag_public"]["status"] == "unavailable"
    assert names["saddlebag_public_metadata"]["cache_records"] == 0
    assert names["saddlebag_public_metadata"]["status"] == "unavailable"
