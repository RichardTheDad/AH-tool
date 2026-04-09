from __future__ import annotations

import logging

from app.core.config import get_settings
from app.db.models import AppSettings
from app.db.init_db import purge_expired_app_data
from app.db.session import get_session_factory
from app.schemas.scan import ScanRunRequest
from app.services.metadata_backfill_service import queue_missing_metadata_sweep
from app.services.listing_service import mark_stale_snapshots
from app.services.provider_service import get_provider_registry
from app.services.realm_suggestion_service import run_realm_suggestions, should_refresh_realm_suggestions
from app.services.realm_service import get_enabled_realm_names
from app.services.scan_service import get_scan_readiness, run_scan


logger = logging.getLogger(__name__)


def run_refresh_cycle() -> None:
    session = get_session_factory()()
    try:
        purge_expired_app_data(session)
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
        app_settings = session.get(AppSettings, 1) or AppSettings(id=1)
        suggestion_cooldown_minutes = max(app_settings.refresh_interval_minutes * 4, 120)
        should_refresh_suggestions, latest_suggestion_run = should_refresh_realm_suggestions(
            session,
            cooldown_minutes=suggestion_cooldown_minutes,
        )
        if should_refresh_suggestions:
            suggestion_report = run_realm_suggestions(session)
            if suggestion_report.recommendations:
                logger.info(
                    "Updated Suggested Realms with %s recommendations across %s source realms.",
                    len(suggestion_report.recommendations),
                    suggestion_report.source_realm_count,
                )
            elif suggestion_report.warning_text:
                logger.info("Suggested Realms skipped or empty: %s", suggestion_report.warning_text)
        elif latest_suggestion_run is not None:
            logger.info(
                "Skipping Suggested Realms refresh: latest run for this target set is still within the %s-minute cooldown.",
                suggestion_cooldown_minutes,
            )
    except Exception:  # pragma: no cover - scheduler safety
        logger.exception("Scheduled refresh cycle failed.")
    finally:
        session.close()
