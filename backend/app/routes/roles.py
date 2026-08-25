from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.permission_checker import require_permission

from app.models.permission import Permission
from app.models.role import Role
from app.models.role_permission import RolePermission
from app.models.user import User
from app.models.user_role import UserRole

from app.schemas.permission import Permission as PermissionRead
from app.schemas.role import (
    Role as RoleRead,
    RoleCreate,
    RoleManagementRead,
    RolePermissionRead,
    RolePermissionUpdate,
    RoleUpdate,
)
from app.schemas.user import User as UserRead


router = APIRouter(
    prefix="/roles",
    tags=["Administration - Role Management"],
)


# ==========================================================
# Enterprise System Roles
# ==========================================================

SYSTEM_ROLES = {
    "Super Admin",
    "SuperAdmin",
}


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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )

    return role


def validate_system_role(
    role: Role,
) -> None:

    if role.name in SYSTEM_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="System role cannot be modified.",
        )


def validate_role_name(
    db: Session,
    name: str,
    exclude_role_id: int | None = None,
) -> None:

    normalized_name = name.strip()

    if not normalized_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Role name cannot be empty.",
        )

    query = (
        db.query(Role)
        .filter(
            func.lower(Role.name) == normalized_name.lower()
        )
    )

    if exclude_role_id is not None:
        query = query.filter(
            Role.id != exclude_role_id
        )

    if query.first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Role already exists.",
        )


def build_role_management_read(
    db: Session,
    role: Role,
) -> dict:

    user_count = (
        db.query(func.count(UserRole.id))
        .filter(
            UserRole.role_id == role.id
        )
        .scalar()
        or 0
    )

    permission_count = (
        db.query(func.count(RolePermission.id))
        .filter(
            RolePermission.role_id == role.id
        )
        .scalar()
        or 0
    )

    return {
        "id": role.id,
        "name": role.name,
        "description": role.description,
        "is_active": role.is_active,
        "created_at": role.created_at,
        "updated_at": role.updated_at,
        "user_count": user_count,
        "permission_count": permission_count,
    }


# ==========================================================
# GET /roles/statistics
# Must appear before /{role_id}
# ==========================================================

@router.get(
    "/statistics",
)
def role_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("admin.roles.read")
    ),
):

    total_roles = (
        db.query(func.count(Role.id))
        .scalar()
        or 0
    )

    active_roles = (
        db.query(func.count(Role.id))
        .filter(
            Role.is_active == True
        )
        .scalar()
        or 0
    )

    inactive_roles = (
        total_roles - active_roles
    )

    assigned_users = (
        db.query(
            func.count(
                func.distinct(UserRole.user_id)
            )
        )
        .scalar()
        or 0
    )

    role_assignments = (
        db.query(func.count(UserRole.id))
        .scalar()
        or 0
    )

    permissions = (
        db.query(func.count(Permission.id))
        .scalar()
        or 0
    )

    return {
        "total_roles": total_roles,
        "active_roles": active_roles,
        "inactive_roles": inactive_roles,
        "assigned_users": assigned_users,
        "role_assignments": role_assignments,
        "total_permissions": permissions,
    }


# ==========================================================
# GET /roles
# ==========================================================

@router.get(
    "/",
    response_model=list[RoleManagementRead],
)
def list_roles(
    keyword: str | None = Query(
        default=None,
        min_length=1,
    ),
    is_active: bool | None = Query(
        default=None,
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("admin.roles.read")
    ),
):

    query = db.query(Role)

    if keyword:
        search = keyword.strip()

        query = query.filter(
            Role.name.ilike(
                f"%{search}%"
            )
            |
            Role.description.ilike(
                f"%{search}%"
            )
        )

    if is_active is not None:
        query = query.filter(
            Role.is_active == is_active
        )

    roles = (
        query
        .order_by(
            Role.name.asc()
        )
        .all()
    )

    return [
        build_role_management_read(
            db,
            role,
        )
        for role in roles
    ]


# ==========================================================
# GET /roles/{role_id}
# ==========================================================

