from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.core.config import clear_settings_cache
from app.db.session import clear_db_caches
from app.services.provider_service import reset_provider_registry
from app.services import scan_runtime_service as _scan_runtime

TEST_USER_ID = "test-user-00000000-0000-0000-0000-000000000001"


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    db_path = tmp_path / "test.db"
    monkeypatch.setenv("AZEROTHFLIPLOCAL_DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    monkeypatch.setenv("AZEROTHFLIPLOCAL_ENABLE_SCHEDULER", "false")
    monkeypatch.setenv("AZEROTHFLIPLOCAL_BLIZZARD_CLIENT_ID", "")
    monkeypatch.setenv("AZEROTHFLIPLOCAL_BLIZZARD_CLIENT_SECRET", "")

    clear_settings_cache()
    clear_db_caches()
    reset_provider_registry()
    _scan_runtime._user_last_scan.clear()

    from app.main import create_app
    from app.core.limiter import limiter

    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: TEST_USER_ID
    limiter.enabled = False

    with TestClient(app) as test_client:
        yield test_client

    clear_settings_cache()
    clear_db_caches()
    reset_provider_registry()
    _scan_runtime._user_last_scan.clear()
