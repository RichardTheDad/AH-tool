from __future__ import annotations

import pytest
from jose import JWTError

from app.core.auth import _assert_trusted_issuer
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
