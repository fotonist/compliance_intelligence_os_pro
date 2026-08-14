from fastapi import Depends, HTTPException, status
from app.services.auth_service import get_current_user


def _normalize_role(role: object) -> str:
    return str(role or "").strip().lower().replace("-", "_").replace(" ", "_")


class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user=Depends(get_current_user)):
        user_roles = {
            _normalize_role(role.name)
            for role in (getattr(current_user, "roles", None) or [])
        }

        # SuperAdmin is platform-level and is not constrained by module role lists.
        if "superadmin" in user_roles or "super_admin" in user_roles:
            return current_user

        allowed_roles = {
            _normalize_role(role) for role in self.allowed_roles
        }

        # Existing Admin compatibility behavior is preserved.
        if "admin" in user_roles:
            return current_user

        if user_roles.intersection(allowed_roles):
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için yetkiniz bulunmuyor",
        )
