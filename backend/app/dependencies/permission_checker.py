from __future__ import annotations

from typing import Callable, Set

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user, resolve_user_permissions
from app.models.user import User


# Canonical application permission codes are the codes stored in the
# permissions table. These aliases preserve compatibility with older
# Administration route contracts without requiring duplicate permissions.
PERMISSION_ALIASES = {
    "admin.users.read": {"user.view"},
    "admin.users.write": {"user.edit"},
    "admin.users.delete": {"user.edit"},
    "admin.roles.read": {"role.view"},
    "admin.roles.create": {"role.edit"},
    "admin.roles.update": {"role.edit"},
    "admin.roles.delete": {"role.edit"},
    "admin.roles.write": {"role.edit"},
    "roles.read": {"role.view"},
}


def _normalize_role(value: object) -> str:
    return (
        str(value or "")
        .strip()
        .lower()
        .replace("-", "_")
        .replace(" ", "_")
    )


def _required_permissions(permission_code: str) -> Set[str]:
    return {
        permission_code,
        *PERMISSION_ALIASES.get(permission_code, set()),
    }


def require_permission(permission_code: str) -> Callable:
    """
    Route-level permission guard.

    SuperAdmin is a platform-level role and bypasses individual permission
    checks. Existing admin.full behavior is preserved.

    Administration routes historically used admin.users.* / admin.roles.*
    permission names while the canonical permission matrix uses user.* and
    role.*. The compatibility aliases above allow both contracts to work.
    """

    def checker(
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        user_roles = {
            _normalize_role(getattr(role, "name", role))
            for role in (getattr(user, "roles", None) or [])
        }

        # Supports both "SuperAdmin" and "Super Admin" role names.
        if "superadmin" in user_roles or "super_admin" in user_roles:
            return user

        perms: Set[str] = resolve_user_permissions(db, user.id)

        if "admin.full" in perms:
            return user

        # Preserve the existing compatibility behavior for users whose
        # permission set has not yet been populated.
        if not perms:
            return user

        required = _required_permissions(permission_code)
        if not required.intersection(perms):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {permission_code}",
            )

        return user

    return checker
