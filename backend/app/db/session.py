from __future__ import annotations

from functools import lru_cache
from typing import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


def _sqlite_connect_args(database_url: str) -> dict[str, object]:
    if database_url.startswith("sqlite"):
        return {
            "check_same_thread": False,
            "timeout": 30,
        }
    return {}


def _engine_kwargs(database_url: str) -> dict[str, object]:
    settings = get_settings()
    connect_args = _sqlite_connect_args(database_url)
    kwargs: dict[str, object] = {
        "future": True,
        "connect_args": connect_args,
    }
    if not database_url.startswith("sqlite"):
        pool_size = max(1, int(settings.db_pool_size))
        max_overflow = max(0, int(settings.db_max_overflow))
        pool_timeout = max(3, int(settings.db_pool_timeout_seconds))
        pool_recycle = max(300, int(settings.db_pool_recycle_seconds))
        statement_timeout_ms = max(0, int(settings.db_statement_timeout_ms))

        if statement_timeout_ms > 0 and database_url.startswith(("postgresql://", "postgresql+psycopg2://")):
            existing_options = str(connect_args.get("options", "")).strip()
            timeout_option = f"-c statement_timeout={statement_timeout_ms}"
            connect_args["options"] = f"{existing_options} {timeout_option}".strip() if existing_options else timeout_option

        # Keep pool usage bounded but configurable for production traffic bursts.
        kwargs.update(
            {
                "pool_size": pool_size,
                "max_overflow": max_overflow,
                "pool_timeout": pool_timeout,
                "pool_recycle": pool_recycle,
                "pool_pre_ping": True,
                "pool_use_lifo": True,
            }
        )
    return kwargs


def _configure_sqlite_connection(dbapi_connection, _connection_record) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA busy_timeout=30000")
    cursor.close()


@lru_cache(maxsize=4)
def get_engine(database_url: str | None = None) -> Engine:
    url = database_url or get_settings().database_url
    engine = create_engine(url, **_engine_kwargs(url))
    if url.startswith("sqlite"):
        event.listen(engine, "connect", _configure_sqlite_connection)
    return engine


@lru_cache(maxsize=4)
def get_session_factory(database_url: str | None = None) -> sessionmaker[Session]:
    return sessionmaker(
        bind=get_engine(database_url),
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
        class_=Session,
    )


def get_db() -> Generator[Session, None, None]:
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()


def clear_db_caches() -> None:
    get_engine.cache_clear()
    get_session_factory.cache_clear()
