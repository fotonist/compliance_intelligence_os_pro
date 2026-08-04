from __future__ import annotations

from typing import Set

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import SECRET_KEY, ALGORITHM
from app.models.user import User
from app.models.permission import Permission
from app.models.role_permission import RolePermission
from app.models.user_role import UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user


def resolve_user_permissions(db: Session, user_id: int) -> Set[str]:
    """
    DB-driven RBAC resolver:
      user_roles -> role_permissions -> permissions.code
    Returns: set of permission codes (e.g. {"admin.full", "matrix.read"})
    """
    rows = (
        db.query(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(UserRole, UserRole.role_id == RolePermission.role_id)
        .filter(UserRole.user_id == user_id)
        .all()
    )

    return {r[0] for r in rows}


def get_current_user_permissions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Set[str]:
    """
    Dependency helper: returns current user's permission set.
    """
    return resolve_user_permissions(db, user.id)