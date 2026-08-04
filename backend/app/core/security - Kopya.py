from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import os

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db
from app.models.user import User


# -------------------------------------------------------------------
# JWT CONFIG
# -------------------------------------------------------------------
SECRET_KEY = os.getenv("SECRET_KEY", "CHANGE_THIS_SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# ✅ Swagger Security Scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


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
        "tenant_id": user.tenant_id,
        "roles": [r.name for r in (user.roles or [])],
        "exp": datetime.utcnow()
        + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)),
    }

    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# -------------------------------------------------------------------
# AUTH
# -------------------------------------------------------------------
def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:

    if token.count(".") != 2:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format",
        )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
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

    token_tenant_id = payload.get("tenant_id")
    if token_tenant_id is None or int(token_tenant_id) != int(user.tenant_id):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid tenant context",
        )

    db.execute(text("SET LOCAL app.tenant_id = :tid"), {"tid": str(user.tenant_id)})

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
