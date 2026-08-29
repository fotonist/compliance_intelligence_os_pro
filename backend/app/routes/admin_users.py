from __future__ import annotations

import secrets
import string
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.security import get_password_hash
from app.core.settings import FRONTEND_BASE_URL
from app.core.validation import validate_password_strength
from app.dependencies.platform import require_super_admin
from app.models.role import Role
from app.models.tenants import Tenant
from app.models.user import User
from app.models.user_role import UserRole
from app.services.identity_verification_service import (
    IdentityVerificationError,
    IdentityVerificationService,
)


router = APIRouter(
    prefix="/admin/users",
    tags=["Platform Administration - Users"],
)


# ==========================================================
# Schemas
# ==========================================================

class PlatformUserCreate(BaseModel):
    tenant_id: int
    email: str = Field(min_length=3, max_length=255)
    full_name: str = Field(min_length=2, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=50)
    language: str = Field(default="en", max_length=20)
    timezone: str = Field(default="UTC", max_length=100)

    role_ids: list[int] = Field(default_factory=list)

    password: Optional[str] = Field(
        default=None,
        min_length=12,
        max_length=128,
    )

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return validate_password_strength(value)

    must_change_password: bool = True
    mfa_enabled: bool = False
    is_active: bool = True


class PlatformUserUpdate(BaseModel):
    tenant_id: Optional[int] = None
    email: Optional[str] = Field(
        default=None,
        min_length=3,
        max_length=255,
    )
    full_name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=255,
    )
    phone: Optional[str] = Field(default=None, max_length=50)
    language: Optional[str] = Field(default=None, max_length=20)
    timezone: Optional[str] = Field(default=None, max_length=100)
    is_active: Optional[bool] = None
    mfa_enabled: Optional[bool] = None
    must_change_password: Optional[bool] = None


class PlatformRoleUpdate(BaseModel):
    role_ids: list[int] = Field(default_factory=list)


class PlatformPasswordReset(BaseModel):
    new_password: str = Field(
        min_length=12,
        max_length=128,
    )

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)

    must_change_password: bool = True


# ==========================================================
# Helpers
# ==========================================================

def _generate_temporary_password() -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(alphabet) for _ in range(20))


def _user_payload(
    user: User,
    tenant: Tenant,
    roles: list[Role],
) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "language": user.language,
        "timezone": user.timezone,
        "is_active": user.is_active,
        "is_locked": user.is_locked,
        "mfa_enabled": user.mfa_enabled,
        "must_change_password": user.must_change_password,
        "last_login_at": user.last_login_at,
        "password_last_changed": user.password_last_changed,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        "tenant": {
            "id": tenant.id,
            "code": tenant.code,
            "name": tenant.name,
            "status": tenant.status,
        },
        "roles": [
            {
                "id": role.id,
                "name": role.name,
            }
            for role in roles
        ],
    }


def _get_user(
    db: Session,
    user_id: int,
) -> tuple[User, Tenant, list[Role]]:

    user = (
        db.query(User)
        .options(joinedload(User.tenant))
        .filter(User.id == user_id)
        .first()
    )

    if not user or not user.tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    roles = (
        db.query(Role)
        .join(UserRole, UserRole.role_id == Role.id)
        .filter(UserRole.user_id == user.id)
        .order_by(Role.name.asc())
        .all()
    )

    return user, user.tenant, roles


def _get_tenant_or_404(
    db: Session,
    tenant_id: int,
) -> Tenant:

    tenant = (
        db.query(Tenant)
        .filter(Tenant.id == tenant_id)
        .first()
    )

    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )

    if str(tenant.status).lower() != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant is not active",
        )

    return tenant


def _get_roles(
    db: Session,
    role_ids: list[int],
) -> list[Role]:

    if not role_ids:
        return []

    unique_ids = list(dict.fromkeys(role_ids))

    roles = (
        db.query(Role)
        .filter(Role.id.in_(unique_ids))
        .all()
    )

    if len(roles) != len(unique_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more role IDs are invalid",
        )

    inactive = [
        role.name
        for role in roles
        if not role.is_active
    ]

    if inactive:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more selected roles are inactive",
        )

    return roles


# ==========================================================
# GET /admin/users
# ==========================================================

