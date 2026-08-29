from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    verify_password,
    create_access_token,
    get_current_user,
)
from app.db.session import get_db
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/token")
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form_data.username).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if user.email_verified_at is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email address must be verified before signing in.",
        )
    access_token = create_access_token(
        user=user,
        expires_delta=timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        ),
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.post("/logout")
def logout():
    return {"ok": True}


@router.get("/me")
def read_current_user(
    current_user: User = Depends(get_current_user),
):
    roles = [r.name for r in (current_user.roles or [])]

    return {
        "id": current_user.id,
        "username": current_user.email,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": roles[0] if roles else None,
        "roles": roles,
        "tenant_id": current_user.tenant_id,
    }
