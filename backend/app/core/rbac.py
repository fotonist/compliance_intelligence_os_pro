from __future__ import annotations

from enum import Enum

from fastapi import Depends, HTTPException, status

from app.core.security import get_current_user
from app.models.user import User


class Role(str, Enum):
    Admin = "Admin"
    ComplianceOfficer = "ComplianceOfficer"
    ControlOwner = "ControlOwner"
    Auditor = "Auditor"


def _user_roles(user: User) -> set[str]:
    # Prefer roles from JWT claims (attached in get_current_user) to avoid
    # lazy-loading issues and to keep RBAC stateless.
    token_roles = getattr(user, "_token_roles", None)
    if token_roles is not None:
        return {str(r).lower() for r in (token_roles or [])}

    # Fallback to DB relationship if present
    return {str(getattr(r, "name", r)).lower() for r in (getattr(user, "roles", None) or [])}


def require_roles(*allowed: Role):
    # Normalize to lowercase for robust comparisons (admin/Admin etc.)
    allowed_set = {str(r.value).lower() for r in allowed}

    def checker(current_user: User = Depends(get_current_user)):
        user_roles = _user_roles(current_user)

        if not user_roles.intersection(allowed_set):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires roles: {sorted(allowed_set)}",
            )
        return current_user

    return checker


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if "admin" not in _user_roles(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return current_user
