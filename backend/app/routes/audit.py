from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime

from app.core.database import get_db
from app.core.security import require_roles, get_current_user
from app.models.audit_log import AuditLog
from app.models.user import User
from app.models.audit_sessions import AuditSession
from app.models.audit_plans import AuditPlan
from app.models.audit_execution_records import AuditExecutionRecord
from app.models.controls import Control
from app.services.audit_plan_engine import AuditPlanEngine
from app.schemas.audit_plan_schema import AuditPlanResponse

router = APIRouter(prefix="/audit", tags=["Audit"])


def _sync_audit_plan_status(
    plan: AuditPlan,
    db: Session,
    user: User,
) -> None:
    """
    Keep the persistent audit-plan lifecycle aligned with its execution records.

    DRAFT      -> no execution records exist yet
    IN_PROGRESS -> at least one execution record exists, but not all planned
                   audit actions are completed
    COMPLETED  -> every risk-based audit action has a COMPLETED execution record
    """
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

        if planned_control_ids and planned_control_ids.issubset(completed_control_ids):
            plan.status = "COMPLETED"
            return

    plan.status = "IN_PROGRESS"


# ============================================================
# TENANT-SAFE LOG ENDPOINT
# ============================================================

@router.get("/logs")
def get_logs(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
):
    logs = (
        db.query(AuditLog)
        .join(User, AuditLog.user_id == User.id, isouter=True)
        .filter(User.tenant_id == user.tenant_id)
        .order_by(AuditLog.timestamp.desc())
        .limit(200)
        .all()
    )

    result = []
    for log in logs:
        result.append(
            {
                "id": log.id,
                "user_email": log.user.email if log.user else "Unknown",
                "action": log.action,
                "entity": log.entity,
                "entity_id": log.entity_id,
                "detail": log.detail,
                "timestamp": log.timestamp,
            }
        )

    return result


# ============================================================
# START AUDIT SESSION (TENANT SAFE)
# ============================================================

