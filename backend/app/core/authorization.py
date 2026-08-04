from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.role_permission import RolePermission
from app.models.permission import Permission
from app.models.user_role import UserRole


def resolve_user_permissions(user_id: int, db: Session):
    role_ids = [
        ur.role_id
        for ur in db.query(UserRole).filter(UserRole.user_id == user_id).all()
    ]

    if not role_ids:
        return set()

    permission_ids = [
        rp.permission_id
        for rp in db.query(RolePermission)
        .filter(RolePermission.role_id.in_(role_ids))
        .all()
    ]

    permissions = db.query(Permission).filter(
        Permission.id.in_(permission_ids)
    ).all()

    return {p.code for p in permissions}


def require_permissions(*required_codes: str):
    def dependency(
        user=Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        user_permissions = resolve_user_permissions(user.id, db)

        missing = [
            code for code in required_codes if code not in user_permissions
        ]

        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permissions: {missing}",
            )

        return user

    return dependency