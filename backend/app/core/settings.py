from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import os

from fastapi import Depends, HTTPException, Request, status
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User

# -------------------------------------------------------------------
# JWT CONFIG
# -------------------------------------------------------------------
SECRET_KEY = os.getenv("SECRET_KEY", "CHANGE_THIS_SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
# -------------------------------------------------------------------
# IDENTITY / NOTIFICATION CONFIG
# -------------------------------------------------------------------
EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER", "resend")
EMAIL_FROM = os.getenv("EMAIL_FROM", "")
EMAIL_FROM_NAME = os.getenv(
    "EMAIL_FROM_NAME",
    "Compliance Intelligence OS",
)

SMS_PROVIDER = os.getenv("SMS_PROVIDER", "twilio")
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "")

MFA_ISSUER = os.getenv(
    "MFA_ISSUER",
    "Compliance Intelligence OS",
)

VERIFICATION_TOKEN_EXPIRE_MINUTES = int(
    os.getenv(
        "VERIFICATION_TOKEN_EXPIRE_MINUTES",
        "30",
    )
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# -------------------------------------------------------------------
# PASSWORD
# -------------------------------------------------------------------
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

# -------------------------------------------------------------------
# TOKEN
# -------------------------------------------------------------------
def create_access_token(
    *,
    user: User,
    expires_delta: Optional[timedelta] = None,
) -> str:
    payload: Dict[str, Any] = {
        "sub": str(user.id),
        "user_id": user.id,
        "roles": [r.name for r in (user.roles or [])],
        "exp": datetime.utcnow()
        + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)),
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

# -------------------------------------------------------------------
# AUTH
# -------------------------------------------------------------------
def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    # ✅ DEBUG SADECE FONKSİYON İÇİNDE
    auth_header = request.headers.get("Authorization")
    print("AUTH HEADER:", auth_header)

    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    token = auth_header.split(" ")[1]

    if token.count(".") != 2:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format",
        )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as e:
        print("JWT decode error:", e)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    user_id = payload.get("user_id") or payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user

# -------------------------------------------------------------------
# RBAC
# -------------------------------------------------------------------
def require_roles(*allowed_roles: str):
    def _checker(user: User = Depends(get_current_user)):
        user_roles = {r.name for r in (user.roles or [])}
        if not user_roles.intersection(set(allowed_roles)):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return _checker


# -------------------------------------------------------------------
# IDENTITY VERIFICATION
# -------------------------------------------------------------------
FRONTEND_BASE_URL = os.getenv(
    "FRONTEND_BASE_URL",
    "http://localhost:3000",
).rstrip("/")
