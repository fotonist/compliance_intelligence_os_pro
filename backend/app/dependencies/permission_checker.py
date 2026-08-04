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
    Route-level permission guard (SOFT MODE).

    Rules:
      1) If user has 'admin.full' => allow
      2) If user has no permissions (empty set) => allow (temporary compatibility mode)
      3) Else must include permission_code
    """

    def checker(
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        perms: Set[str] = resolve_user_permissions(db, user.id)

        # ✅ admin bypass
        if "admin.full" in perms:
            return user

        # ✅ soft mode: no perms means "do not break existing flows"
        if not perms:
            return user

        if permission_code not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {permission_code}",
            )

        return user

    return checker