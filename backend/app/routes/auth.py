from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    verify_password,
    create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from app.core.audit import create_log
from app.models.user import User

router = APIRouter()


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


@router.post("/token")
def login_for_access_token(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    print("🔐 LOGIN ATTEMPT:", form_data.username)

    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        print("❌ AUTH FAILED")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    print("✅ AUTH OK | USER ID:", user.id)

    # security.create_access_token() is the canonical JWT builder.
    # Pass the complete User object so tenant context, roles and the
    # SuperAdmin flag are generated consistently in one place.
    access_token = create_access_token(
        user=user,
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    print("🎟️ TOKEN CREATED | LEN:", len(access_token))

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )

    print("🍪 COOKIE SET: access_token")

    create_log(
        db,
        user_id=user.id,
        action="login",
        entity="User",
        entity_id=user.id,
        detail="User logged in",
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }
