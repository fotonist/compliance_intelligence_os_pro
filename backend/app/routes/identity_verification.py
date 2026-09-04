from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.settings import FRONTEND_BASE_URL
from app.models.user import User
from app.services.identity_verification_service import (
    IdentityVerificationError,
    IdentityVerificationService,
)

router = APIRouter(
    prefix="/identity-verification",
    tags=["identity-verification"],
)


@router.post("/email/resend")
def resend_email_verification(
    email: str,
    db: Session = Depends(get_db),
):
    """
    Issue a new email verification token.

    This endpoint intentionally returns the same generic response whether
    the account exists, is already verified, or the delivery operation
    cannot be completed. This prevents user enumeration through the
    verification workflow.
    """

    normalized_email = email.strip().lower()

    if not normalized_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email address is required.",
        )

    user = (
        db.query(User)
        .filter(User.email == normalized_email)
        .first()
    )

    generic_response = {
        "success": True,
        "message": (
            "If an account exists for this email address and "
            "verification is required, a new verification email "
            "has been requested."
        ),
    }

    # Do not reveal whether the account exists.
    if not user:
        return generic_response

    # Already verified accounts do not receive another verification email.
    if user.email_verified_at is not None:
        return generic_response

    try:
        IdentityVerificationService.issue_email_verification(
            db=db,
            user=user,
            verification_base_url=FRONTEND_BASE_URL,
        )
    except IdentityVerificationError:
        # Do not expose provider configuration or delivery details.
        # The application logs can be used to diagnose delivery failures.
        return generic_response

    return generic_response


@router.get("/email/verify")
def verify_email(
    token: str = Query(..., min_length=20),
    db: Session = Depends(get_db),
):
    try:
        user = IdentityVerificationService.verify(
            db=db,
            raw_token=token,
            channel=IdentityVerificationService.CHANNEL_EMAIL,
        )
    except IdentityVerificationError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    return {
        "verified": True,
        "channel": "email",
        "user_id": user.id,
        "email": user.email,
    }
