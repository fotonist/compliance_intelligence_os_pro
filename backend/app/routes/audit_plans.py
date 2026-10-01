from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.audit_execution_records import AuditExecutionRecord
from app.models.audit_maturity_target import AuditMaturityTarget
from app.models.audit_plans import AuditPlan
from app.models.standard_versions import StandardVersion
from app.models.process import Process
from app.models.user import User
from app.models.role import Role
from app.models.user_role import UserRole
from app.models.standards import Standard

from app.schemas.audit_plan_create_schema import (
    AuditPlanCreate,
    AuditPlanDetail,
    AuditPlanSummary,
)
from app.services.audit_plan_engine import AuditPlanEngine

router = APIRouter(prefix="/audit/plans", tags=["Audit Plans"])


def _is_maturity_plan(plan: AuditPlan, db: Session) -> bool:
    if plan.standard_id is None:
        return False

    standard_type = (
        db.query(Standard.type)
        .filter(Standard.id == plan.standard_id)
        .scalar()
    )

    return str(standard_type or "").strip().upper() == "MATURITY_BASED"


def _sync_maturity_plan_status(
    plan: AuditPlan,
    db: Session,
    user: User,
) -> None:
    targets = (
        db.query(AuditMaturityTarget)
        .filter(
            AuditMaturityTarget.audit_plan_id == plan.id,
            AuditMaturityTarget.tenant_id == user.tenant_id,
        )
        .all()
    )

    if not targets:
        plan.status = "DRAFT"
        return

    statuses = {
        str(target.status or "").strip().upper()
        for target in targets
    }

    if statuses == {"COMPLETED"}:
        plan.status = "COMPLETED"
        return

    plan.status = "IN_PROGRESS"


def _sync_control_plan_status(
    plan: AuditPlan,
    db: Session,
    user: User,
) -> None:
    records = (
        db.query(AuditExecutionRecord)
        .filter(
            and_(
                AuditExecutionRecord.audit_plan_id == plan.id,
                AuditExecutionRecord.tenant_id == user.tenant_id,
            )
        )
        .all()
    )

    if not records:
        plan.status = "DRAFT"
        return

    completed_control_ids = {
        int(record.control_id)
        for record in records
        if str(record.status or "").upper() == "COMPLETED"
    }

    if plan.process_id is not None:
        try:
            risk_plan = AuditPlanEngine.generate(
                process_id=plan.process_id,
                db=db,
                user=user,
            )
            planned_control_ids = {
                int(action.control_id)
                for action in risk_plan.actions
            }
        except ValueError:
            planned_control_ids = set()

        if (
            planned_control_ids
            and planned_control_ids.issubset(completed_control_ids)
        ):
            plan.status = "COMPLETED"
            return

    plan.status = "IN_PROGRESS"


def _sync_plan_status(
    plan: AuditPlan,
    db: Session,
    user: User,
) -> None:
    if _is_maturity_plan(plan, db):
        _sync_maturity_plan_status(
            plan=plan,
            db=db,
            user=user,
        )
        return

    _sync_control_plan_status(
        plan=plan,
        db=db,
        user=user,
    )


def _sync_plans(plans: list[AuditPlan], db: Session, user: User) -> None:
    changed = False
    for plan in plans:
        previous = plan.status
        _sync_plan_status(plan=plan, db=db, user=user)
        if plan.status != previous:
            changed = True
    if changed:
        db.commit()


def _validate_process_scope(
    process_id: int | None,
    db: Session,
    user: User,
) -> None:
    if process_id is None:
        return

    process = (
        db.query(Process)
        .filter(
            Process.id == process_id,
            Process.tenant_id == user.tenant_id,
        )
        .first()
    )
    if not process:
        raise HTTPException(status_code=404, detail="Process not found")


def _normalized_role_names(user: User) -> set[str]:
    return {
        str(role.name)
        .strip()
        .lower()
        .replace("-", "_")
        .replace(" ", "_")
        for role in (user.roles or [])
        if getattr(role, "is_active", True)
    }


def _can_manage_audit_plans(user: User) -> bool:
    roles = _normalized_role_names(user)

    return bool(
        roles.intersection(
            {
                "admin",
                "tenantadmin",
                "tenant_admin",
                "superadmin",
                "super_admin",
            }
        )
    )


def _require_audit_plan_manager(user: User) -> None:
    if not _can_manage_audit_plans(user):
        raise HTTPException(
            status_code=403,
            detail="Admin or SuperAdmin role is required to manage audit plans",
        )

