from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import resend
from twilio.rest import Client
from app.core.config import settings


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
