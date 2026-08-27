from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.platform import require_super_admin
from app.models.tenants import Tenant
from app.models.user import User


router = APIRouter(
    prefix="/admin/tenants",
    tags=["Admin - Tenants"],
)


class TenantCreate(BaseModel):
    code: str = Field(min_length=2, max_length=64)
    name: str = Field(min_length=2, max_length=255)
    status: str = Field(default="active", max_length=32)


class TenantUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    status: Optional[str] = Field(default=None, max_length=32)


@router.get("")
def list_tenants(
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    rows = (
        db.query(
            Tenant,
            func.count(User.id).label("user_count"),
        )
        .outerjoin(User, User.tenant_id == Tenant.id)
        .group_by(Tenant.id)
        .order_by(Tenant.name.asc())
        .all()
    )

    return [
        {
            "id": tenant.id,
            "code": tenant.code,
            "name": tenant.name,
            "status": tenant.status,
            "created_at": tenant.created_at,
            "user_count": int(user_count or 0),
        }
        for tenant, user_count in rows
    ]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_tenant(
    payload: TenantCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    code = payload.code.strip()
    name = payload.name.strip()
    tenant_status = payload.status.strip().lower()

    if tenant_status not in {"active", "suspended"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid tenant status",
        )

    existing = (
        db.query(Tenant)
        .filter(Tenant.code == code)
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tenant code already exists",
        )

    tenant = Tenant(
        code=code,
        name=name,
        status=tenant_status,
    )

    db.add(tenant)
    db.commit()
    db.refresh(tenant)

    return {
        "id": tenant.id,
        "code": tenant.code,
        "name": tenant.name,
        "status": tenant.status,
        "created_at": tenant.created_at,
        "user_count": 0,
    }


@router.get("/{tenant_id}")
def get_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
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

    user_count = (
        db.query(func.count(User.id))
        .filter(User.tenant_id == tenant.id)
        .scalar()
        or 0
    )

    return {
        "id": tenant.id,
        "code": tenant.code,
        "name": tenant.name,
        "status": tenant.status,
        "created_at": tenant.created_at,
        "user_count": int(user_count),
    }


@router.patch("/{tenant_id}")
def update_tenant(
    tenant_id: int,
    payload: TenantUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin),
):
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

    if payload.name is not None:
        tenant.name = payload.name.strip()

    if payload.status is not None:
        new_status = payload.status.strip().lower()

        if new_status not in {"active", "suspended"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid tenant status",
            )

        tenant.status = new_status

    db.commit()
    db.refresh(tenant)

    user_count = (
        db.query(func.count(User.id))
        .filter(User.tenant_id == tenant.id)
        .scalar()
        or 0
    )

    return {
        "id": tenant.id,
        "code": tenant.code,
        "name": tenant.name,
        "status": tenant.status,
        "created_at": tenant.created_at,
        "user_count": int(user_count),
    }
