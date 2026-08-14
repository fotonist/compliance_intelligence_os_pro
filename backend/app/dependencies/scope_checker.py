from typing import List, Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user, resolve_user_permissions
from app.models.user import User
from app.models.user_role_scopes import UserRoleScope


def get_user_scopes(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scopes = (
        db.query(UserRoleScope)
        .filter(
            UserRoleScope.user_id == user.id,
            UserRoleScope.tenant_id == user.tenant_id,
        )
        .all()
    )

    return scopes


def _has_tenant_wide_access(user: User, db: Session) -> bool:
    """
    Tenant-wide access is granted by either:
      1. an explicit tenant-wide UserRoleScope, or
      2. a platform/admin permission that already represents unrestricted
         tenant access (admin.full), or
      3. a platform-level SuperAdmin role.

    This keeps RBAC and scope enforcement aligned instead of requiring an
    additional database scope row for users who already have unrestricted
    administrative access.
    """
    user_roles = {
        str(getattr(role, "name", role)).strip().lower()
        for role in (getattr(user, "roles", None) or [])
    }

    if "superadmin" in user_roles or "super_admin" in user_roles:
        return True

    permissions = resolve_user_permissions(db, user.id)
    if "admin.full" in permissions:
        return True

    return (
        db.query(UserRoleScope)
        .filter(
            UserRoleScope.user_id == user.id,
            UserRoleScope.tenant_id == user.tenant_id,
            UserRoleScope.process_id.is_(None),
            UserRoleScope.standard_id.is_(None),
        )
        .first()
        is not None
    )


def require_process_scope(process_id: int):
    def checker(
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        if _has_tenant_wide_access(user, db):
            return user

        allowed = (
            db.query(UserRoleScope)
            .filter(
                UserRoleScope.user_id == user.id,
                UserRoleScope.tenant_id == user.tenant_id,
                UserRoleScope.process_id == process_id,
            )
            .first()
            is not None
        )

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
        if _has_tenant_wide_access(user, db):
            return user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant-wide scope required",
        )

    return checker
