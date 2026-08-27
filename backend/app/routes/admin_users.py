from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_password_hash
from app.dependencies.platform import require_super_admin
from app.models.role import Role
from app.models.tenants import Tenant
from app.models.user import User
from app.models.user_role import UserRole


router = APIRouter(
    prefix="/admin/users",
    tags=["Platform - User Administration"],
)


class PlatformUserCreate(BaseModel):
    tenant_id: int
    email: str = Field(min_length=3, max_length=255)
    full_name: Optional[str] = Field(default=None, max_length=255)
    password: str = Field(min_length=12, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=50)
    language: Optional[str] = Field(default="en", max_length=20)
    timezone: Optional[str] = Field(default="UTC", max_length=100)
    is_active: bool = True
    is_locked: bool = False
    must_change_password: bool = True
    mfa_enabled: bool = False
    role_ids: list[int] = Field(default_factory=list)


class PlatformUserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=50)
    language: Optional[str] = Field(default=None, max_length=20)
    timezone: Optional[str] = Field(default=None, max_length=100)
    is_active: Optional[bool] = None
    is_locked: Optional[bool] = None
    must_change_password: Optional[bool] = None
    mfa_enabled: Optional[bool] = None


class PlatformUserRoleUpdate(BaseModel):
    role_ids: list[int] = Field(default_factory=list)


class PlatformUserPasswordReset(BaseModel):
    password: str = Field(min_length=12, max_length=255)
    must_change_password: bool = True


def _role_payload(user: User) -> list[dict]:
    return [
        {"id": role.id, "name": role.name}
        for role in sorted(user.roles or [], key=lambda item: item.name.lower())
    ]


def _user_payload(user: User) -> dict:
    tenant = user.tenant
    return {
        "id": user.id,
        "tenant_id": user.tenant_id,
        "tenant_code": tenant.code if tenant else None,
        "tenant_name": tenant.name if tenant else None,
        "tenant_status": tenant.status if tenant else None,
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "language": user.language,
        "timezone": user.timezone,
        "is_active": user.is_active,
        "is_locked": user.is_locked,
        "failed_login_attempts": user.failed_login_attempts,
        "must_change_password": user.must_change_password,
        "mfa_enabled": user.mfa_enabled,
        "last_login_at": user.last_login_at,
        "password_last_changed": user.password_last_changed,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        "roles": _role_payload(user),
    }


def _get_user(db: Session, user_id: int) -> User:
    user = (
        db.query(User)
        .options(joinedload(User.roles), joinedload(User.tenant))
        .filter(User.id == user_id)
        .first()
    )
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _get_tenant(db: Session, tenant_id: int) -> Tenant:
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


def _validate_roles(db: Session, role_ids: list[int]) -> list[Role]:
    if not role_ids:
        return []

    unique_ids = list(dict.fromkeys(role_ids))
    roles = db.query(Role).filter(Role.id.in_(unique_ids)).all()
    if len(roles) != len(unique_ids):
        raise HTTPException(
            status_code=400,
            detail="One or more role IDs are invalid.",
        )
    return roles


@router.get("")
def list_platform_users(
    tenant_id: Optional[int] = Query(default=None),
    keyword: Optional[str] = Query(default=None),
    role_id: Optional[int] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    is_locked: Optional[bool] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=250),
    _: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    query = (
        db.query(User)
        .options(joinedload(User.roles), joinedload(User.tenant))
        .join(Tenant, Tenant.id == User.tenant_id)
    )

    if tenant_id is not None:
        query = query.filter(User.tenant_id == tenant_id)

    if keyword:
        term = keyword.strip()
        if term:
            query = query.filter(
                User.email.ilike(f"%{term}%")
                | User.full_name.ilike(f"%{term}%")
                | Tenant.name.ilike(f"%{term}%")
                | Tenant.code.ilike(f"%{term}%")
            )

    if role_id is not None:
        query = query.join(UserRole, UserRole.user_id == User.id).filter(
            UserRole.role_id == role_id
        )

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    if is_locked is not None:
        query = query.filter(User.is_locked == is_locked)

    users = (
        query.order_by(Tenant.name.asc(), User.full_name.asc(), User.email.asc())
        .limit(limit)
        .all()
    )

    return [_user_payload(user) for user in users]


