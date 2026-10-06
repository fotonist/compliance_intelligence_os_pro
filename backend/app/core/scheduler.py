from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.db.session import SessionLocal
from app.services.notification_deadline_scanner import (
    scan_overdue_notifications,
)


logger = logging.getLogger("scheduler")

_scheduler: BackgroundScheduler | None = None


def run_readiness_snapshot_job() -> None:
    """
    Isolate the legacy readiness snapshot feature from scheduler startup.

    The readiness snapshot module currently has unresolved model/service
    dependencies. Import it only when the scheduled job actually runs so
    unrelated scheduler jobs remain operational.
    """
    try:
        from app.jobs.readiness_snapshot_job import (
            run_readiness_snapshot,
        )

        run_readiness_snapshot()

    except Exception:
        logger.exception(
            "Readiness snapshot job failed."
        )
        raise


def run_notification_deadline_scan() -> int:
    db = SessionLocal()

    try:
        generated = scan_overdue_notifications(db)

        if generated:
            logger.info(
                "Generated %s overdue notifications.",
                generated,
            )

        return generated

    except Exception:
        db.rollback()
        logger.exception(
            "Notification deadline scan failed."
        )
        raise

    finally:
        db.close()


def start_scheduler() -> BackgroundScheduler:
    global _scheduler

    if _scheduler is not None and _scheduler.running:
        return _scheduler

    scheduler = BackgroundScheduler(timezone="UTC")

    scheduler.add_job(
        run_readiness_snapshot_job,
        CronTrigger(hour=2, minute=0),
        id="readiness_snapshot_daily",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    scheduler.add_job(
        run_notification_deadline_scan,
        IntervalTrigger(minutes=5),
        id="notification_deadline_scan",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    scheduler.start()

    _scheduler = scheduler

    logger.info(
        "Application scheduler started."
    )

    return scheduler