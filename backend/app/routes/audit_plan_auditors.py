from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.audit_plan_auditors import AuditPlanAuditor
from app.models.audit_plans import AuditPlan
from app.models.user import User


router = APIRouter(
    prefix="/audit/plans",
    tags=["Audit Plan Auditors"],
)


ALLOWED_ROLES = {
    "LEAD_AUDITOR",
    "AUDITOR",
    "TECHNICAL_EXPERT",
    "OBSERVER",
}


def _get_plan(
    db: Session,
    user: User,
    plan_id: int,
) -> AuditPlan:
    plan = db.execute(
        select(AuditPlan).where(
            and_(
                AuditPlan.id == plan_id,
                AuditPlan.tenant_id == user.tenant_id,
            )
        )
    ).scalar_one_or_none()

    if not plan:
        raise HTTPException(
            status_code=404,
            detail="Audit plan not found",
        )

    return plan


def _get_user(
    db: Session,
    current_user: User,
    user_id: int,
) -> User:
    target = db.execute(
        select(User).where(
            and_(
                User.id == user_id,
                User.tenant_id == current_user.tenant_id,
            )
        )
    ).scalar_one_or_none()

    if not target:
        raise HTTPException(
            status_code=404,
            detail="Auditor user not found",
        )

    return target


def _serialize(item: AuditPlanAuditor):
    user = item.user

    return {
        "id": item.id,
        "audit_plan_id": item.audit_plan_id,
        "user_id": item.user_id,
        "assignment_role": item.assignment_role,
        "assigned_scope": item.assigned_scope,
        "assigned_at": item.assigned_at,
        "user": {
            "id": user.id if user else None,
            "email": user.email if user else None,
            "full_name": user.full_name if user else None,
            "role": user.role if user else None,
            "is_active": user.is_active if user else None,
        },
    }


@router.get("/{plan_id}/auditors")
def list_audit_plan_auditors(
    plan_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_plan(db, user, plan_id)

    rows = db.execute(
        select(AuditPlanAuditor)
        .where(
            and_(
                AuditPlanAuditor.audit_plan_id == plan_id,
                AuditPlanAuditor.tenant_id == user.tenant_id,
            )
        )
        .order_by(AuditPlanAuditor.assigned_at.asc())
    ).scalars().all()

    return [_serialize(item) for item in rows]


@router.post("/{plan_id}/auditors")
def add_audit_plan_auditor(
    plan_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    plan = _get_plan(db, user, plan_id)

    user_id = payload.get("user_id")
    assignment_role = str(
        payload.get("assignment_role") or "AUDITOR"
    ).strip().upper()
    assigned_scope = payload.get("assigned_scope")

    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="user_id is required",
        )

    if assignment_role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=400,
            detail="Invalid audit team role",
        )

    target = _get_user(
        db,
        user,
        int(user_id),
    )

    if not target.is_active:
        raise HTTPException(
            status_code=400,
            detail="Inactive users cannot be assigned to an audit",
        )

    if assignment_role == "LEAD_AUDITOR":
        if plan.lead_auditor_id != target.id:
            raise HTTPException(
                status_code=409,
                detail="Lead auditor assignment must match the audit plan lead auditor",
            )

    existing = db.execute(
        select(AuditPlanAuditor).where(
            and_(
                AuditPlanAuditor.audit_plan_id == plan_id,
                AuditPlanAuditor.tenant_id == user.tenant_id,
                AuditPlanAuditor.user_id == target.id,
            )
        )
    ).scalar_one_or_none()

    if existing:
        existing.assignment_role = assignment_role
        existing.assigned_scope = assigned_scope
        db.commit()
        db.refresh(existing)
        return _serialize(existing)

    item = AuditPlanAuditor(
        tenant_id=user.tenant_id,
        audit_plan_id=plan.id,
        user_id=target.id,
        assignment_role=assignment_role,
        assigned_scope=assigned_scope,
        assigned_at=datetime.utcnow(),
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    return _serialize(item)


@router.put("/{plan_id}/auditors/{user_id}")
def update_audit_plan_auditor(
    plan_id: int,
    user_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    plan = _get_plan(db, user, plan_id)

    item = db.execute(
        select(AuditPlanAuditor).where(
            and_(
                AuditPlanAuditor.audit_plan_id == plan_id,
                AuditPlanAuditor.tenant_id == user.tenant_id,
                AuditPlanAuditor.user_id == user_id,
            )
        )
    ).scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Audit team member not found",
        )

    assignment_role = str(
        payload.get("assignment_role") or item.assignment_role
    ).strip().upper()

    if assignment_role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=400,
            detail="Invalid audit team role",
        )

    if assignment_role == "LEAD_AUDITOR":
        if plan.lead_auditor_id != user_id:
            raise HTTPException(
                status_code=409,
                detail="Lead auditor assignment must match the audit plan lead auditor",
            )

    item.assignment_role = assignment_role
    item.assigned_scope = payload.get(
        "assigned_scope",
        item.assigned_scope,
    )

    db.commit()
    db.refresh(item)

    return _serialize(item)


@router.delete("/{plan_id}/auditors/{user_id}")
def remove_audit_plan_auditor(
    plan_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    plan = _get_plan(db, user, plan_id)

    if plan.lead_auditor_id == user_id:
        raise HTTPException(
            status_code=409,
            detail="Lead auditor cannot be removed from the audit team",
        )

    item = db.execute(
        select(AuditPlanAuditor).where(
            and_(
                AuditPlanAuditor.audit_plan_id == plan_id,
                AuditPlanAuditor.tenant_id == user.tenant_id,
                AuditPlanAuditor.user_id == user_id,
            )
        )
    ).scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Audit team member not found",
        )

    db.delete(item)
    db.commit()

    return {
        "ok": True,
        "audit_plan_id": plan_id,
        "user_id": user_id,
    }
