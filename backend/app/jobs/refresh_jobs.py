from __future__ import annotations

import logging

from app.core.config import get_settings
from app.db.session import get_session_factory
from app.schemas.scan import ScanRunRequest
from app.services.listing_service import mark_stale_snapshots
from app.services.provider_service import get_provider_registry
from app.services.realm_service import get_enabled_realm_names
from app.services.scan_service import run_scan


logger = logging.getLogger(__name__)


def run_refresh_cycle() -> None:
    session = get_session_factory()()
    try:
        mark_stale_snapshots(session)
        realms = get_enabled_realm_names(session)
        if not realms:
            logger.info("Skipping scheduled scan: no enabled realms.")
            return

        provider_name = get_settings().default_listing_provider
        provider = get_provider_registry().get_listing_provider(None)
        run_scan(
            session,
            ScanRunRequest(
                provider_name=provider_name,
                refresh_live=provider.supports_live_fetch,
                include_losers=False,
            ),
        )
    except Exception:  # pragma: no cover - scheduler safety
        logger.exception("Scheduled refresh cycle failed.")
    finally:
        session.close()
