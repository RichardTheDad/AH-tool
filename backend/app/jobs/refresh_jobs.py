from __future__ import annotations

import logging

from app.core.config import get_settings
from app.db.session import get_session_factory
from app.schemas.scan import ScanRunRequest
from app.services.metadata_backfill_service import queue_missing_metadata_sweep
from app.services.listing_service import mark_stale_snapshots
from app.services.provider_service import get_provider_registry
from app.services.realm_service import get_enabled_realm_names
from app.services.scan_service import get_scan_readiness, run_scan


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
        readiness = get_scan_readiness(session)
        if not readiness.ready_for_scan and not provider.supports_live_fetch:
            logger.info("Skipping scheduled scan: %s", readiness.message)
            return

        run_scan(
            session,
            ScanRunRequest(
                provider_name=provider_name,
                refresh_live=provider.supports_live_fetch,
                include_losers=False,
            ),
        )
        queued = queue_missing_metadata_sweep(limit=200)
        if queued:
            logger.info("Queued scheduled metadata sweep for %s unresolved items.", queued)
    except Exception:  # pragma: no cover - scheduler safety
        logger.exception("Scheduled refresh cycle failed.")
    finally:
        session.close()