@router.get("/{user_id:int}")
def get_platform_user(
    user_id: int,
    _: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    return _user_payload(_get_user(db, user_id))


@router.post("", status_code=status.HTTP_201_CREATED)
def create_platform_user(
    payload: PlatformUserCreate,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    tenant = _get_tenant(db, payload.tenant_id)
    if tenant.status != "active":
        raise HTTPException(
            status_code=409,
            detail="Users cannot be created in a suspended tenant.",
        )

    email = payload.email.strip().lower()
    if db.query(User).filter(User.email == email).first() is not None:
        raise HTTPException(status_code=409, detail="Email already exists")

    roles = _validate_roles(db, payload.role_ids)

    user = User(
        tenant_id=tenant.id,
        email=email,
        full_name=payload.full_name.strip() if payload.full_name else None,
        hashed_password=get_password_hash(payload.password),
        is_active=payload.is_active,
        is_locked=payload.is_locked,
        phone=payload.phone,
        language=payload.language,
        timezone=payload.timezone,
        must_change_password=payload.must_change_password,
        mfa_enabled=payload.mfa_enabled,
        created_by=current_user.id,
        updated_by=current_user.id,
    )

    db.add(user)
    db.flush()

    for role in roles:
        db.add(UserRole(user_id=user.id, role_id=role.id))

    db.commit()
    db.refresh(user)
    return _user_payload(_get_user(db, user.id))


@router.patch("/{user_id:int}")
def update_platform_user(
    user_id: int,
    payload: PlatformUserUpdate,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    user = _get_user(db, user_id)

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, key, value.strip() if isinstance(value, str) else value)

    user.updated_by = current_user.id
    db.commit()
    db.refresh(user)
    return _user_payload(_get_user(db, user.id))


@router.put("/{user_id:int}/roles")
def update_platform_user_roles(
    user_id: int,
    payload: PlatformUserRoleUpdate,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    user = _get_user(db, user_id)
    roles = _validate_roles(db, payload.role_ids)

    db.query(UserRole).filter(UserRole.user_id == user.id).delete(
        synchronize_session=False
    )

    for role in roles:
        db.add(UserRole(user_id=user.id, role_id=role.id))

    user.updated_by = current_user.id
    db.commit()
    return _user_payload(_get_user(db, user.id))


@router.post("/{user_id:int}/reset-password")
def reset_platform_user_password(
    user_id: int,
    payload: PlatformUserPasswordReset,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    user = _get_user(db, user_id)
    user.hashed_password = get_password_hash(payload.password)
    user.must_change_password = payload.must_change_password
    user.failed_login_attempts = 0
    user.is_locked = False
    user.updated_by = current_user.id
    db.commit()
    return {"detail": "Password reset successfully"}


@router.post("/{user_id:int}/activate")
def activate_platform_user(
    user_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    user = _get_user(db, user_id)
    user.is_active = True
    user.is_locked = False
    user.updated_by = current_user.id
    db.commit()
    return {"detail": "User activated successfully"}


@router.post("/{user_id:int}/deactivate")
def deactivate_platform_user(
    user_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    user = _get_user(db, user_id)
    user.is_active = False
    user.updated_by = current_user.id
    db.commit()
    return {"detail": "User deactivated successfully"}


@router.post("/{user_id:int}/lock")
def lock_platform_user(
    user_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    user = _get_user(db, user_id)
    user.is_locked = True
    user.updated_by = current_user.id
    db.commit()
    return {"detail": "User locked successfully"}


@router.post("/{user_id:int}/unlock")
def unlock_platform_user(
    user_id: int,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    user = _get_user(db, user_id)
    user.is_locked = False
    user.failed_login_attempts = 0
    user.updated_by = current_user.id
    db.commit()
    return {"detail": "User unlocked successfully"}
