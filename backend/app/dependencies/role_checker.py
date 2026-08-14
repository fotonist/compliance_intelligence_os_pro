from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError

from app.core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


def _normalize_role(role: object) -> str:
    return str(role or "").strip().lower().replace("-", "_").replace(" ", "_")


def check_role(allowed_roles: list):
    """
    Token-based compatibility RBAC guard.

    SuperAdmin is a platform-level role and bypasses all role-specific
    restrictions. The guard accepts both the current `roles` claim and the
    legacy singular `role` claim.
    """

    normalized_allowed = {_normalize_role(role) for role in allowed_roles}

    def role_checker(token: str = Depends(oauth2_scheme)):
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
            )

            token_roles = payload.get("roles")
            if not isinstance(token_roles, list):
                token_roles = []

            singular_role = payload.get("role")
            if singular_role:
                token_roles.append(singular_role)

            normalized_roles = {
                _normalize_role(role) for role in token_roles if role
            }

            if "superadmin" in normalized_roles or "super_admin" in normalized_roles:
                return True

            if not normalized_roles:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Role not found in token",
                )

            if not normalized_roles.intersection(normalized_allowed):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied. Required roles: {allowed_roles}",
                )

            return True

        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )

    return role_checker
