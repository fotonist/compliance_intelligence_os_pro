from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.dependencies.permission_checker import require_permission

from app.models.role import Role
from app.models.user import User
from app.models.user_role import UserRole
from app.schemas.user import User as UserRead

from app.schemas.role import (
    Role as RoleRead,
    RoleCreate,
    RoleUpdate,
)

router = APIRouter(
    prefix="/roles",
    tags=["Administration - Role Management"],
)


# ==========================================================
# Helpers
# ==========================================================

def get_role_or_404(
    db: Session,
    role_id: int,
) -> Role:

    role = (
        db.query(Role)
        .filter(Role.id == role_id)
        .first()
    )

    if role is None:
        raise HTTPException(
            status_code=404,
            detail="Role not found",
        )

    return role


# ==========================================================
# GET /roles
# ==========================================================

@router.get(
    "/",
    response_model=list[RoleRead],
)
def list_roles(
    keyword: str | None = Query(None),

    db: Session = Depends(get_db),

    current_user: User = Depends(
        require_permission("admin.roles.read")
    ),
):

    query = db.query(Role)

    if keyword:
        query = query.filter(
            Role.name.ilike(f"%{keyword}%")
        )

    return (
        query
        .order_by(Role.name)
        .all()
    )


# ==========================================================
# GET /roles/{id}
# ==========================================================

@router.get(
    "/{role_id}",
    response_model=RoleRead,
)
def get_role(
    role_id: int,

    db: Session = Depends(get_db),

    current_user: User = Depends(
        require_permission("admin.roles.read")
    ),
):

    return get_role_or_404(
        db,
        role_id,
    )
    # ==========================================================
# POST /roles
# ==========================================================

@router.post(
    "/",
    response_model=RoleRead,
    status_code=status.HTTP_201_CREATED,
)
def create_role(
    payload: RoleCreate,

    db: Session = Depends(get_db),

    current_user: User = Depends(
        require_permission("admin.roles.create")
    ),
):

    existing = (
        db.query(Role)
        .filter(func.lower(Role.name) == payload.name.lower())
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Role already exists",
        )

    role = Role(
        name=payload.name,
        description=payload.description,
        is_active=True,
    )

    db.add(role)
    db.commit()
    db.refresh(role)

    return role


# ==========================================================
# PUT /roles/{id}
# ==========================================================

@router.put(
    "/{role_id}",
    response_model=RoleRead,
)
def update_role(
    role_id: int,
    payload: RoleUpdate,

    db: Session = Depends(get_db),

    current_user: User = Depends(
        require_permission("admin.roles.update")
    ),
):

    role = get_role_or_404(
        db,
        role_id,
    )

    data = payload.model_dump(
        exclude_unset=True
    )

    for key, value in data.items():
        setattr(role, key, value)

    db.commit()
    db.refresh(role)

    return role


# ==========================================================
# DELETE /roles/{id}
# Soft Delete
# ==========================================================

@router.delete("/{role_id}")
def delete_role(
    role_id: int,

    db: Session = Depends(get_db),

    current_user: User = Depends(
        require_permission("admin.roles.delete")
    ),
):

    role = get_role_or_404(
        db,
        role_id,
    )

    validate_system_role(role)

    assigned_users = (
        db.query(UserRole)
        .filter(
            UserRole.role_id == role.id
        )
        .count()
    )

    if assigned_users:
        raise HTTPException(
            status_code=409,
            detail="Role is assigned to users.",
        )

    db.delete(role)
    db.commit()

    return {
        "detail": "Role deleted successfully"
    }
    
# ==========================================================
# GET /roles/{id}/users
# ==========================================================

@router.get(
    "/{role_id}/users",
    response_model=list[UserRead],
)
def get_role_users(
    role_id: int,

    db: Session = Depends(get_db),

    current_user: User = Depends(
        require_permission("admin.roles.read")
    ),
):

    role = get_role_or_404(
        db,
        role_id,
    )

    return role.users


