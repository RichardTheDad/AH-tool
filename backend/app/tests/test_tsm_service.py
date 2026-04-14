from __future__ import annotations

from app.core.config import clear_settings_cache, get_settings
from app.services.tsm_service import TsmMarketService


def test_tsm_service_unavailable_without_api_key(monkeypatch) -> None:
    monkeypatch.setenv("AZEROTHFLIPLOCAL_TSM_API_KEY", "")
    monkeypatch.setenv("AZEROTHFLIPLOCAL_BLIZZARD_API_REGION", "us")
    clear_settings_cache()

    service = TsmMarketService(get_settings())
    available, message = service.is_available()
    assert not available
    assert "api key" in message.lower()

    clear_settings_cache()


def test_tsm_service_available_with_api_key(monkeypatch) -> None:
    monkeypatch.setenv("AZEROTHFLIPLOCAL_TSM_API_KEY", "dummy-key")
    monkeypatch.setenv("AZEROTHFLIPLOCAL_BLIZZARD_API_REGION", "us")
    clear_settings_cache()

    service = TsmMarketService(get_settings())
    available, message = service.is_available()
    assert available

    clear_settings_cache()

