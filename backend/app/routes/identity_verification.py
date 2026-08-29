from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.services.identity_verification_service import (
    IdentityVerificationError,
    IdentityVerificationService,
)

router = APIRouter(
    prefix="/identity-verification",
    tags=["identity-verification"],
)


@router.post("/email")
def request_email_verification(
    request: Request,
    db: Session = Depends(get_db),
):
    # Current authenticated user.
    # We intentionally resolve the user from the existing auth dependency
    # in the next integration step rather than accepting arbitrary user IDs.
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Email verification request endpoint is pending authentication integration.",
    )


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
