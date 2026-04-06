from __future__ import annotations

from apscheduler.schedulers.background import BackgroundScheduler

from app.db.models import AppSettings
from app.db.session import get_session_factory
from app.jobs.refresh_jobs import run_refresh_cycle


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
        session = get_session_factory()()
        try:
            app_settings = session.get(AppSettings, 1) or AppSettings(id=1)
            self.scheduler.add_job(
                run_refresh_cycle,
                "interval",
                id="refresh-cycle",
                replace_existing=True,
                minutes=app_settings.refresh_interval_minutes,
            )
        finally:
            session.close()

    def status(self) -> dict[str, object]:
        return {
            "running": self.scheduler.running,
            "jobs": [job.id for job in self.scheduler.get_jobs()],
        }


manager = SchedulerManager()

