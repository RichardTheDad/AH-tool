from __future__ import annotations

import pytest

from app.core.config import clear_settings_cache
from app.db.session import _engine_kwargs


def test_engine_kwargs_use_configurable_pool_settings_for_postgres(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AZEROTHFLIPLOCAL_DB_POOL_SIZE", "10")
    monkeypatch.setenv("AZEROTHFLIPLOCAL_DB_MAX_OVERFLOW", "6")
    monkeypatch.setenv("AZEROTHFLIPLOCAL_DB_POOL_TIMEOUT_SECONDS", "40")
    monkeypatch.setenv("AZEROTHFLIPLOCAL_DB_POOL_RECYCLE_SECONDS", "900")
    clear_settings_cache()

    kwargs = _engine_kwargs("postgresql+psycopg2://user:pass@localhost:5432/db")

    assert kwargs["pool_size"] == 10
    assert kwargs["max_overflow"] == 6
    assert kwargs["pool_timeout"] == 40
    assert kwargs["pool_recycle"] == 900
    assert kwargs["pool_pre_ping"] is True
    assert kwargs["pool_use_lifo"] is True


def test_engine_kwargs_skip_pool_tuning_for_sqlite(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AZEROTHFLIPLOCAL_DB_POOL_SIZE", "10")
    clear_settings_cache()

    kwargs = _engine_kwargs("sqlite:///./backend/azerothfliplocal.db")

    assert "pool_size" not in kwargs
    assert kwargs["connect_args"]["check_same_thread"] is False
