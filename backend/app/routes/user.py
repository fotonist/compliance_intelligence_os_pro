# ==========================================================
# C:\Projects\compliance_intelligence_os\backend\app\routes\user.py
# PART 1
# ==========================================================


from sqlalchemy.sql import func

from app.schemas.user import (
    PasswordResetRequest,
    PasswordChangeRequest,
)
from typing import Optional

from fastapi import (


    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.session import get_db

from app.models.user import User
from app.models.role import Role
from app.models.user_role import UserRole

from app.schemas.user import (
    User as UserRead,
    UserCreate,
    UserUpdate,
    UserRoleUpdate,
)

from app.schemas.role import Role as RoleRead

from app.dependencies.permission_checker import require_permission
from app.dependencies.scope_checker import require_tenant_scope

router = APIRouter(
    prefix="/users",
    tags=["Administration - User Management"],
)


# ==========================================================
# Helpers
# ==========================================================

def get_user_or_404(
    db: Session,
    tenant_id: int,
    user_id: int,
) -> User:

    obj = (
        db.query(User)
        .filter(
            User.id == user_id,
            User.tenant_id == tenant_id,
        )
        .first()
    )

    if obj is None:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return obj


# ==========================================================
# GET /users
# Search + Pagination
# ==========================================================

@router.get("/", response_model=list[UserRead])
def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    keyword: Optional[str] = None,
    is_active: Optional[bool] = None,

    db: Session = Depends(get_db),

    current_user: User = Depends(
        require_permission("admin.users.read")
    ),

    scope=Depends(require_tenant_scope()),
):

    query = (
        db.query(User)
        .filter(
            User.tenant_id == current_user.tenant_id
        )
    )

    if keyword:

        query = query.filter(

            or_(
                User.email.ilike(f"%{keyword}%"),
                User.full_name.ilike(f"%{keyword}%"),
            )

        )

    if is_active is not None:

        query = query.filter(
            User.is_active == is_active
        )

    users = (
        query
        .order_by(User.full_name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return users
    
# ==========================================================
# GET /users/{user_id}
# ==========================================================

@router.get("/{user_id:int}", response_model=UserRead)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("admin.users.read")
    ),
    scope=Depends(require_tenant_scope()),
):

    return get_user_or_404(
        db,
        current_user.tenant_id,
        user_id,
    )


# ==========================================================
# POST /users
# ==========================================================

@router.post(
    "/",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("admin.users.write")
    ),
    scope=Depends(require_tenant_scope()),
):

    existing = (
        db.query(User)
        .filter(
            User.email == payload.email
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Email already exists",
        )

    # TODO
    # bcrypt.hashpw(...)
    hashed_password = payload.password

    user = User(
        tenant_id=current_user.tenant_id,

        email=payload.email,
        full_name=payload.full_name,

        hashed_password=hashed_password,

        is_active=payload.is_active,

        phone=payload.phone,
        language=payload.language,
        timezone=payload.timezone,

        must_change_password=payload.must_change_password,
        mfa_enabled=payload.mfa_enabled,

        created_by=current_user.id,
        updated_by=current_user.id,
    )

    db.add(user)

    db.commit()

    db.refresh(user)

    return user


# ==========================================================
# PUT /users/{id}
# ==========================================================

@router.put(
    "/{user_id:int}",
    response_model=UserRead,
)
def update_user(
    user_id: int,
    payload: UserUpdate,

    db: Session = Depends(get_db),

    current_user: User = Depends(
        require_permission("admin.users.write")
    ),

    scope=Depends(require_tenant_scope()),
):

    user = get_user_or_404(
        db,
        current_user.tenant_id,
        user_id,
    )

    update_data = payload.model_dump(
        exclude_unset=True
    )

    for key, value in update_data.items():

        setattr(
            user,
            key,
            value,
        )

    user.updated_by = current_user.id

    db.commit()

    db.refresh(user)

    return user


# ==========================================================
# DELETE /users/{id}
# Enterprise = Soft Delete
# ==========================================================

@router.delete("/{user_id:int}")
def delete_user(
    user_id: int,

    db: Session = Depends(get_db),

    current_user: User = Depends(
        require_permission("admin.users.delete")
    ),

    scope=Depends(require_tenant_scope()),
):

    user = get_user_or_404(
        db,
        current_user.tenant_id,
        user_id,
    )

    user.is_active = False
    user.is_locked = True
    user.updated_by = current_user.id

    db.commit()

    return {
        "detail": "User deactivated successfully"
    }
    
    # ==========================================================
# PATCH /users/{id}/activate
# ==========================================================

@router.patch("/{user_id:int}/activate")
def activate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("admin.users.write")
    ),
    scope=Depends(require_tenant_scope()),
):

    user = get_user_or_404(
        db,
        current_user.tenant_id,
        user_id,
    )

    user.is_active = True
    user.is_locked = False
    user.updated_by = current_user.id

    db.commit()

    return {
        "detail": "User activated successfully"
    }


# ==========================================================
# PATCH /users/{id}/deactivate
# ==========================================================

