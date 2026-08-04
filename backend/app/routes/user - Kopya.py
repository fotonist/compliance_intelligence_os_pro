from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.models.role import Role
from app.models.user_role import UserRole

from app.schemas.user import User as UserRead
from app.schemas.role import Role as RoleRead

from app.dependencies.permission_checker import require_permission
from app.dependencies.scope_checker import require_tenant_scope

router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


# ------------------------------------------------
# GET /users → TenantAdmin only
# ------------------------------------------------

@router.get("/", response_model=list[UserRead])
def list_users(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("admin.users.read")),
    scope=Depends(require_tenant_scope()),
):
    return db.query(User).filter(
        User.tenant_id == user.tenant_id
    ).all()


# ------------------------------------------------
# GET /users/{user_id}
# CRITICAL FIX: int constraint
# ------------------------------------------------

@router.get("/{user_id:int}", response_model=UserRead)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("admin.users.read")),
    scope=Depends(require_tenant_scope()),
):
    target = (
        db.query(User)
        .filter(
            User.id == user_id,
            User.tenant_id == user.tenant_id
        )
        .first()
    )

    if not target:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return target


# ------------------------------------------------
# GET /users/{user_id}/roles
# CRITICAL FIX: int constraint
# ------------------------------------------------

@router.get("/{user_id:int}/roles", response_model=list[RoleRead])
def get_user_roles(
    user_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("admin.roles.read")),
    scope=Depends(require_tenant_scope()),
):
    target = (
        db.query(User)
        .filter(
            User.id == user_id,
            User.tenant_id == user.tenant_id
        )
        .first()
    )

    if not target:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    roles = (
        db.query(Role)
        .join(UserRole, UserRole.role_id == Role.id)
        .filter(UserRole.user_id == user_id)
        .all()
    )

    return roles


# ------------------------------------------------
# POST /users/{user_id}/roles/{role_id}
# ------------------------------------------------

@router.post("/{user_id:int}/roles/{role_id:int}", status_code=status.HTTP_201_CREATED)
def assign_role_to_user(
    user_id: int,
    role_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("admin.roles.write")),
    scope=Depends(require_tenant_scope()),
):
    target = (
        db.query(User)
        .filter(
            User.id == user_id,
            User.tenant_id == user.tenant_id
        )
        .first()
    )

    if not target:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    role = db.query(Role).filter(
        Role.id == role_id
    ).first()

    if not role:
        raise HTTPException(
            status_code=404,
            detail="Role not found"
        )

    existing = db.query(UserRole).filter(
        UserRole.user_id == user_id,
        UserRole.role_id == role_id,
    ).first()

    if existing:
        return {"detail": "Role already assigned"}

    link = UserRole(
        user_id=user_id,
        role_id=role_id
    )

    db.add(link)
    db.commit()

    return {"detail": "Role assigned"}


# ------------------------------------------------
# DELETE /users/{user_id}/roles/{role_id}
# ------------------------------------------------

@router.delete("/{user_id:int}/roles/{role_id:int}")
def remove_role_from_user(
    user_id: int,
    role_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("admin.roles.write")),
    scope=Depends(require_tenant_scope()),
):
    link = db.query(UserRole).filter(
        UserRole.user_id == user_id,
        UserRole.role_id == role_id,
    ).first()

    if not link:
        raise HTTPException(
            status_code=404,
            detail="Role not assigned"
        )

    db.delete(link)
    db.commit()

    return {"detail": "Role removed"}