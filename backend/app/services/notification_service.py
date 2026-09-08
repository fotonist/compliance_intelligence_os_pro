from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Sequence

import resend
from twilio.rest import Client
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.db.base import Base
from app.services.notification_events import NotificationEvent
from app.models.notifications import (
    Notification,
    NotificationDelivery,
    NotificationPreference,
)


class NotificationConfigurationError(RuntimeError):
    """Raised when a notification provider is not configured."""


class NotificationDeliveryError(RuntimeError):
    """Raised when a notification provider rejects delivery."""


@dataclass(frozen=True)
class EmailMessage:
    to: str | Sequence[str]
    subject: str
    html: str
    text: str | None = None


@dataclass(frozen=True)
class SMSMessage:
    to: str
    body: str


class NotificationService:
    """
    Provider abstraction for enterprise identity notifications.

    Email is delivered through Resend.
    SMS is delivered through Twilio.

    Provider credentials are read from environment variables and are
    never persisted in application data.
    """

    @staticmethod
    def send_email(message: EmailMessage) -> str:
        api_key = (settings.RESEND_API_KEY or "").strip()
        sender = (settings.EMAIL_FROM or "").strip()
        sender_name = (settings.EMAIL_FROM_NAME or "").strip()

        if not api_key:
            raise NotificationConfigurationError(
                "Email delivery is not configured."
            )

        if not sender:
            raise NotificationConfigurationError(
                "Email sender is not configured."
            )

        resend.api_key = api_key

        from_address = (
            f"{sender_name} <{sender}>"
            if sender_name
            else sender
        )

        params: resend.Emails.SendParams = {
            "from": from_address,
            "to": message.to,
            "subject": message.subject,
            "html": message.html,
        }

        if message.text:
            params["text"] = message.text

        try:
            response = resend.Emails.send(params)
        except Exception as exc:
            raise NotificationDeliveryError(
                "Email delivery failed."
            ) from exc

        response_id = getattr(response, "id", None)

        if not response_id:
            raise NotificationDeliveryError(
                "Email provider returned no delivery identifier."
            )

        return str(response_id)

    @staticmethod
    def send_sms(message: SMSMessage) -> str:
        account_sid = (settings.TWILIO_ACCOUNT_SID or "").strip()
        auth_token = (settings.TWILIO_AUTH_TOKEN or "").strip()
        from_number = (settings.TWILIO_FROM_NUMBER or "").strip()

        if not account_sid or not auth_token:
            raise NotificationConfigurationError(
                "SMS delivery is not configured."
            )

        if not from_number:
            raise NotificationConfigurationError(
                "SMS sender is not configured."
            )

        try:
            client = Client(
                account_sid,
                auth_token,
            )

            result = client.messages.create(
                body=message.body,
                from_=from_number,
                to=message.to,
            )
        except Exception as exc:
            raise NotificationDeliveryError(
                "SMS delivery failed."
            ) from exc

        if not result.sid:
            raise NotificationDeliveryError(
                "SMS provider returned no delivery identifier."
            )

        return str(result.sid)


