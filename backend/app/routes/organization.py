from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user


router = APIRouter(
    prefix="/organizations",
    tags=["Organizations"],
)


class OrganizationCreate(BaseModel):
    name: str
    legal_name: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    employee_count: Optional[int] = None
    description: Optional[str] = None
    mission: Optional[str] = None
    vision: Optional[str] = None
    scope_statement: Optional[str] = None


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    legal_name: Optional[str] = None
    industry: Optional[str] = None
    company_size: Optional[str] = None
    employee_count: Optional[int] = None
    description: Optional[str] = None
    mission: Optional[str] = None
    vision: Optional[str] = None
    scope_statement: Optional[str] = None
    status: Optional[str] = None


@router.get("")
def list_organizations(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    rows = db.execute(
        text(
            """
            SELECT *
            FROM organizations
            WHERE tenant_id = :tenant_id
            ORDER BY id DESC
            """
        ),
        {
            "tenant_id": current_user.tenant_id,
        },
    ).mappings().all()

    return rows


@router.get("/{organization_id}")
def get_organization(
    organization_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    row = db.execute(
        text(
            """
            SELECT *
            FROM organizations
            WHERE id = :id
              AND tenant_id = :tenant_id
            """
        ),
        {
            "id": organization_id,
            "tenant_id": current_user.tenant_id,
        },
    ).mappings().first()

    if not row:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    return row


@router.post("")
def create_organization(
    payload: OrganizationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = db.execute(
        text(
            """
            INSERT INTO organizations (
                tenant_id,
                name,
                legal_name,
                industry,
                company_size,
                employee_count,
                description,
                mission,
                vision,
                scope_statement,
                created_by
            )
            VALUES (
                :tenant_id,
                :name,
                :legal_name,
                :industry,
                :company_size,
                :employee_count,
                :description,
                :mission,
                :vision,
                :scope_statement,
                :created_by
            )
            RETURNING id
            """
        ),
        {
            "tenant_id": current_user.tenant_id,
            **payload.model_dump(),
            "created_by": current_user.id,
        },
    )

    db.commit()

    return {
        "id": result.scalar(),
        "message": "Organization created",
    }
