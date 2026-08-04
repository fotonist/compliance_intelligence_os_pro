from typing import List, Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.models.user_role_scopes import UserRoleScope


def get_user_scopes(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scopes = (
        db.query(UserRoleScope)
        .filter(UserRoleScope.user_id == user.id)
        .all()
    )

    return scopes


def require_process_scope(process_id: int):
    def checker(
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        scopes = (
            db.query(UserRoleScope)
            .filter(UserRoleScope.user_id == user.id)
            .all()
        )

        # tenant-wide kontrol
        for s in scopes:
            if s.process_id is None and s.standard_id is None:
                return user

        # process-level kontrol
        allowed = any(s.process_id == process_id for s in scopes)

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Process scope violation",
            )

        return user

    return checker
def require_tenant_scope():
    def checker(
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        scopes = (
            db.query(UserRoleScope)
            .filter(UserRoleScope.user_id == user.id)
            .all()
        )

        # tenant-wide = process_id NULL and standard_id NULL
        for s in scopes:
            if s.process_id is None and s.standard_id is None:
                return user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant-wide scope required",
        )

    return checker