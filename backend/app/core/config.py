from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from urllib.parse import unquote

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


PROJECT_ROOT = Path(__file__).resolve().parents[3]
BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_prefix="AZEROTHFLIPLOCAL_",
        extra="ignore",
        enable_decoding=False,
    )

    app_name: str = "Azeroth Flip"
    api_title: str = "Azeroth Flip API"
    api_version: str = "0.1.0"
    database_url: str = f"sqlite:///{(BACKEND_ROOT / 'azerothfliplocal.db').as_posix()}"
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "https://ah-tool-bice.vercel.app",
        ]
    )
    cors_origin_regex: str | None = r"https://ah-tool-bice(?:-[a-z0-9-]+)?\.vercel\.app"
    default_region: str = "us"
    default_listing_provider: str = "blizzard_auctions"
    enable_scheduler: bool = True
    log_level: str = "INFO"
    request_timeout_seconds: int = 8
    blizzard_client_id: str = ""
    blizzard_client_secret: str = ""
    blizzard_api_region: str = "us"
    blizzard_locale: str = "en_US"
    tsm_api_key: str = ""
    tsm_region_id: int | None = None
    supabase_url: str = ""
    supabase_jwt_secret: str = ""
    supabase_service_role_key: str = ""
    enforce_auth_startup_validation: bool = True
    restrict_health_diagnostics: bool = False
    health_diagnostics_api_key: str = ""
    scheduler_refresh_interval_minutes: int = 65
    scan_data_retention_days: int = 365
    db_min_free_mb: int = 1024
    db_target_free_mb: int = 1536
    db_pool_size: int = 10
    db_max_overflow: int = 5
    db_pool_timeout_seconds: int = 30
    db_pool_recycle_seconds: int = 1800
    db_statement_timeout_ms: int = 15000

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: object) -> str:
        raw = str(value or "").strip()
        # SQLAlchemy v2 requires 'postgresql://' not 'postgres://'
        if raw.startswith("postgres://"):
            raw = "postgresql://" + raw[len("postgres://"):]
        if not raw.startswith("sqlite:///") or raw == "sqlite:///:memory:":
            return raw

        path_part = raw.removeprefix("sqlite:///")
        if not path_part or path_part == ":memory:":
            return raw

        decoded_path = unquote(path_part)
        db_path = Path(decoded_path)
        if db_path.is_absolute():
            return raw

        normalized = (PROJECT_ROOT / db_path).resolve()
        return f"sqlite:///{normalized.as_posix()}"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> list[str]:
        default_origins = [
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "https://ah-tool-bice.vercel.app",
        ]

        if value is None or value == "":
            return default_origins

        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]

        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return default_origins

            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                parsed = [part.strip() for part in raw.split(",")]

            if isinstance(parsed, str):
                parsed = [parsed]

            if isinstance(parsed, list):
                origins = [str(item).strip() for item in parsed if str(item).strip()]
                if origins:
                    return origins

        raise ValueError("cors_origins must be a JSON array or a comma-separated string.")

    @field_validator("default_listing_provider", mode="before")
    @classmethod
    def normalize_default_listing_provider(cls, value: object) -> str:
        raw = str(value or "").strip().lower()
        if not raw or raw in {"stored", "mock"}:
            return "file_import"
        if raw in {"blizzard", "blizzard_ah", "blizzard_retail"}:
            return "blizzard_auctions"
        return raw

    @field_validator("tsm_region_id", mode="before")
    @classmethod
    def normalize_tsm_region_id(cls, value: object) -> int | None:
        if value is None or value == "":
            return None
        return int(value)

    @field_validator("supabase_url", mode="before")
    @classmethod
    def normalize_supabase_url(cls, value: object) -> str:
        raw = str(value or "").strip().rstrip("/")
        return raw


SYSTEM_USER_ID = "system"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


def clear_settings_cache() -> None:
    get_settings.cache_clear()


def validate_startup_settings(settings: Settings) -> None:
    issues: list[str] = []
    if settings.enforce_auth_startup_validation:
        if not settings.supabase_url:
            issues.append("AZEROTHFLIPLOCAL_SUPABASE_URL must be set.")
        if not settings.supabase_jwt_secret:
            issues.append("AZEROTHFLIPLOCAL_SUPABASE_JWT_SECRET must be set.")

    if issues:
        joined = " ".join(issues)
        raise RuntimeError(f"Startup configuration invalid. {joined}")
