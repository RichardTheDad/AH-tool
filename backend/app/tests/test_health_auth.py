from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.core.config import clear_settings_cache
from app.core.limiter import limiter
from app.db.session import clear_db_caches
from app.services.provider_service import reset_provider_registry
from app.services import scan_runtime_service as _scan_runtime


def test_detailed_health_requires_auth_or_key_when_restricted(tmp_path: Path, monkeypatch) -> None:
    db_path = tmp_path / "health_auth.db"
    monkeypatch.setenv("AZEROTHFLIPLOCAL_DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    monkeypatch.setenv("AZEROTHFLIPLOCAL_ENABLE_SCHEDULER", "false")
    monkeypatch.setenv("AZEROTHFLIPLOCAL_SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("AZEROTHFLIPLOCAL_SUPABASE_JWT_SECRET", "test-secret")
    monkeypatch.setenv("AZEROTHFLIPLOCAL_RESTRICT_HEALTH_DIAGNOSTICS", "true")
    monkeypatch.setenv("AZEROTHFLIPLOCAL_HEALTH_DIAGNOSTICS_API_KEY", "ops-key")

    clear_settings_cache()
    clear_db_caches()
    reset_provider_registry()
    _scan_runtime._user_last_scan.clear()

    from app.main import create_app

    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: "test-user"
    limiter.enabled = False

    with TestClient(app) as client:
        basic = client.get("/health")
        assert basic.status_code == 200

        blocked = client.get("/health/scheduler")
        assert blocked.status_code == 401

        allowed = client.get("/health/scheduler", headers={"X-Health-Key": "ops-key"})
        assert allowed.status_code == 200

        allowed_metadata = client.get("/health/metadata", headers={"X-Health-Key": "ops-key"})
        assert allowed_metadata.status_code == 200

    clear_settings_cache()
    clear_db_caches()
    reset_provider_registry()
    _scan_runtime._user_last_scan.clear()