def _validate_lead_auditor(
    lead_auditor_id: int | None,
    db: Session,
    user: User,
) -> None:
    if lead_auditor_id is None:
        raise HTTPException(
            status_code=400,
            detail="Lead auditor is required",
        )

    auditor = (
        db.query(User)
        .filter(
            User.id == lead_auditor_id,
            User.tenant_id == user.tenant_id,
        )
        .first()
    )

    if not auditor:
        raise HTTPException(
            status_code=404,
            detail="Lead auditor not found",
        )

    status = str(
        getattr(auditor, "status", "") or ""
    ).strip().upper()

    if status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail="Lead auditor must be active",
        )

    if bool(getattr(auditor, "is_locked", False)):
        raise HTTPException(
            status_code=400,
            detail="Lead auditor must not be locked",
        )

    active_role_names = {
        str(name)
        .strip()
        .lower()
        .replace("-", "_")
        .replace(" ", "_")
        for (name,) in (
            db.query(Role.name)
            .join(
                UserRole,
                UserRole.role_id == Role.id,
            )
            .filter(
                UserRole.user_id == auditor.id,
                Role.is_active.is_(True),
            )
            .all()
        )
    }

    if not (
        "auditor" in active_role_names
        or "internal_auditor" in active_role_names
        or "internal_audit" in active_role_names
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Lead auditor must have an active "
                "Internal Auditor role"
            ),
        )



def _validate_standard_scope(
    standard_id,
    standard_version_id,
    db: Session,
):
    if standard_id is None and standard_version_id is None:
        return

    if standard_id is None or standard_version_id is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "standard_id and standard_version_id "
                "must be provided together"
            ),
        )

    standard = (
        db.query(Standard)
        .filter(Standard.id == standard_id)
        .first()
    )
    if not standard:
        raise HTTPException(
            status_code=404,
            detail="Standard not found",
        )

    version = (
        db.query(StandardVersion)
        .filter(
            StandardVersion.id == standard_version_id,
            StandardVersion.standard_id == standard_id,
        )
        .first()
    )
    if not version:
        raise HTTPException(
            status_code=400,
            detail="Standard version does not belong to standard",
        )

@router.post("", response_model=AuditPlanDetail, status_code=201)
def create_audit_plan(
    payload: AuditPlanCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _require_audit_plan_manager(user)

    reference = payload.reference.strip()
    name = payload.name.strip()
    audit_type = payload.audit_type.strip().lower()

    if not reference:
        raise HTTPException(status_code=400, detail="Audit plan reference is required")
    if not name:
        raise HTTPException(status_code=400, detail="Audit plan name is required")
    if not audit_type:
        raise HTTPException(status_code=400, detail="Audit type is required")

    if payload.planned_start and payload.planned_end and payload.planned_end < payload.planned_start:
        raise HTTPException(status_code=400, detail="Planned end date cannot be before planned start date")

    _validate_standard_scope(
        payload.standard_id,
        payload.standard_version_id,
        db,
    )
    _validate_process_scope(payload.process_id, db, user)
    _validate_lead_auditor(payload.lead_auditor_id, db, user)

    existing = (
        db.query(AuditPlan)
        .filter(
            AuditPlan.tenant_id == user.tenant_id,
            AuditPlan.reference == reference,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Audit plan reference already exists")

    plan = AuditPlan(
        tenant_id=user.tenant_id,
        reference=reference,
        name=name,
        audit_type=audit_type,
        objective=payload.objective.strip() if payload.objective and payload.objective.strip() else None,
        scope=payload.scope.strip() if payload.scope and payload.scope.strip() else None,
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
    framework_type: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(AuditPlan).filter(
        AuditPlan.tenant_id == user.tenant_id
    )

    if framework_type:
        normalized_type = framework_type.strip().upper()

        if normalized_type not in {
            "CONTROL_BASED",
            "MATURITY_BASED",
        }:
            raise HTTPException(
                status_code=400,
                detail="Invalid framework_type",
            )

        if normalized_type == "MATURITY_BASED":
            query = (
                query
                .join(
                    Standard,
                    Standard.id == AuditPlan.standard_id,
                )
                .filter(
                    Standard.type == "MATURITY_BASED"
                )
            )
        else:
            maturity_plan_ids = (
                db.query(AuditPlan.id)
                .join(
                    Standard,
                    Standard.id == AuditPlan.standard_id,
                )
                .filter(
                    AuditPlan.tenant_id == user.tenant_id,
                    Standard.type == "MATURITY_BASED",
                )
            )

            query = query.filter(
                ~AuditPlan.id.in_(maturity_plan_ids)
            )

    plans = (
        query
        .order_by(AuditPlan.created_at.desc())
        .all()
    )

    _sync_plans(plans, db, user)
    return plans


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

    _sync_plan_status(plan, db, user)
    db.commit()
    db.refresh(plan)
    return plan
