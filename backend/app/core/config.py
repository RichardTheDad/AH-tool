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

    app_name: str = "AzerothFlipLocal"
    api_title: str = "AzerothFlipLocal API"
    api_version: str = "0.1.0"
    database_url: str = f"sqlite:///{(BACKEND_ROOT / 'azerothfliplocal.db').as_posix()}"
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://127.0.0.1:5173",
            "http://localhost:5173",
        ]
    )
    default_region: str = "us"
    default_listing_provider: str = "file_import"
    enable_scheduler: bool = True
    log_level: str = "INFO"
    request_timeout_seconds: int = 8
    blizzard_client_id: str = ""
    blizzard_client_secret: str = ""
    blizzard_api_region: str = "us"
    blizzard_locale: str = "en_US"
    tsm_api_key: str = ""
    tsm_region_id: int | None = None
    tsm_apphelper_path: str = ""
    tsm_savedvariables_path: str = ""

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: object) -> str:
        raw = str(value or "").strip()
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


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


def clear_settings_cache() -> None:
    get_settings.cache_clear()
