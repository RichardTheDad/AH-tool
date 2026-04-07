from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import clear_settings_cache
from app.db.session import clear_db_caches
from app.services.provider_service import reset_provider_registry


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    db_path = tmp_path / "test.db"
    monkeypatch.setenv("AZEROTHFLIPLOCAL_DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    monkeypatch.setenv("AZEROTHFLIPLOCAL_DEFAULT_LISTING_PROVIDER", "file_import")
    monkeypatch.setenv("AZEROTHFLIPLOCAL_ENABLE_SCHEDULER", "false")
    monkeypatch.setenv("AZEROTHFLIPLOCAL_BLIZZARD_CLIENT_ID", "")
    monkeypatch.setenv("AZEROTHFLIPLOCAL_BLIZZARD_CLIENT_SECRET", "")

    clear_settings_cache()
    clear_db_caches()
    reset_provider_registry()

    from app.main import create_app

    app = create_app()
    with TestClient(app) as test_client:
        yield test_client

    clear_settings_cache()
    clear_db_caches()
    reset_provider_registry()
