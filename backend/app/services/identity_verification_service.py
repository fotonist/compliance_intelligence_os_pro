from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.settings import VERIFICATION_TOKEN_EXPIRE_MINUTES
from app.models.identity_verification_token import IdentityVerificationToken
from app.models.user import User
from app.services.notification_service import (
    EmailMessage,
    NotificationConfigurationError,
    NotificationDeliveryError,
    NotificationService,
    SMSMessage,
)


class IdentityVerificationError(RuntimeError):
    """Base exception for identity verification failures."""


class IdentityVerificationService:
    CHANNEL_EMAIL = "email"
    CHANNEL_PHONE = "phone"

    @staticmethod
    def _utcnow() -> datetime:
        return datetime.utcnow()

    @staticmethod
    def _hash_token(token: str) -> str:
        return hashlib.sha256(
            token.encode("utf-8")
        ).hexdigest()

    @classmethod
    def _invalidate_previous_tokens(
        cls,
        db: Session,
        user: User,
        channel: str,
    ) -> None:
        now = cls._utcnow()

        previous_tokens = (
            db.query(IdentityVerificationToken)
            .filter(
                IdentityVerificationToken.user_id == user.id,
                IdentityVerificationToken.channel == channel,
                IdentityVerificationToken.consumed_at.is_(None),
                IdentityVerificationToken.expires_at > now,
            )
            .all()
        )

        for previous in previous_tokens:
            previous.consumed_at = now

    @classmethod
    def _store_token(
        cls,
        db: Session,
        user: User,
        channel: str,
        raw_token: str,
    ) -> None:
        now = cls._utcnow()

        cls._invalidate_previous_tokens(
            db=db,
            user=user,
            channel=channel,
        )

        token_record = IdentityVerificationToken(
            user_id=user.id,
            channel=channel,
            token_hash=cls._hash_token(raw_token),
            expires_at=now + timedelta(
                minutes=VERIFICATION_TOKEN_EXPIRE_MINUTES
            ),
        )

        db.add(token_record)
        db.commit()

    @classmethod
    def issue_email_verification(
        cls,
        db: Session,
        user: User,
        verification_base_url: str,
    ) -> str:
        if not user.email:
            raise IdentityVerificationError(
                "User does not have an email address."
            )

        if user.email_verified_at is not None:
            raise IdentityVerificationError(
                "Email address is already verified."
            )

        raw_token = secrets.token_urlsafe(48)

        cls._store_token(
            db=db,
            user=user,
            channel=cls.CHANNEL_EMAIL,
            raw_token=raw_token,
        )

        verification_url = (
            f"{verification_base_url.rstrip('/')}"
            f"/verify-email?token={raw_token}"
        )

        message = EmailMessage(
            to=user.email,
            subject="Verify your email address",
            html=f"""
<!doctype html>
<html>
  <body style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.6;">
    <div style="max-width:600px;margin:0 auto;padding:32px;">
      <h2>Verify your email address</h2>

      <p>Hello {user.full_name or "there"},</p>

      <p>
        Please verify your email address for
        <strong>Compliance Intelligence OS</strong>.
      </p>

      <p>
        <a
          href="{verification_url}"
          style="
            display:inline-block;
            padding:12px 18px;
            background:#0f172a;
            color:#ffffff;
            text-decoration:none;
            border-radius:8px;
          "
        >
          Verify email address
        </a>
      </p>

      <p>
        This verification link expires in
        {VERIFICATION_TOKEN_EXPIRE_MINUTES} minutes.
      </p>

      <p style="font-size:13px;color:#64748b;">
        If you did not request this verification, you can safely ignore
        this message.
      </p>
    </div>
  </body>
</html>
""",
            text=(
                "Verify your email address for Compliance Intelligence OS.\n\n"
                f"Verification link: {verification_url}\n\n"
                f"This link expires in "
                f"{VERIFICATION_TOKEN_EXPIRE_MINUTES} minutes."
            ),
        )

        try:
            return NotificationService.send_email(message)
        except (
            NotificationConfigurationError,
            NotificationDeliveryError,
        ) as exc:
            raise IdentityVerificationError(
                str(exc)
            ) from exc

    @classmethod
    def issue_phone_verification(
        cls,
        db: Session,
        user: User,
    ) -> str:
        if not user.phone:
            raise IdentityVerificationError(
                "User does not have a phone number."
            )

        if user.phone_verified_at is not None:
            raise IdentityVerificationError(
                "Phone number is already verified."
            )

        # Cryptographically random six-digit OTP.
        code = str(
            secrets.randbelow(1_000_000)
        ).zfill(6)

        cls._store_token(
            db=db,
            user=user,
            channel=cls.CHANNEL_PHONE,
            raw_token=code,
        )

        message = SMSMessage(
            to=user.phone,
            body=(
                "Compliance Intelligence OS verification code: "
                f"{code}. "
                f"Valid for {VERIFICATION_TOKEN_EXPIRE_MINUTES} minutes."
            ),
        )

        try:
            return NotificationService.send_sms(message)
        except (
            NotificationConfigurationError,
            NotificationDeliveryError,
        ) as exc:
            raise IdentityVerificationError(
                str(exc)
            ) from exc

    @classmethod
    def verify(
        cls,
        db: Session,
        raw_token: str,
        channel: str,
    ) -> User:
        if not raw_token:
            raise IdentityVerificationError(
                "Verification token is required."
            )

        if channel not in {
            cls.CHANNEL_EMAIL,
            cls.CHANNEL_PHONE,
        }:
            raise IdentityVerificationError(
                "Unsupported verification channel."
            )

        token_hash = cls._hash_token(raw_token)
        now = cls._utcnow()

        record = (
            db.query(IdentityVerificationToken)
            .filter(
                IdentityVerificationToken.token_hash == token_hash,
                IdentityVerificationToken.channel == channel,
            )
            .first()
        )

        if not record:
            raise IdentityVerificationError(
                "Invalid verification token."
            )

        if record.consumed_at is not None:
            user = (
                db.query(User)
                .filter(User.id == record.user_id)
                .first()
            )

            if not user:
                raise IdentityVerificationError(
                    "User associated with verification token was not found."
                )

            if channel == cls.CHANNEL_EMAIL:
                if user.email_verified_at is not None:
                    return user
            else:
                if user.phone_verified_at is not None:
                    return user

            raise IdentityVerificationError(
                "Verification token has already been used."
            )

        if record.expires_at <= now:
            raise IdentityVerificationError(
                "Verification token has expired."
            )

        user = (
            db.query(User)
            .filter(User.id == record.user_id)
            .first()
        )

        if not user:
            raise IdentityVerificationError(
                "User associated with verification token was not found."
            )

        record.consumed_at = now

        if channel == cls.CHANNEL_EMAIL:
            user.email_verified_at = now
        else:
            user.phone_verified_at = now

        db.commit()
        db.refresh(user)

        return user
