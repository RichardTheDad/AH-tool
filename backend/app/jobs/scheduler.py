from __future__ import annotations

from datetime import datetime, timedelta, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.config import get_settings
from app.jobs.refresh_jobs import run_refresh_cycle


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
        interval = get_settings().scheduler_refresh_interval_minutes
        now = datetime.now(timezone.utc)

        try:
            last = _last_scan_session_at()
        except Exception:
            last = None

        if last is None or (now - last) >= timedelta(minutes=interval):
            # Either no scan has ever run, or we've been down long enough — fire immediately.
            next_run_time = now
        else:
            # Resume the window: schedule for when the next cycle would naturally be due.
            next_run_time = last + timedelta(minutes=interval)

        self.scheduler.add_job(
            run_refresh_cycle,
            "interval",
            id="refresh-cycle",
            replace_existing=True,
            minutes=interval,
            next_run_time=next_run_time,
        )

    def status(self) -> dict[str, object]:
        return {
            "running": self.scheduler.running,
            "jobs": [job.id for job in self.scheduler.get_jobs()],
        }


manager = SchedulerManager()

