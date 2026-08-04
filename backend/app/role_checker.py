from fastapi import Depends, HTTPException, status
from app.services.auth_service import get_current_user


class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user=Depends(get_current_user)):

        # Admin her şeye erişebilir
        if any(role.name == "Admin" for role in current_user.roles):
            return current_user

        # Kullanıcı izin verilen rollerden birine sahipse erişebilir
        if any(role.name in self.allowed_roles for role in current_user.roles):
            return current_user

        # Aksi halde erişim reddedilir
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için yetkiniz bulunmuyor",
        )