@router.post("/start")
def start_audit(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Creates a new ACTIVE audit session.
    If an ACTIVE session exists for same tenant + standard_version,
    it will be CLOSED automatically.
    """

    tenant_id = user.tenant_id

    standard_id = payload.get("standard_id")
    standard_version_id = payload.get("standard_version_id")
    audit_type = payload.get("type")

    if not standard_id or not standard_version_id:
        raise HTTPException(status_code=400, detail="Missing required fields")

    existing = (
        db.query(AuditSession)
        .filter(
            and_(
                AuditSession.tenant_id == tenant_id,
                AuditSession.standard_version_id == standard_version_id,
                AuditSession.status == "ACTIVE",
            )
        )
        .first()
    )

    if existing:
        existing.status = "CLOSED"
        existing.closed_at = datetime.utcnow()

    new_session = AuditSession(
        tenant_id=tenant_id,
        standard_id=standard_id,
        standard_version_id=standard_version_id,
        status="ACTIVE",
        type=audit_type,
        created_by=user.id,
    )

    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    return {
        "message": "Audit session started",
        "audit_session_id": new_session.id,
        "status": new_session.status,
    }


# ============================================================
# RISK-BASED AUDIT PLAN
# ============================================================

@router.get("/plan/{process_id}", response_model=AuditPlanResponse)
def generate_audit_plan(
    process_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Generates a tenant-safe, risk-based audit plan for a process.

    The plan is derived from the existing Compliance Intelligence OS
    signals: risk severity, control coverage weakness, forecasted
    escalation probability, and expected risk-score delta.
    """
    try:
        return AuditPlanEngine.generate(
            process_id=process_id,
            db=db,
            user=user,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


# ============================================================
# AUDIT EXECUTION RECORDS
# ============================================================

@router.get("/execution")
def list_execution_records(
    plan_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    plan = (
        db.query(AuditPlan)
        .filter(
            and_(
                AuditPlan.id == plan_id,
                AuditPlan.tenant_id == user.tenant_id,
            )
        )
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Audit plan not found")

    records = (
        db.query(AuditExecutionRecord)
        .filter(
            and_(
                AuditExecutionRecord.audit_plan_id == plan_id,
                AuditExecutionRecord.tenant_id == user.tenant_id,
            )
        )
        .order_by(AuditExecutionRecord.updated_at.desc())
        .all()
    )

    return [
        {
            "id": record.id,
            "audit_plan_id": record.audit_plan_id,
            "process_id": record.process_id,
            "control_id": record.control_id,
            "auditor_id": record.auditor_id,
            "status": record.status,
            "result": record.result,
            "observation": record.observation,
            "conclusion": record.conclusion,
            "started_at": record.started_at,
            "completed_at": record.completed_at,
            "created_at": record.created_at,
            "updated_at": record.updated_at,
        }
        for record in records
    ]


@router.post("/execution")
def save_execution_record(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    plan_id = payload.get("audit_plan_id")
    control_id = payload.get("control_id")
    process_id = payload.get("process_id")
    status = (payload.get("status") or "READY").upper()
    result = payload.get("result")
    observation = payload.get("observation")
    conclusion = payload.get("conclusion")

    if not plan_id or not control_id:
        raise HTTPException(status_code=400, detail="audit_plan_id and control_id are required")

    allowed_statuses = {"READY", "IN_PROGRESS", "COMPLETED", "EXCEPTION"}
    if status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Invalid execution status")

    plan = (
        db.query(AuditPlan)
        .filter(
            and_(
                AuditPlan.id == plan_id,
                AuditPlan.tenant_id == user.tenant_id,
            )
        )
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Audit plan not found")

    control = db.query(Control).filter(Control.id == control_id).first()
    if not control:
        raise HTTPException(status_code=404, detail="Control not found")

    if plan.process_id is not None and process_id is not None and int(process_id) != int(plan.process_id):
        raise HTTPException(status_code=400, detail="Process does not match the audit plan scope")

    effective_process_id = plan.process_id if plan.process_id is not None else process_id

    record = (
        db.query(AuditExecutionRecord)
        .filter(
            and_(
                AuditExecutionRecord.audit_plan_id == plan_id,
                AuditExecutionRecord.control_id == control_id,
                AuditExecutionRecord.tenant_id == user.tenant_id,
            )
        )
        .first()
    )

    now = datetime.utcnow()
    if record is None:
        record = AuditExecutionRecord(
            tenant_id=user.tenant_id,
            audit_plan_id=plan_id,
            process_id=effective_process_id,
            control_id=control_id,
            auditor_id=user.id,
            created_at=now,
        )
        db.add(record)

    record.process_id = effective_process_id
    record.auditor_id = user.id
    record.status = status
    record.result = result
    record.observation = observation
    record.conclusion = conclusion
    record.updated_at = now
    if status == "IN_PROGRESS" and record.started_at is None:
        record.started_at = now
    if status == "COMPLETED":
        if record.started_at is None:
            record.started_at = now
        record.completed_at = now

    _sync_audit_plan_status(plan=plan, db=db, user=user)

    db.commit()
    db.refresh(record)
    db.refresh(plan)

    return {
        "id": record.id,
        "audit_plan_id": record.audit_plan_id,
        "process_id": record.process_id,
        "control_id": record.control_id,
        "status": record.status,
        "result": record.result,
        "observation": record.observation,
        "conclusion": record.conclusion,
        "auditor_id": record.auditor_id,
        "started_at": record.started_at,
        "completed_at": record.completed_at,
        "updated_at": record.updated_at,
        "audit_plan_status": plan.status,
    }


# ============================================================
# GET AUDIT SESSION (TENANT SAFE)
# ============================================================

@router.get("/{session_id}")
def get_audit_session(
    session_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = (
        db.query(AuditSession)
        .filter(
            and_(
                AuditSession.id == session_id,
                AuditSession.tenant_id == user.tenant_id,
            )
        )
        .first()
    )

    if not session:
        raise HTTPException(status_code=404, detail="Audit session not found")

    return {
        "id": session.id,
        "tenant_id": session.tenant_id,
        "standard_id": session.standard_id,
        "standard_version_id": session.standard_version_id,
        "status": session.status,
        "type": session.type,
        "created_at": session.created_at,
        "closed_at": session.closed_at,
    }


# ============================================================
# CLOSE AUDIT SESSION (TENANT SAFE)
# ============================================================

@router.post("/{session_id}/close")
def close_audit(
    session_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    session = (
        db.query(AuditSession)
        .filter(
            and_(
                AuditSession.id == session_id,
                AuditSession.tenant_id == user.tenant_id,
            )
        )
        .first()
    )

    if not session:
        raise HTTPException(status_code=404, detail="Audit session not found")

    if session.status != "ACTIVE":
        raise HTTPException(status_code=400, detail="Audit session not active")

    session.status = "CLOSED"
    session.closed_at = datetime.utcnow()

    db.commit()

    return {
        "message": "Audit session closed",
        "audit_session_id": session.id,
        "status": session.status,
    }
