from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import text

from app.core.config import get_settings
from app.db.session import get_session_factory
from app.jobs.refresh_jobs import run_refresh_cycle


logger = logging.getLogger(__name__)


REFRESH_CYCLE_ADVISORY_LOCK_KEY = 927531004


def _last_scan_session_at() -> datetime | None:
    """Return the UTC timestamp of the most recent ScanSession row, or None if none exist."""
    from sqlalchemy import func
    from app.db.models import ScanSession
    from app.db.session import get_session_factory

    session = get_session_factory()()
    try:
        result = session.query(func.max(ScanSession.generated_at)).scalar()
        if result is None:
            return None
        if result.tzinfo is None:
            return result.replace(tzinfo=timezone.utc)
        return result.astimezone(timezone.utc)
    finally:
        session.close()


class SchedulerManager:
    def __init__(self) -> None:
        self.scheduler = BackgroundScheduler(timezone="UTC")

    def start(self) -> None:
        if not self.scheduler.running:
            self.scheduler.start()
        self.reconfigure()

    def stop(self) -> None:
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)

    def reconfigure(self) -> None:
        # Policy:
        # 1) First eligibility check runs 1 minute after backend startup.
        # 2) After each check, schedule the next check exactly when the 65-minute
        #    scan eligibility window opens (based on the latest completed scan).
        now = datetime.now(timezone.utc)
        self._schedule_next_check(now + timedelta(minutes=1))

    def _schedule_next_check(self, run_at: datetime) -> None:
        self.scheduler.add_job(
            self._run_refresh_cycle_if_due,
            "date",
            id="refresh-cycle",
            replace_existing=True,
            run_date=run_at,
        )

    def _run_refresh_cycle_if_due(self) -> None:
        interval = get_settings().scheduler_refresh_interval_minutes
        now = datetime.now(timezone.utc)

        lock_session = None
        lock_acquired = False
        is_postgres = not get_settings().database_url.startswith("sqlite")

        if is_postgres:
            lock_session = get_session_factory()()
            try:
                lock_acquired = bool(
                    lock_session.execute(
                        text("SELECT pg_try_advisory_lock(:key)"),
                        {"key": REFRESH_CYCLE_ADVISORY_LOCK_KEY},
                    ).scalar()
                )
            except Exception:
                logger.exception("Scheduler lock acquisition failed; skipping this eligibility check.")
                lock_session.close()
                self._schedule_next_check(now + timedelta(minutes=1))
                return

            if not lock_acquired:
                logger.info("Skipping scheduler refresh check: another machine holds the refresh-cycle lock.")
                lock_session.close()
                self._schedule_next_check(now + timedelta(minutes=1))
                return

        try:
            try:
                last_before = _last_scan_session_at()
            except Exception:
                last_before = None

            should_run = last_before is None or (now - last_before) >= timedelta(minutes=interval)
            if should_run:
                logger.info("Scheduler eligibility check passed; starting refresh cycle.")
                run_refresh_cycle()
            else:
                logger.info("Scheduler eligibility check skipped; next run opens at %s.", (last_before + timedelta(minutes=interval)).isoformat())

            try:
                last_after = _last_scan_session_at()
            except Exception:
                last_after = None

            if last_after is None:
                # If we still have no completed scan timestamp, retry eligibility in 1 minute.
                next_run_time = now + timedelta(minutes=1)
            else:
                eligible_at = last_after + timedelta(minutes=interval)
                # Never schedule in the past to avoid immediate tight loops.
                next_run_time = eligible_at if eligible_at > now else now + timedelta(minutes=1)

            self._schedule_next_check(next_run_time)
        except Exception:
            logger.exception("Scheduler eligibility check crashed; scheduling retry in 1 minute.")
            try:
                self._schedule_next_check(datetime.now(timezone.utc) + timedelta(minutes=1))
            except Exception:
                logger.exception("Failed to schedule scheduler retry after crash.")
        finally:
            if lock_session is not None:
                try:
                    if lock_acquired:
                        lock_session.execute(
                            text("SELECT pg_advisory_unlock(:key)"),
                            {"key": REFRESH_CYCLE_ADVISORY_LOCK_KEY},
                        )
                except Exception:
                    logger.exception("Failed to release scheduler advisory lock.")
                finally:
                    lock_session.close()

            # Safety net: never leave the scheduler without a pending refresh job.
            if self.scheduler.get_job("refresh-cycle") is None:
                try:
                    self._schedule_next_check(datetime.now(timezone.utc) + timedelta(minutes=1))
                    logger.warning("Refresh-cycle job was missing; scheduled recovery check in 1 minute.")
                except Exception:
                    logger.exception("Failed to recover missing refresh-cycle job.")

    def status(self) -> dict[str, object]:
        refresh_job = self.scheduler.get_job("refresh-cycle")
        next_run_time = refresh_job.next_run_time if refresh_job else None
        if next_run_time is not None and next_run_time.tzinfo is None:
            next_run_time = next_run_time.replace(tzinfo=timezone.utc)

        try:
            last_scan = _last_scan_session_at()
        except Exception:
            last_scan = None

        return {
            "enabled": get_settings().enable_scheduler,
            "interval_minutes": get_settings().scheduler_refresh_interval_minutes,
            "running": self.scheduler.running,
            "jobs": [job.id for job in self.scheduler.get_jobs()],
            "refresh_cycle": {
                "configured": refresh_job is not None,
                "next_run_time": next_run_time.isoformat() if next_run_time else None,
            },
            "last_scan_session_at": last_scan.isoformat() if last_scan else None,
        }


manager = SchedulerManager()

