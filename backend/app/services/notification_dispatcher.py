from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.notifications import (
    Notification,
    NotificationDelivery,
    NotificationPreference,
)
from app.services.notification_service import (
    EmailMessage,
    NotificationConfigurationError,
    NotificationDeliveryError,
    NotificationService,
    SMSMessage,
)


class NotificationDispatcher:
    MAX_ATTEMPTS = 3
    RETRY_DELAYS_SECONDS = {
        1: 60,
        2: 300,
    }

    @staticmethod
    def _utcnow() -> datetime:
        return datetime.now(timezone.utc)

    @staticmethod
    def _is_channel_enabled(
        db: Session,
        notification: Notification,
        channel: str,
    ) -> bool:
        if channel == "IN_APP":
            return True

        preference = (
            db.query(NotificationPreference)
            .filter(
                NotificationPreference.tenant_id == notification.tenant_id,
                NotificationPreference.user_id == notification.recipient_user_id,
                NotificationPreference.category == notification.category,
                NotificationPreference.channel == channel,
            )
            .first()
        )

        if preference is None:
            return True

        return bool(preference.enabled)

    @staticmethod
    def _retry_allowed(
        delivery: NotificationDelivery,
        now: datetime | None = None,
    ) -> bool:
        if delivery.status != "PENDING":
            return False

        attempt_count = delivery.attempt_count or 0

        if attempt_count == 0:
            return True

        if attempt_count >= NotificationDispatcher.MAX_ATTEMPTS:
            return False

        last_attempt_at = delivery.last_attempt_at

        if last_attempt_at is None:
            return True

        current_time = now or NotificationDispatcher._utcnow()

        if last_attempt_at.tzinfo is None:
            last_attempt_at = last_attempt_at.replace(
                tzinfo=timezone.utc
            )

        else:
            last_attempt_at = last_attempt_at.astimezone(
                timezone.utc
            )

        delay_seconds = NotificationDispatcher.RETRY_DELAYS_SECONDS.get(
            attempt_count,
            300,
        )

        return current_time >= (
            last_attempt_at
            + timedelta(seconds=delay_seconds)
        )

    @staticmethod
    def _mark_failed(
        db: Session,
        delivery: NotificationDelivery,
        message: str,
    ) -> None:
        delivery.status = "FAILED"
        delivery.failed_at = NotificationDispatcher._utcnow()
        delivery.error_message = message
        db.commit()

    @staticmethod
    def _send_delivery(
        db: Session,
        delivery: NotificationDelivery,
    ) -> None:
        notification = (
            db.query(Notification)
            .filter(
                Notification.id == delivery.notification_id,
            )
            .first()
        )

        if notification is None:
            NotificationDispatcher._mark_failed(
                db,
                delivery,
                "Notification record not found.",
            )
            return

        channel = delivery.channel.upper()

        if not NotificationDispatcher._is_channel_enabled(
            db,
            notification,
            channel,
        ):
            delivery.status = "SKIPPED"
            delivery.error_message = (
                "Delivery disabled by user preference."
            )
            db.commit()
            return

        if not NotificationDispatcher._retry_allowed(delivery):
            if (
                delivery.status == "PENDING"
                and (delivery.attempt_count or 0)
                >= NotificationDispatcher.MAX_ATTEMPTS
            ):
                NotificationDispatcher._mark_failed(
                    db,
                    delivery,
                    "Maximum delivery attempts reached.",
                )
            return

        delivery.attempt_count = (delivery.attempt_count or 0) + 1
        delivery.last_attempt_at = NotificationDispatcher._utcnow()
        delivery.error_message = None

        db.commit()

        try:
            if channel == "IN_APP":
                delivery.provider = "internal"
                delivery.provider_message_id = str(notification.id)

            elif channel == "EMAIL":
                recipient = notification.recipient

                if recipient is None or not recipient.email:
                    raise NotificationDeliveryError(
                        "Recipient email address is not available."
                    )

                provider_id = NotificationService.send_email(
                    EmailMessage(
                        to=recipient.email,
                        subject=notification.title,
                        html=(
                            f"<html><body>"
                            f"<h2>{notification.title}</h2>"
                            f"<p>{notification.message}</p>"
                            f"</body></html>"
                        ),
                        text=notification.message,
                    )
                )

                delivery.provider = "resend"
                delivery.provider_message_id = provider_id

            elif channel == "SMS":
                recipient = notification.recipient

                if recipient is None or not recipient.phone:
                    raise NotificationDeliveryError(
                        "Recipient phone number is not available."
                    )

                provider_id = NotificationService.send_sms(
                    SMSMessage(
                        to=recipient.phone,
                        body=notification.message,
                    )
                )

                delivery.provider = "twilio"
                delivery.provider_message_id = provider_id

            else:
                raise NotificationDeliveryError(
                    f"Unsupported notification channel: {channel}"
                )

            delivery.status = "SENT"
            delivery.delivered_at = NotificationDispatcher._utcnow()
            delivery.failed_at = None
            delivery.error_message = None

            db.commit()

        except NotificationConfigurationError as exc:
            NotificationDispatcher._mark_failed(
                db,
                delivery,
                str(exc),
            )

        except NotificationDeliveryError as exc:
            if delivery.attempt_count >= NotificationDispatcher.MAX_ATTEMPTS:
                NotificationDispatcher._mark_failed(
                    db,
                    delivery,
                    str(exc),
                )
            else:
                delivery.status = "PENDING"
                delivery.error_message = str(exc)
                db.commit()

        except Exception as exc:
            NotificationDispatcher._mark_failed(
                db,
                delivery,
                f"Unexpected delivery error: {exc}",
            )

    @staticmethod
    def dispatch_delivery(
        db: Session,
        delivery_id: int,
    ) -> NotificationDelivery | None:
        delivery = (
            db.query(NotificationDelivery)
            .filter(
                NotificationDelivery.id == delivery_id,
            )
            .first()
        )

        if delivery is None:
            return None

        if delivery.status in {
            "SENT",
            "SKIPPED",
            "FAILED",
        }:
            return delivery

        if not NotificationDispatcher._retry_allowed(delivery):
            return delivery

        NotificationDispatcher._send_delivery(
            db,
            delivery,
        )

        db.refresh(delivery)

        return delivery

    @staticmethod
    def dispatch_pending(
        db: Session,
        *,
        limit: int = 100,
    ) -> int:
        deliveries = (
            db.query(NotificationDelivery)
            .filter(
                NotificationDelivery.status == "PENDING",
            )
            .order_by(
                NotificationDelivery.created_at.asc(),
                NotificationDelivery.id.asc(),
            )
            .limit(limit)
            .all()
        )

        dispatched = 0
        now = NotificationDispatcher._utcnow()

        for delivery in deliveries:
            if not NotificationDispatcher._retry_allowed(
                delivery,
                now,
            ):
                continue

            NotificationDispatcher.dispatch_delivery(
                db,
                delivery.id,
            )

            dispatched += 1

        return dispatched

