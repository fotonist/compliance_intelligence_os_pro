from __future__ import annotations

from typing import Callable, Set

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.dependencies.auth import resolve_user_permissions


def require_permission(permission_code: str) -> Callable:
    """
    Route-level permission guard.

    SuperAdmin is a platform-level role and bypasses individual permission
    checks. Existing admin.full and compatibility behavior are preserved.
    """

    def checker(
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        user_roles = {
            str(getattr(role, "name", role)).strip().lower()
            for role in (getattr(user, "roles", None) or [])
        }

        if "superadmin" in user_roles or "super_admin" in user_roles:
            return user

        perms: Set[str] = resolve_user_permissions(db, user.id)

        if "admin.full" in perms:
            return user

        if not perms:
            return user

        if permission_code not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {permission_code}",
            )

        return user

    return checker
