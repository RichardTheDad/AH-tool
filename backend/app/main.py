from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.api import health, items, presets, providers, realm_suggestions, realms, scans, settings
from app.core.config import get_settings
from app.core.limiter import limiter
from app.core.logging import configure_logging
from app.db.init_db import create_db_and_tables, initialize_app_data
from app.db.session import get_session_factory
from app.jobs.scheduler import manager as scheduler_manager
from app.services.metadata_backfill_service import queue_missing_metadata_sweep


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging()
    create_db_and_tables()

    database_url = get_settings().database_url
    if database_url.startswith("sqlite"):
        session = get_session_factory()()
        try:
            initialize_app_data(session)
        finally:
            session.close()

        queue_missing_metadata_sweep(limit=250)
    # For PostgreSQL deployments, startup data initialization is handled by
    # Alembic migrations; the scheduler picks up pending work on its first cycle.

    if get_settings().enable_scheduler:
        scheduler_manager.start()
    yield
    scheduler_manager.stop()


def create_app() -> FastAPI:
    app = FastAPI(
        title=get_settings().api_title,
        version=get_settings().api_version,
        lifespan=lifespan,
    )
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_settings().cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    app.include_router(providers.router)
    app.include_router(realms.router)
    app.include_router(realm_suggestions.router)
    app.include_router(items.router)
    app.include_router(scans.router)
    app.include_router(presets.router)
    app.include_router(settings.router)
    return app


app = create_app()
