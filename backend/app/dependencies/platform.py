from __future__ import annotations

from fastapi import Depends, HTTPException, status

from app.dependencies.auth import get_current_user
from app.models.user import User


def require_super_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    roles = {
        str(getattr(role, "name", role))
        .strip()
        .lower()
        .replace("-", "_")
        .replace(" ", "_")
        for role in (current_user.roles or [])
    }

    if "superadmin" not in roles and "super_admin" not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SuperAdmin role required",
        )

    return current_user
