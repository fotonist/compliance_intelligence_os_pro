from __future__ import annotations

import logging
import os
import signal
import time

from app.db.session import SessionLocal
from app.services.notification_dispatcher import NotificationDispatcher


logger = logging.getLogger("notification_worker")

POLL_INTERVAL_SECONDS = max(
    1,
    int(os.getenv("NOTIFICATION_WORKER_INTERVAL", "10")),
)

BATCH_SIZE = max(
    1,
    int(os.getenv("NOTIFICATION_WORKER_BATCH_SIZE", "100")),
)

_running = True


def _handle_shutdown(signum, frame) -> None:
    global _running

    logger.info(
        "Shutdown signal received: %s",
        signum,
    )

    _running = False


def run_once() -> int:
    db = SessionLocal()

    try:
        dispatched = NotificationDispatcher.dispatch_pending(
            db,
            limit=BATCH_SIZE,
        )

        if dispatched:
            logger.info(
                "Dispatched %s notification deliveries.",
                dispatched,
            )

        return dispatched

    except Exception:
        db.rollback()
        logger.exception(
            "Notification worker cycle failed."
        )
        return 0

    finally:
        db.close()


def run_forever() -> None:
    global _running

    signal.signal(
        signal.SIGINT,
        _handle_shutdown,
    )

    if hasattr(signal, "SIGTERM"):
        signal.signal(
            signal.SIGTERM,
            _handle_shutdown,
        )

    logger.info(
        "Notification worker started. interval=%ss batch=%s",
        POLL_INTERVAL_SECONDS,
        BATCH_SIZE,
    )

    while _running:
        run_once()

        if _running:
            time.sleep(POLL_INTERVAL_SECONDS)

    logger.info("Notification worker stopped.")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    run_forever()
