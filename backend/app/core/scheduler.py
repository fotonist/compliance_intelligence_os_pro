from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from app.jobs.readiness_snapshot_job import run_readiness_snapshot


def start_scheduler():
    scheduler = BackgroundScheduler(timezone="UTC")

    scheduler.add_job(
        run_readiness_snapshot,
        CronTrigger(hour=2, minute=0),
        id="readiness_snapshot_daily",
        replace_existing=True,
    )

    scheduler.start()