# ==========================================================
# GET /roles/statistics
# ==========================================================

@router.get("/statistics")
def role_statistics(

    db: Session = Depends(get_db),

    current_user: User = Depends(
        require_permission("admin.roles.read")
    ),
):

    total_roles = db.query(Role).count()

    active_roles = (
        db.query(Role)
        .filter(Role.is_active == True)
        .count()
    )

    assigned_users = (
        db.query(UserRole)
        .count()
    )

    return {

        "total_roles": total_roles,

        "active_roles": active_roles,

        "inactive_roles": total_roles - active_roles,

        "assigned_users": assigned_users,

    }


# ==========================================================
# POST /roles/{
# ==========================================================
# GET /roles/{role_id}/permissions
# ==========================================================

from app.models.permission import Permission
from app.models.role_permission import RolePermission
from app.schemas.permission import Permission as PermissionRead


@router.get(
    "/{role_id}/permissions",
    response_model=list[PermissionRead],
)
def get_role_permissions(
    role_id: int,

    db: Session = Depends(get_db),

    current_user: User = Depends(
        require_permission("roles.read")
    ),
):

    role = get_role_or_404(
        db,
        role_id,
    )

    permissions = (
        db.query(Permission)
        .join(
            RolePermission,
            RolePermission.permission_id == Permission.id,
        )
        .filter(
            RolePermission.role_id == role.id
        )
        .order_by(Permission.name)
        .all()
    )

    return permissions


# ==========================================================
# PUT /roles/{role_id}/permissions
# Replace Role Permissions
# ==========================================================

@router.put(
    "/{role_id}/permissions",
)
def update_role_permissions(
    role_id: int,

    permission_ids: list[int],

    db: Session = Depends(get_db),

    current_user: User = Depends(
        require_permission("admin.roles.update")
    ),
):

    role = get_role_or_404(
        db,
        role_id,
    )

    (
        db.query(RolePermission)
        .filter(
            RolePermission.role_id == role.id
        )
        .delete(
            synchronize_session=False
        )
    )

    for permission_id in permission_ids:

        permission = (
            db.query(Permission)
            .filter(
                Permission.id == permission_id
            )
            .first()
        )

        if permission is None:
            continue

        db.add(

            RolePermission(
                role_id=role.id,
                permission_id=permission.id,
            )

        )

    db.commit()

    return {
        "detail": "Permissions updated successfully"
    }
    # ==========================================================
# POST /roles/{role_id}/clone
# ==========================================================

@router.post(
    "/{role_id}/clone",
    response_model=RoleRead,
    status_code=status.HTTP_201_CREATED,
)
def clone_role(
    role_id: int,

    new_role_name: str,

    db: Session = Depends(get_db),

    current_user: User = Depends(
        require_permission("admin.roles.create")
    ),
):

    source_role = get_role_or_404(
        db,
        role_id,
    )

    existing = (
        db.query(Role)
        .filter(
            func.lower(Role.name) == new_role_name.lower()
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Role already exists",
        )

    new_role = Role(
        name=new_role_name,
        description=source_role.description,
        is_active=True,
    )

    db.add(new_role)
    db.flush()

    permissions = (
        db.query(RolePermission)
        .filter(
            RolePermission.role_id == source_role.id
        )
        .all()
    )

    for permission in permissions:

        db.add(

            RolePermission(
                role_id=new_role.id,
                permission_id=permission.permission_id,
            )

        )

    db.commit()

    db.refresh(new_role)

    return new_role
# ==========================================================
# Validation Helpers
# ==========================================================

SYSTEM_ROLES = {
    "Administrator",
    "Tenant Administrator",
}


def validate_system_role(role: Role):
    

    if role.name in SYSTEM_ROLES:

        raise HTTPException(
            status_code=403,
            detail="System role cannot be modified.",
        )