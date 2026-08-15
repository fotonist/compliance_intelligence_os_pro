from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.audit_plans import AuditPlan
from app.models.user import User
from app.schemas.audit_plan_create_schema import (
    AuditPlanCreate,
    AuditPlanDetail,
    AuditPlanSummary,
)

router = APIRouter(prefix="/audit/plans", tags=["Audit Plans"])


@router.post("", response_model=AuditPlanDetail, status_code=201)
def create_audit_plan(
    payload: AuditPlanCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    existing = (
        db.query(AuditPlan)
        .filter(
            AuditPlan.tenant_id == user.tenant_id,
            AuditPlan.reference == payload.reference,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Audit plan reference already exists")

    if payload.planned_start and payload.planned_end and payload.planned_end < payload.planned_start:
        raise HTTPException(status_code=400, detail="Planned end date cannot be before planned start date")

    plan = AuditPlan(
        tenant_id=user.tenant_id,
        reference=payload.reference,
        name=payload.name,
        audit_type=payload.audit_type,
        objective=payload.objective,
        scope=payload.scope,
        standard_id=payload.standard_id,
        standard_version_id=payload.standard_version_id,
        process_id=payload.process_id,
        lead_auditor_id=payload.lead_auditor_id,
        planned_start=payload.planned_start,
        planned_end=payload.planned_end,
        status="DRAFT",
        created_by=user.id,
    )

    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.get("", response_model=list[AuditPlanSummary])
def list_audit_plans(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return (
        db.query(AuditPlan)
        .filter(AuditPlan.tenant_id == user.tenant_id)
        .order_by(AuditPlan.created_at.desc())
        .all()
    )


@router.get("/{plan_id}", response_model=AuditPlanDetail)
def get_audit_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    plan = (
        db.query(AuditPlan)
        .filter(
            AuditPlan.id == plan_id,
            AuditPlan.tenant_id == user.tenant_id,
        )
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Audit plan not found")
    return plan
