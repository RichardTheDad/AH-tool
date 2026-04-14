from __future__ import annotations

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.config import get_settings
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
        interval = get_settings().scheduler_refresh_interval_minutes
        self.scheduler.add_job(
            run_refresh_cycle,
            "interval",
            id="refresh-cycle",
            replace_existing=True,
            minutes=interval,
        )

    def status(self) -> dict[str, object]:
        return {
            "running": self.scheduler.running,
            "jobs": [job.id for job in self.scheduler.get_jobs()],
        }


manager = SchedulerManager()