class NotificationManager:

    @staticmethod
    def emit(
        db: Session,
        event: NotificationEvent,
        recipient_user_id: int,
        *,
        channels: Sequence[str] | None = None,
    ) -> Notification:
        notification = Notification(
            tenant_id=event.tenant_id,
            recipient_user_id=recipient_user_id,
            category=event.category,
            severity=event.payload.get("severity", "INFO"),
            title=event.title,
            message=event.message,
            entity_type=event.entity_type,
            entity_id=event.entity_id,
            action_url=event.payload.get("action_url"),
            is_read=False,
        )

        db.add(notification)
        db.flush()

        requested_channels = list(
            channels
            if channels is not None
            else ["IN_APP"]
        )

        existing_channels: set[str] = set()

        for channel in requested_channels:
            if channel in existing_channels:
                continue

            existing_channels.add(channel)

            delivery = NotificationDelivery(
                notification_id=notification.id,
                channel=channel,
                status="PENDING",
                attempt_count=0,
            )

            db.add(delivery)

        db.commit()
        db.refresh(notification)

        return notification
    @staticmethod
    def list_user_notifications(
        db: Session,
        user_id: int,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        category: str | None = None,
        severity: str | None = None,
        channel: str | None = None,
        unread_only: bool = False,
    ) -> tuple[list[Notification], int, int]:
        query = db.query(Notification).filter(
            Notification.tenant_id == tenant_id,
            Notification.recipient_user_id == user_id,
        )

        if category:
            query = query.filter(Notification.category == category)

        if severity:
            query = query.filter(Notification.severity == severity)

        if unread_only:
            query = query.filter(Notification.is_read.is_(False))

        if channel:
            query = query.join(NotificationDelivery).filter(
                NotificationDelivery.channel == channel
            )

        total = query.with_entities(
            func.count(func.distinct(Notification.id))
        ).scalar() or 0

        unread = db.query(func.count(Notification.id)).filter(
            Notification.tenant_id == tenant_id,
            Notification.recipient_user_id == user_id,
            Notification.is_read.is_(False),
        ).scalar() or 0

        items = (
            query.options(joinedload(Notification.deliveries))
            .order_by(
                Notification.created_at.desc(),
                Notification.id.desc(),
            )
            .offset(skip)
            .limit(limit)
            .all()
        )

        return items, int(total), int(unread)

    @staticmethod
    def get_user_notification(
        db: Session,
        notification_id: int,
        user_id: int,
        tenant_id: int,
    ) -> Notification | None:
        return (
            db.query(Notification)
            .options(joinedload(Notification.deliveries))
            .filter(
                Notification.id == notification_id,
                Notification.tenant_id == tenant_id,
                Notification.recipient_user_id == user_id,
            )
            .first()
        )

    @staticmethod
    def mark_read(
        db: Session,
        notification: Notification,
    ) -> Notification:
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(notification)

        return notification

    @staticmethod
    def mark_all_read(
        db: Session,
        user_id: int,
        tenant_id: int,
    ) -> int:
        now = datetime.now(timezone.utc)

        updated = (
            db.query(Notification)
            .filter(
                Notification.tenant_id == tenant_id,
                Notification.recipient_user_id == user_id,
                Notification.is_read.is_(False),
            )
            .update(
                {
                    Notification.is_read: True,
                    Notification.read_at: now,
                },
                synchronize_session=False,
            )
        )

        db.commit()
        return int(updated)

    @staticmethod
    def get_preferences(
        db: Session,
        user_id: int,
        tenant_id: int,
    ) -> list[NotificationPreference]:
        return (
            db.query(NotificationPreference)
            .filter(
                NotificationPreference.tenant_id == tenant_id,
                NotificationPreference.user_id == user_id,
            )
            .order_by(
                NotificationPreference.category,
                NotificationPreference.channel,
            )
            .all()
        )

    @staticmethod
    def update_preference(
        db: Session,
        user_id: int,
        tenant_id: int,
        category: str,
        channel: str,
        enabled: bool,
    ) -> NotificationPreference:
        preference = (
            db.query(NotificationPreference)
            .filter(
                NotificationPreference.tenant_id == tenant_id,
                NotificationPreference.user_id == user_id,
                NotificationPreference.category == category,
                NotificationPreference.channel == channel,
            )
            .first()
        )

        if preference is None:
            preference = NotificationPreference(
                tenant_id=tenant_id,
                user_id=user_id,
                category=category,
                channel=channel,
                enabled=enabled,
            )
            db.add(preference)
        else:
            preference.enabled = enabled

        db.commit()
        db.refresh(preference)

        return preference

    @staticmethod
    def get_admin_notification(
        db: Session,
        notification_id: int,
        tenant_id: int,
    ) -> Notification | None:
        return (
            db.query(Notification)
            .options(
                joinedload(Notification.deliveries),
                joinedload(Notification.recipient),
            )
            .filter(
                Notification.id == notification_id,
                Notification.tenant_id == tenant_id,
            )
            .first()
        )

    @staticmethod
    def list_admin_notifications(
        db: Session,
        tenant_id: int,
        *,
        skip: int = 0,
        limit: int = 50,
        category: str | None = None,
        severity: str | None = None,
        status: str | None = None,
    ) -> tuple[list[Notification], int, int, int]:
        query = db.query(Notification).filter(
            Notification.tenant_id == tenant_id
        )

        if category:
            query = query.filter(Notification.category == category)

        if severity:
            query = query.filter(Notification.severity == severity)

        if status:
            query = query.join(NotificationDelivery).filter(
                NotificationDelivery.status == status
            )

        total = query.with_entities(
            func.count(func.distinct(Notification.id))
        ).scalar() or 0

        unread = db.query(func.count(Notification.id)).filter(
            Notification.tenant_id == tenant_id,
            Notification.is_read.is_(False),
        ).scalar() or 0

        failed = (
            db.query(func.count(NotificationDelivery.id))
            .join(
                Notification,
                Notification.id == NotificationDelivery.notification_id,
            )
            .filter(
                Notification.tenant_id == tenant_id,
                NotificationDelivery.status == "FAILED",
            )
            .scalar()
            or 0
        )

        items = (
            query.options(
                joinedload(Notification.deliveries),
                joinedload(Notification.recipient),
            )
            .order_by(
                Notification.created_at.desc(),
                Notification.id.desc(),
            )
            .offset(skip)
            .limit(limit)
            .all()
        )

        return items, int(total), int(unread), int(failed)