@router.get("")
def list_platform_users(
    tenant_id: Optional[int] = Query(default=None),
    role_id: Optional[int] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    is_locked: Optional[bool] = Query(default=None),
    mfa_enabled: Optional[bool] = Query(default=None),
    keyword: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):

    query = (
        db.query(User)
        .join(Tenant, Tenant.id == User.tenant_id)
    )

    if tenant_id is not None:
        query = query.filter(User.tenant_id == tenant_id)

    if role_id is not None:
        query = query.join(
            UserRole,
            UserRole.user_id == User.id,
        ).filter(UserRole.role_id == role_id)

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    if is_locked is not None:
        query = query.filter(User.is_locked == is_locked)

    if mfa_enabled is not None:
        query = query.filter(User.mfa_enabled == mfa_enabled)

    if keyword:
        term = f"%{keyword.strip()}%"
        query = query.filter(
            or_(
                User.email.ilike(term),
                User.full_name.ilike(term),
                Tenant.name.ilike(term),
                Tenant.code.ilike(term),
            )
        )

    total = query.distinct().count()

    users = (
        query
        .options(joinedload(User.tenant))
        .distinct()
        .order_by(User.full_name.asc(), User.email.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    user_ids = [user.id for user in users]

    roles_by_user: dict[int, list[Role]] = {}

    if user_ids:
        rows = (
            db.query(UserRole.user_id, Role)
            .join(Role, Role.id == UserRole.role_id)
            .filter(UserRole.user_id.in_(user_ids))
            .order_by(Role.name.asc())
            .all()
        )

        for user_id, role in rows:
            roles_by_user.setdefault(
                user_id,
                [],
            ).append(role)

    return {
        "items": [
            _user_payload(
                user,
                user.tenant,
                roles_by_user.get(user.id, []),
            )
            for user in users
        ],
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": (
            (total + page_size - 1) // page_size
            if total
            else 0
        ),
    }


# ==========================================================
# GET /admin/users/{user_id}
# ==========================================================

@router.get("/{user_id:int}")
def get_platform_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):

    user, tenant, roles = _get_user(db, user_id)

    return _user_payload(user, tenant, roles)


# ==========================================================
# POST /admin/users
# Create Platform Identity
# ==========================================================

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
)
def create_platform_user(
    payload: PlatformUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):

    tenant = _get_tenant_or_404(
        db,
        payload.tenant_id,
    )

    email = payload.email.strip().lower()

    existing = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already exists",
        )

    roles = _get_roles(
        db,
        payload.role_ids,
    )

    temporary_password = (
        payload.password
        or _generate_temporary_password()
    )

    now = datetime.utcnow()

    user = User(
        tenant_id=tenant.id,
        email=email,
        full_name=payload.full_name.strip(),
        phone=payload.phone,
        language=payload.language,
        timezone=payload.timezone,
        hashed_password=get_password_hash(
            temporary_password
        ),
        is_active=payload.is_active,
        is_locked=False,
        failed_login_attempts=0,
        must_change_password=payload.must_change_password,
        mfa_enabled=payload.mfa_enabled,
        created_by=current_user.id,
        updated_by=current_user.id,
        password_last_changed=now,
    )

    db.add(user)
    db.flush()

    for role in roles:
        db.add(
            UserRole(
                user_id=user.id,
                role_id=role.id,
            )
        )

    db.commit()
    db.refresh(user)


    IdentityVerificationService.issue_email_verification(
        db=db,
        user=user,
        verification_base_url=FRONTEND_BASE_URL,
    )

    return {
        **_user_payload(
            user,
            tenant,
            roles,
        ),
        "temporary_password": (
            temporary_password
            if payload.password is None
            else None
        ),
    }


# ==========================================================
# PATCH /admin/users/{user_id}
# Edit Platform Identity
# ==========================================================

@router.patch("/{user_id:int}")
def update_platform_user(
    user_id: int,
    payload: PlatformUserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):

    user, _, _ = _get_user(db, user_id)

    update_data = payload.model_dump(
        exclude_unset=True
    )

    if "tenant_id" in update_data:
        tenant = _get_tenant_or_404(
            db,
            update_data["tenant_id"],
        )
        user.tenant_id = tenant.id

    email_changed = False

    if "email" in update_data:
        email = update_data["email"].strip().lower()

        existing = (
            db.query(User)
            .filter(
                User.email == email,
                User.id != user.id,
            )
            .first()
        )

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already exists",
            )

        if email != user.email:
            user.email = email
            user.email_verified_at = None
            email_changed = True

    for field in (
        "full_name",
        "phone",
        "language",
        "timezone",
        "is_active",
        "mfa_enabled",
        "must_change_password",
    ):
        if field in update_data:
            value = update_data[field]

            if isinstance(value, str):
                value = value.strip()

            setattr(user, field, value)

    user.updated_by = current_user.id

    db.commit()
    db.refresh(user)

    if email_changed:
        IdentityVerificationService.issue_email_verification(
            db=db,
            user=user,
            verification_base_url=FRONTEND_BASE_URL,
        )

    _, tenant, roles = _get_user(
        db,
        user.id,
    )

    return _user_payload(
        user,
        tenant,
        roles,
    )