@router.patch("/{user_id:int}/deactivate")
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("admin.users.write")
    ),
    scope=Depends(require_tenant_scope()),
):

    user = get_user_or_404(
        db,
        current_user.tenant_id,
        user_id,
    )

    user.is_active = False
    user.updated_by = current_user.id

    db.commit()

    return {
        "detail": "User deactivated successfully"
    }


# ==========================================================
# PATCH /users/{id}/lock
# ==========================================================

@router.patch("/{user_id:int}/lock")
def lock_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("admin.users.write")
    ),
    scope=Depends(require_tenant_scope()),
):

    user = get_user_or_404(
        db,
        current_user.tenant_id,
        user_id,
    )

    user.is_locked = True
    user.updated_by = current_user.id

    db.commit()

    return {
        "detail": "User locked successfully"
    }


# ==========================================================
# PATCH /users/{id}/unlock
# ==========================================================

@router.patch("/{user_id:int}/unlock")
def unlock_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("admin.users.write")
    ),
    scope=Depends(require_tenant_scope()),
):

    user = get_user_or_404(
        db,
        current_user.tenant_id,
        user_id,
    )

    user.is_locked = False
    user.failed_login_attempts = 0
    user.updated_by = current_user.id

    db.commit()

    return {
        "detail": "User unlocked successfully"
    }


# ==========================================================
# POST /users/{id}/reset-password
# ==========================================================

@router.post("/{user_id:int}/reset-password")
def reset_password(
    user_id: int,
    payload: PasswordResetRequest,

    db: Session = Depends(get_db),

    current_user: User = Depends(
        require_permission("admin.users.write")
    ),

    scope=Depends(require_tenant_scope()),
):

    user = get_user_or_404(
        db,
        current_user.tenant_id,
        user_id,
    )

    # TODO
    # user.hashed_password = hash_password(payload.new_password)

    user.hashed_password = payload.new_password

    user.must_change_password = (
        payload.must_change_password
    )

    user.failed_login_attempts = 0
    user.is_locked = False
    user.updated_by = current_user.id
    user.password_last_changed = func.now()

    db.commit()

    return {
        "detail": "Password reset successfully"
    }


# ==========================================================
# POST /users/change-password
# Logged User
# ==========================================================

@router.post("/change-password")
def change_password(
    payload: PasswordChangeRequest,

    db: Session = Depends(get_db),

    current_user: User = Depends(
        require_permission("admin.users.read")
    ),

    scope=Depends(require_tenant_scope()),
):

    # TODO
    # verify_password()

    current_user.hashed_password = payload.new_password
    current_user.must_change_password = False
    current_user.password_last_changed = func.now()
    current_user.updated_by = current_user.id

    db.commit()

    return {
        "detail": "Password changed successfully"
    }
    
 # ===========================================================
# GET /users/{user_id}/roles
# ===========================================================

@router.get(
    "/{user_id:int}/roles",
    response_model=list[RoleRead],
)
def get_user_roles(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("admin.roles.read")
    ),
    scope=Depends(require_tenant_scope()),
):
    user = get_user_or_404(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=user_id,
    )

    return (
        db.query(Role)
        .join(UserRole, UserRole.role_id == Role.id)
        .filter(UserRole.user_id == user.id)
        .order_by(Role.name)
        .all()
    )
# ==========================================================
# PUT /users/{user_id}/roles
# Replace User Roles (Enterprise)
# ==========================================================

@router.put(
    "/{user_id:int}/roles",
    response_model=list[RoleRead],
)

def update_user_roles(

    user_id: int,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("admin.roles.write")
    ),
    scope=Depends(require_tenant_scope()),
):

    print("========== DEBUG ==========")
    print("payload.role_ids =", payload.role_ids)

    # Kullanıcı kontrolü
    user = get_user_or_404(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=user_id,
    )

    # İstenen rolleri getir
    roles = (
        db.query(Role)
        .filter(Role.id.in_(payload.role_ids))
        .all()
    )

    print("roles found =", [(r.id, r.name) for r in roles])
    print("===========================")

    # Geçersiz role id var mı?
    if len(roles) != len(payload.role_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more role IDs are invalid.",
        )

    # Eski rolleri sil
    (
        db.query(UserRole)
        .filter(UserRole.user_id == user.id)
        .delete(synchronize_session=False)
    )

    # Yeni rolleri ekle
    for role in roles:
        db.add(
            UserRole(
                user_id=user.id,
                role_id=role.id,
            )
        )

    db.commit()

    # Güncel rol listesini döndür
    updated_roles = (
        db.query(Role)
        .join(UserRole, UserRole.role_id == Role.id)
        .filter(UserRole.user_id == user.id)
        .order_by(Role.name)
        .all()
    )

    return updated_roles
# ==========================================================
# GET /users/lookup/roles
# Role Lookup
# ==========================================================

@router.get("/lookup/roles")
def lookup_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("admin.users.read")
    ),
    scope=Depends(require_tenant_scope()),
):

    roles = (
        db.query(Role)
        .order_by(Role.name.asc())
        .all()
    )

    return [
        {
            "id": r.id,
            "name": r.name,
        }
        for r in roles
    ]