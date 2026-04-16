from __future__ import annotations

import pytest
import httpx
from jose import JWTError

from app.core.auth import _assert_trusted_issuer, _fetch_jwks, _jwks_cache
from app.core.config import clear_settings_cache


def test_assert_trusted_issuer_accepts_auth_v1_token_issuer(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AZEROTHFLIPLOCAL_SUPABASE_URL", "https://project.supabase.co")
    clear_settings_cache()

    assert _assert_trusted_issuer("https://project.supabase.co/auth/v1") == "https://project.supabase.co/auth/v1"


def test_assert_trusted_issuer_accepts_base_token_issuer(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AZEROTHFLIPLOCAL_SUPABASE_URL", "https://project.supabase.co/auth/v1")
    clear_settings_cache()

    assert _assert_trusted_issuer("https://project.supabase.co") == "https://project.supabase.co/auth/v1"


def test_assert_trusted_issuer_rejects_untrusted_host(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AZEROTHFLIPLOCAL_SUPABASE_URL", "https://project.supabase.co")
    clear_settings_cache()

    with pytest.raises(JWTError, match="Token issuer is not trusted"):
        _assert_trusted_issuer("https://evil.example.com/auth/v1")


def test_fetch_jwks_wraps_network_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    class FailingClient:
        def __init__(self, timeout: float) -> None:
            self.timeout = timeout

        def __enter__(self) -> "FailingClient":
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def get(self, url: str) -> httpx.Response:
            raise httpx.ConnectError("connection failed")

    _jwks_cache.clear()
    monkeypatch.setattr(httpx, "Client", FailingClient)

    with pytest.raises(JWTError, match="Unable to fetch Supabase JWKS"):
        _fetch_jwks("https://project.supabase.co/auth/v1/.well-known/jwks.json")