# ==========================================================
# PUT /admin/users/{user_id}/roles
# ==========================================================

@router.put("/{user_id:int}/roles")
def update_platform_user_roles(
    user_id: int,
    payload: PlatformRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):

    user, tenant, _ = _get_user(
        db,
        user_id,
    )

    roles = _get_roles(
        db,
        payload.role_ids,
    )

    (
        db.query(UserRole)
        .filter(UserRole.user_id == user.id)
        .delete(
            synchronize_session=False
        )
    )

    for role in roles:
        db.add(
            UserRole(
                user_id=user.id,
                role_id=role.id,
            )
        )

    user.updated_by = current_user.id

    db.commit()

    _, tenant, updated_roles = _get_user(
        db,
        user.id,
    )

    return _user_payload(
        user,
        tenant,
        updated_roles,
    )


# ==========================================================
# PATCH /admin/users/{user_id}/lock
# ==========================================================

@router.patch("/{user_id:int}/lock")
def lock_platform_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):

    user, tenant, roles = _get_user(
        db,
        user_id,
    )

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot lock your own account",
        )

    user.is_locked = True
    user.updated_by = current_user.id

    db.commit()

    return _user_payload(
        user,
        tenant,
        roles,
    )


# ==========================================================
# PATCH /admin/users/{user_id}/unlock
# ==========================================================

@router.patch("/{user_id:int}/unlock")
def unlock_platform_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):

    user, tenant, roles = _get_user(
        db,
        user_id,
    )

    user.is_locked = False
    user.failed_login_attempts = 0
    user.updated_by = current_user.id

    db.commit()

    return _user_payload(
        user,
        tenant,
        roles,
    )


# ==========================================================
# POST /admin/users/{user_id}/reset-password
# ==========================================================

@router.post("/{user_id:int}/reset-password")
def reset_platform_user_password(
    user_id: int,
    payload: PlatformPasswordReset,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):

    user, tenant, roles = _get_user(
        db,
        user_id,
    )

    user.hashed_password = get_password_hash(
        payload.new_password
    )

    user.must_change_password = (
        payload.must_change_password
    )

    user.failed_login_attempts = 0
    user.is_locked = False
    user.password_last_changed = datetime.utcnow()
    user.updated_by = current_user.id

    db.commit()

    return _user_payload(
        user,
        tenant,
        roles,
    )


# ==========================================================
# PATCH /admin/users/{user_id}/activate
# ==========================================================

@router.patch("/{user_id:int}/activate")
def activate_platform_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):

    user, tenant, roles = _get_user(
        db,
        user_id,
    )

    user.is_active = True
    user.is_locked = False
    user.updated_by = current_user.id

    db.commit()

    return _user_payload(
        user,
        tenant,
        roles,
    )


# ==========================================================
# PATCH /admin/users/{user_id}/deactivate
# ==========================================================

@router.patch("/{user_id:int}/deactivate")
def deactivate_platform_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):

    user, tenant, roles = _get_user(
        db,
        user_id,
    )

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account",
        )

    user.is_active = False
    user.updated_by = current_user.id

    db.commit()

    return _user_payload(
        user,
        tenant,
        roles,
    )


# ==========================================================
# GET /admin/users/lookup/tenants
# ==========================================================

@router.get("/lookup/tenants")
def lookup_tenants(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):

    tenants = (
        db.query(Tenant)
        .order_by(Tenant.name.asc())
        .all()
    )

    return [
        {
            "id": tenant.id,
            "code": tenant.code,
            "name": tenant.name,
            "status": tenant.status,
        }
        for tenant in tenants
    ]


# ==========================================================
# GET /admin/users/lookup/roles
# ==========================================================

@router.get("/lookup/roles")
def lookup_roles(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):

    roles = (
        db.query(Role)
        .filter(Role.is_active.is_(True))
        .order_by(Role.name.asc())
        .all()
    )

    return [
        {
            "id": role.id,
            "name": role.name,
        }
        for role in roles
    ]
