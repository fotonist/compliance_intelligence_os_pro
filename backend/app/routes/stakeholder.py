from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.stakeholder import Stakeholder
from app.models.user import User


router = APIRouter(
    prefix="/company/stakeholders",
    tags=["Company Stakeholders"],
)


def stakeholder_response(stakeholder: Stakeholder):

    return {
        "id": stakeholder.id,

        "tenant_id": stakeholder.tenant_id,
        "organization_id": stakeholder.organization_id,

        "name": stakeholder.name,
        "stakeholder_type": stakeholder.stakeholder_type,
        "relationship": stakeholder.relationship,

        "description": stakeholder.description,

        "contact_person": stakeholder.contact_person,
        "email": stakeholder.email,
        "phone": stakeholder.phone,

        "importance": stakeholder.importance,
        "status": stakeholder.status,

        "created_by": stakeholder.created_by,
        "created_at": stakeholder.created_at,
        "updated_at": stakeholder.updated_at,
    }


@router.get("")
def list_stakeholders(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = (
        select(Stakeholder)
        .where(
            Stakeholder.tenant_id == user.tenant_id,
        )
        .order_by(
            Stakeholder.name,
            Stakeholder.id,
        )
    )

    stakeholders = db.execute(stmt).scalars().all()

    return [
        stakeholder_response(item)
        for item in stakeholders
    ]


@router.get("/{stakeholder_id}")
def get_stakeholder(
    stakeholder_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = select(Stakeholder).where(
        Stakeholder.id == stakeholder_id,
        Stakeholder.tenant_id == user.tenant_id,
    )

    stakeholder = db.execute(stmt).scalar_one_or_none()

    if not stakeholder:
        raise HTTPException(
            status_code=404,
            detail="Stakeholder not found",
        )

    return stakeholder_response(stakeholder)


@router.post("")
def create_stakeholder(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    name = str(
        payload.get("name") or ""
    ).strip()


    if not name:
        raise HTTPException(
            status_code=400,
            detail="Stakeholder name is required",
        )


    stakeholder = Stakeholder(

        tenant_id=user.tenant_id,

        organization_id=payload.get(
            "organization_id"
        ),

        name=name,

        stakeholder_type=payload.get(
            "stakeholder_type"
        ),

        relationship=payload.get(
            "relationship"
        ),

        description=payload.get(
            "description"
        ),

        contact_person=payload.get(
            "contact_person"
        ),

        email=payload.get(
            "email"
        ),

        phone=payload.get(
            "phone"
        ),

        importance=payload.get(
            "importance"
        ),

        status=payload.get(
            "status"
        ) or "ACTIVE",

        created_by=user.id,
    )


    db.add(stakeholder)
    db.commit()
    db.refresh(stakeholder)

    return stakeholder_response(stakeholder)


@router.put("/{stakeholder_id}")
def update_stakeholder(
    stakeholder_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = select(Stakeholder).where(
        Stakeholder.id == stakeholder_id,
        Stakeholder.tenant_id == user.tenant_id,
    )


    stakeholder = db.execute(stmt).scalar_one_or_none()


    if not stakeholder:
        raise HTTPException(
            status_code=404,
            detail="Stakeholder not found",
        )


    fields = [
        "organization_id",
        "name",
        "stakeholder_type",
        "relationship",
        "description",
        "contact_person",
        "email",
        "phone",
        "importance",
        "status",
    ]


    for field in fields:
        if field in payload:
            setattr(
                stakeholder,
                field,
                payload[field],
            )


    stakeholder.updated_at = datetime.utcnow()


    db.commit()
    db.refresh(stakeholder)

    return stakeholder_response(stakeholder)




@router.get("/options")
def stakeholder_options():

    return {
        "types": [
            "Customer",
            "Supplier",
            "Partner",
            "Regulatory Authority",
            "Government",
            "Certification Body",
            "Employee",
            "Shareholder",
            "Management",
            "Contractor",
            "Service Provider",
            "Community",
            "Other",
        ],

        "importance": [
            "Critical",
            "High",
            "Medium",
            "Low",
        ],

        "status": [
            "ACTIVE",
            "INACTIVE",
        ],
    }


@router.delete("/{stakeholder_id}")
def delete_stakeholder(
    stakeholder_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = select(Stakeholder).where(
        Stakeholder.id == stakeholder_id,
        Stakeholder.tenant_id == user.tenant_id,
    )


    stakeholder = db.execute(stmt).scalar_one_or_none()


    if not stakeholder:
        raise HTTPException(
            status_code=404,
            detail="Stakeholder not found",
        )


    db.delete(stakeholder)
    db.commit()


    return {
        "message": "Stakeholder deleted successfully"
    }
