from __future__ import annotations

from enum import Enum

from fastapi import Depends, HTTPException, status

from app.core.security import get_current_user
from app.models.user import User


class Role(str, Enum):
    Admin = "Admin"
    SuperAdmin = "SuperAdmin"
    ComplianceOfficer = "ComplianceOfficer"
    ControlOwner = "ControlOwner"
    Auditor = "Auditor"


def _normalize_role(role: object) -> str:
    return str(role or "").strip().lower().replace("-", "_").replace(" ", "_")


def _user_roles(user: User) -> set[str]:
    token_roles = getattr(user, "_token_roles", None)
    if token_roles is not None:
        return {_normalize_role(role) for role in (token_roles or [])}

    return {
        _normalize_role(getattr(role, "name", role))
        for role in (getattr(user, "roles", None) or [])
    }


def is_super_admin(user: User) -> bool:
    return "superadmin" in _user_roles(user) or "super_admin" in _user_roles(user)


def require_roles(*allowed: Role):
    allowed_set = {_normalize_role(role.value) for role in allowed}

    def checker(current_user: User = Depends(get_current_user)):
        user_roles = _user_roles(current_user)

        # SuperAdmin is a platform-level role and bypasses module-specific RBAC.
        if is_super_admin(current_user):
            return current_user

        if not user_roles.intersection(allowed_set):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires roles: {sorted(allowed_set)}",
            )
        return current_user

    return checker


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if is_super_admin(current_user):
        return current_user

    if "admin" not in _user_roles(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return current_user
