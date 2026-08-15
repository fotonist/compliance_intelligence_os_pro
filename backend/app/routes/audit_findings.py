from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.audit_execution_records import AuditExecutionRecord
from app.models.audit_finding_records import AuditFindingRecord
from app.models.audit_plans import AuditPlan
from app.models.user import User

router = APIRouter(prefix="/audit/findings", tags=["Audit Findings"])


@router.get("")
def list_findings(
    plan_id: int | None = None,
    status: str | None = None,
    severity: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(AuditFindingRecord).filter(AuditFindingRecord.tenant_id == user.tenant_id)
    if plan_id is not None:
        query = query.filter(AuditFindingRecord.audit_plan_id == plan_id)
    if status and status != "ALL":
        query = query.filter(AuditFindingRecord.status == status)
    if severity and severity != "ALL":
        query = query.filter(AuditFindingRecord.severity == severity)

    records = query.order_by(AuditFindingRecord.updated_at.desc()).all()
    return [_serialize(record) for record in records]


@router.post("")
def create_finding(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    plan_id = payload.get("audit_plan_id")
    control_id = payload.get("control_id")
    execution_id = payload.get("execution_id")
    title = (payload.get("title") or "").strip()
    description = (payload.get("description") or "").strip()

    if not plan_id or not control_id or not title or not description:
        raise HTTPException(
            status_code=400,
            detail="audit_plan_id, control_id, title and description are required",
        )

    plan = (
        db.query(AuditPlan)
        .filter(and_(AuditPlan.id == plan_id, AuditPlan.tenant_id == user.tenant_id))
        .first()
    )
    if not plan:
        raise HTTPException(status_code=404, detail="Audit plan not found")

    if execution_id:
        execution = (
            db.query(AuditExecutionRecord)
            .filter(
                and_(
                    AuditExecutionRecord.id == execution_id,
                    AuditExecutionRecord.audit_plan_id == plan_id,
                    AuditExecutionRecord.tenant_id == user.tenant_id,
                )
            )
            .first()
        )
        if not execution:
            raise HTTPException(status_code=404, detail="Audit execution record not found")

    due_date = None
    if payload.get("due_date"):
        try:
            from datetime import date
            due_date = date.fromisoformat(payload["due_date"])
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid due_date") from exc

    severity = (payload.get("severity") or "MEDIUM").upper()
    status = (payload.get("status") or "OPEN").upper()
    if severity not in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}:
        raise HTTPException(status_code=400, detail="Invalid finding severity")
    if status not in {"OPEN", "IN_PROGRESS", "CLOSED"}:
        raise HTTPException(status_code=400, detail="Invalid finding status")

    record = AuditFindingRecord(
        tenant_id=user.tenant_id,
        audit_plan_id=plan_id,
        execution_id=execution_id,
        process_id=plan.process_id,
        control_id=control_id,
        created_by=user.id,
        title=title,
        description=description,
        requirement=payload.get("requirement"),
        objective_evidence=payload.get("objective_evidence"),
        severity=severity,
        status=status,
        owner=payload.get("owner"),
        due_date=due_date,
        root_cause=payload.get("root_cause"),
        recommendation=payload.get("recommendation"),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _serialize(record)


@router.patch("/{finding_id}")
def update_finding(
    finding_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    record = (
        db.query(AuditFindingRecord)
        .filter(and_(AuditFindingRecord.id == finding_id, AuditFindingRecord.tenant_id == user.tenant_id))
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Finding not found")

    for field in [
        "title",
        "description",
        "requirement",
        "objective_evidence",
        "owner",
        "root_cause",
        "recommendation",
    ]:
        if field in payload:
            setattr(record, field, payload[field])

    if "severity" in payload:
        value = str(payload["severity"]).upper()
        if value not in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}:
            raise HTTPException(status_code=400, detail="Invalid finding severity")
        record.severity = value
    if "status" in payload:
        value = str(payload["status"]).upper()
        if value not in {"OPEN", "IN_PROGRESS", "CLOSED"}:
            raise HTTPException(status_code=400, detail="Invalid finding status")
        record.status = value
    if "due_date" in payload:
        from datetime import date
        record.due_date = date.fromisoformat(payload["due_date"]) if payload["due_date"] else None

    record.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(record)
    return _serialize(record)


def _serialize(record: AuditFindingRecord) -> dict:
    return {
        "id": record.id,
        "audit_plan_id": record.audit_plan_id,
        "execution_id": record.execution_id,
        "process_id": record.process_id,
        "control_id": record.control_id,
        "title": record.title,
        "description": record.description,
        "requirement": record.requirement,
        "objective_evidence": record.objective_evidence,
        "severity": record.severity,
        "status": record.status,
        "owner": record.owner,
        "due_date": record.due_date.isoformat() if record.due_date else None,
        "root_cause": record.root_cause,
        "recommendation": record.recommendation,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
    }