@router.get(
    "/{role_id}",
    response_model=RoleManagementRead,
)
def get_role(
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

    return build_role_management_read(
        db,
        role,
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

    validate_role_name(
        db,
        payload.name,
    )

    role = Role(
        name=payload.name.strip(),
        description=payload.description,
        is_active=payload.is_active,
    )

    db.add(role)

    try:
        db.commit()
        db.refresh(role)

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unable to create role.",
        )

    return role


# ==========================================================
# PUT /roles/{role_id}
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

    validate_system_role(role)

    data = payload.model_dump(
        exclude_unset=True
    )

    if "name" in data and data["name"] is not None:

        validate_role_name(
            db,
            data["name"],
            exclude_role_id=role.id,
        )

        data["name"] = data["name"].strip()

    for key, value in data.items():
        setattr(
            role,
            key,
            value,
        )

    db.commit()
    db.refresh(role)

    return role


# ==========================================================
# DELETE /roles/{role_id}
# Enterprise lifecycle:
# Deactivate instead of hard delete.
# ==========================================================

@router.delete(
    "/{role_id}",
)
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
        db.query(func.count(UserRole.id))
        .filter(
            UserRole.role_id == role.id
        )
        .scalar()
        or 0
    )

    if assigned_users > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Role is assigned to users. "
                "Remove all user assignments before "
                "deactivating the role."
            ),
        )

    role.is_active = False

    db.commit()

    return {
        "detail": "Role deactivated successfully.",
        "role_id": role.id,
        "is_active": False,
    }


# ==========================================================
# GET /roles/{role_id}/users
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

    return (
        db.query(User)
        .join(
            UserRole,
            UserRole.user_id == User.id,
        )
        .filter(
            UserRole.role_id == role.id
        )
        .order_by(
            User.email.asc()
        )
        .all()
    )


# ==========================================================
# GET /roles/{role_id}/permissions
# ==========================================================

@router.get(
    "/{role_id}/permissions",
    response_model=list[RolePermissionRead],
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

    return (
        db.query(Permission)
        .join(
            RolePermission,
            RolePermission.permission_id
            == Permission.id,
        )
        .filter(
            RolePermission.role_id == role.id
        )
        .order_by(
            Permission.code.asc()
        )
        .all()
    )


# ==========================================================
# PUT /roles/{role_id}/permissions
# Replace Role Permissions
# ==========================================================

@router.put(
    "/{role_id}/permissions",
)
def update_role_permissions(
    role_id: int,
    payload: RolePermissionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("admin.roles.update")
    ),
):

    role = get_role_or_404(
        db,
        role_id,
    )

    validate_system_role(role)

    permission_ids = list(
        dict.fromkeys(
            payload.permission_ids
        )
    )

    if permission_ids:

        permissions = (
            db.query(Permission)
            .filter(
                Permission.id.in_(
                    permission_ids
                )
            )
            .all()
        )

        found_ids = {
            permission.id
            for permission in permissions
        }

        invalid_ids = [
            permission_id
            for permission_id in permission_ids
            if permission_id not in found_ids
        ]

        if invalid_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": "One or more permission IDs are invalid.",
                    "invalid_permission_ids": invalid_ids,
                },
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

        db.add(
            RolePermission(
                role_id=role.id,
                permission_id=permission_id,
            )
        )

    db.commit()

    return {
        "detail": "Permissions updated successfully.",
        "role_id": role.id,
        "permission_count": len(
            permission_ids
        ),
    }


# ==========================================================
# GET /roles/{role_id}/permissions/available
# ==========================================================

@router.get(
    "/{role_id}/permissions/available",
    response_model=list[PermissionRead],
)
def get_available_permissions(
    role_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("permission.view")
    ),
):

    get_role_or_404(
        db,
        role_id,
    )

    return (
        db.query(Permission)
        .order_by(
            Permission.code.asc()
        )
        .all()
    )


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
    new_role_name: str = Query(
        ...,
        min_length=1,
        max_length=255,
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("admin.roles.create")
    ),
):

    source_role = get_role_or_404(
        db,
        role_id,
    )

    validate_role_name(
        db,
        new_role_name,
    )

    new_role = Role(
        name=new_role_name.strip(),
        description=source_role.description,
        is_active=True,
    )

    db.add(new_role)
    db.flush()

    permissions = (
        db.query(RolePermission)
        .filter(
            RolePermission.role_id
            == source_role.id
        )
        .all()
    )

    for role_permission in permissions:

        db.add(
            RolePermission(
                role_id=new_role.id,
                permission_id=(
                    role_permission.permission_id
                ),
            )
        )

    db.commit()
    db.refresh(new_role)

    return new_role
