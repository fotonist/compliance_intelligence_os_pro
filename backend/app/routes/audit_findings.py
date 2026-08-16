from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.audit_execution_records import AuditExecutionRecord
from app.models.audit_finding_records import AuditFindingRecord
from app.models.audit_finding_workflow_events import AuditFindingWorkflowEvent
from app.models.audit_plans import AuditPlan
from app.models.user import User

router = APIRouter(prefix="/audit/findings", tags=["Audit Findings"])

FINDING_STATUSES = {
    "OPEN", "ASSIGNED", "OWNER_RESPONSE", "SUBMITTED_FOR_REVIEW",
    "REVISION_REQUIRED", "PLAN_APPROVED", "IN_PROGRESS",
    "READY_FOR_VERIFICATION", "VERIFICATION_FAILED", "CLOSED",
}

ROLE_ALIASES = {
    "superadmin": "superadmin", "super_admin": "superadmin",
    "internal_auditor": "internal_auditor", "internal_audit": "internal_auditor",
    "auditor": "internal_auditor", "process_manager": "process_manager",
    "processmanager": "process_manager", "process_owner": "process_manager",
    "compliance_manager": "process_manager", "admin": "admin",
}


def _roles(user: User) -> set[str]:
    result = set()
    for role in (user.roles or []):
        raw = str(role.name).strip().lower().replace("-", "_").replace(" ", "_")
        result.add(ROLE_ALIASES.get(raw, raw))
    return result


def _is_superadmin(user: User) -> bool:
    return "superadmin" in _roles(user)


def _has_role(user: User, *allowed: str) -> bool:
    return _is_superadmin(user) or bool(_roles(user).intersection(allowed))


def _actor_role(user: User) -> str | None:
    roles = sorted(_roles(user))
    return roles[0] if roles else None


def _get_finding(finding_id: int, db: Session, user: User) -> AuditFindingRecord:
    record = db.query(AuditFindingRecord).filter(
        and_(AuditFindingRecord.id == finding_id, AuditFindingRecord.tenant_id == user.tenant_id)
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Finding not found")
    return record


def _get_tenant_user(user_id: int, db: Session, current_user: User) -> User:
    target = db.query(User).filter(
        User.id == user_id, User.tenant_id == current_user.tenant_id
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found in current tenant")
    return target


def _event(record, db, user, action, from_status, to_status, comment=None):
    db.add(AuditFindingWorkflowEvent(
        tenant_id=record.tenant_id,
        finding_id=record.id,
        actor_id=user.id,
        actor_role=_actor_role(user),
        action=action,
        from_status=from_status,
        to_status=to_status,
        comment=comment,
        created_at=datetime.utcnow(),
    ))


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
        "assigned_owner_id": record.assigned_owner_id,
        "assigned_owner_name": record.assigned_owner.full_name if record.assigned_owner else None,
        "assigned_owner_email": record.assigned_owner.email if record.assigned_owner else None,
        "process_manager_id": record.process_manager_id,
        "process_manager_name": record.process_manager.full_name if record.process_manager else None,
        "process_manager_email": record.process_manager.email if record.process_manager else None,
        "due_date": record.due_date.isoformat() if record.due_date else None,
        "root_cause": record.root_cause,
        "correction": record.correction,
        "corrective_action_plan": record.corrective_action_plan,
        "recommendation": record.recommendation,
        "owner_submitted_at": record.owner_submitted_at,
        "owner_submitted_by": record.owner_submitted_by,
        "manager_review_status": record.manager_review_status,
        "manager_review_comment": record.manager_review_comment,
        "manager_reviewed_by": record.manager_reviewed_by,
        "manager_reviewed_at": record.manager_reviewed_at,
        "implementation_status": record.implementation_status,
        "implementation_completed_at": record.implementation_completed_at,
        "implementation_evidence": record.implementation_evidence,
        "verification_status": record.verification_status,
        "verification_comment": record.verification_comment,
        "verified_by": record.verified_by,
        "verified_at": record.verified_at,
        "closed_by": record.closed_by,
        "closed_at": record.closed_at,
        "closure_comment": record.closure_comment,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
    }


@router.get("")
def list_findings(plan_id: int | None = None, status: str | None = None,
                  severity: str | None = None, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    query = db.query(AuditFindingRecord).filter(AuditFindingRecord.tenant_id == user.tenant_id)
    if plan_id is not None:
        query = query.filter(AuditFindingRecord.audit_plan_id == plan_id)
    if status and status != "ALL":
        query = query.filter(AuditFindingRecord.status == status.upper())
    if severity and severity != "ALL":
        query = query.filter(AuditFindingRecord.severity == severity.upper())
    return [_serialize(x) for x in query.order_by(AuditFindingRecord.updated_at.desc()).all()]


@router.get("/{finding_id}")
def get_finding(finding_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _serialize(_get_finding(finding_id, db, user))


@router.get("/{finding_id}/workflow")
def get_workflow(finding_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    record = _get_finding(finding_id, db, user)
    events = db.query(AuditFindingWorkflowEvent).filter(
        AuditFindingWorkflowEvent.finding_id == record.id,
        AuditFindingWorkflowEvent.tenant_id == user.tenant_id,
    ).order_by(AuditFindingWorkflowEvent.created_at.asc(), AuditFindingWorkflowEvent.id.asc()).all()
    return {
        "finding": _serialize(record),
        "events": [{
            "id": e.id, "actor_id": e.actor_id, "actor_role": e.actor_role,
            "action": e.action, "from_status": e.from_status, "to_status": e.to_status,
            "comment": e.comment, "created_at": e.created_at,
        } for e in events],
    }


@router.post("")
def create_finding(payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    plan_id = payload.get("audit_plan_id")
    control_id = payload.get("control_id")
    execution_id = payload.get("execution_id")
    title = (payload.get("title") or "").strip()
    description = (payload.get("description") or "").strip()
    if not plan_id or not control_id or not title or not description:
        raise HTTPException(status_code=400, detail="audit_plan_id, control_id, title and description are required")

    plan = db.query(AuditPlan).filter(
        and_(AuditPlan.id == plan_id, AuditPlan.tenant_id == user.tenant_id)
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Audit plan not found")

    if execution_id:
        execution = db.query(AuditExecutionRecord).filter(
            and_(AuditExecutionRecord.id == execution_id,
                 AuditExecutionRecord.audit_plan_id == plan_id,
                 AuditExecutionRecord.tenant_id == user.tenant_id)
        ).first()
        if not execution:
            raise HTTPException(status_code=404, detail="Audit execution record not found")

    due_date = None
    if payload.get("due_date"):
        try:
            due_date = date.fromisoformat(payload["due_date"])
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid due_date") from exc

    severity = (payload.get("severity") or "MEDIUM").upper()
    if severity not in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}:
        raise HTTPException(status_code=400, detail="Invalid finding severity")

    owner = _get_tenant_user(int(payload["assigned_owner_id"]), db, user) if payload.get("assigned_owner_id") else None
    manager = _get_tenant_user(int(payload["process_manager_id"]), db, user) if payload.get("process_manager_id") else None
    initial_status = "ASSIGNED" if owner else "OPEN"

    record = AuditFindingRecord(
        tenant_id=user.tenant_id, audit_plan_id=plan_id, execution_id=execution_id,
        process_id=plan.process_id, control_id=control_id, created_by=user.id,
        assigned_owner_id=owner.id if owner else None,
        process_manager_id=manager.id if manager else None,
        title=title, description=description, requirement=payload.get("requirement"),
        objective_evidence=payload.get("objective_evidence"), severity=severity,
        status=initial_status, owner=(owner.full_name or owner.email) if owner else payload.get("owner"),
        due_date=due_date, root_cause=payload.get("root_cause"),
        correction=payload.get("correction"), corrective_action_plan=payload.get("corrective_action_plan"),
        recommendation=payload.get("recommendation"), created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
    )
    db.add(record)
    db.flush()
    _event(record, db, user, "FINDING_CREATED", None, initial_status)
    if owner:
        _event(record, db, user, "OWNER_ASSIGNED", initial_status, initial_status)
    if manager:
        _event(record, db, user, "PROCESS_MANAGER_ASSIGNED", initial_status, initial_status)
    db.commit()
    db.refresh(record)
    return _serialize(record)


@router.patch("/{finding_id}")
def update_finding(finding_id: int, payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    record = _get_finding(finding_id, db, user)
    if record.status == "CLOSED":
        raise HTTPException(status_code=409, detail="Closed findings are immutable")

    if any(k in payload for k in {"title", "description", "requirement", "objective_evidence", "severity", "owner", "due_date"}):
        if not (_has_role(user, "internal_auditor", "admin") or record.assigned_owner_id == user.id or record.process_manager_id == user.id):
            raise HTTPException(status_code=403, detail="You are not authorized to edit this finding")

    for field in ["title", "description", "requirement", "objective_evidence", "owner"]:
        if field in payload:
            value = payload[field]
            if field in {"title", "description"}:
                value = (value or "").strip()
                if not value:
                    raise HTTPException(status_code=400, detail=f"{field} cannot be empty")
            setattr(record, field, value)
    if "severity" in payload:
        value = str(payload["severity"]).upper()
        if value not in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}:
            raise HTTPException(status_code=400, detail="Invalid finding severity")
        record.severity = value
    if "due_date" in payload:
        record.due_date = date.fromisoformat(payload["due_date"]) if payload["due_date"] else None
    if "status" in payload:
        raise HTTPException(status_code=400, detail="Finding status must be changed through controlled workflow endpoints")
    record.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(record)
    return _serialize(record)


@router.post("/{finding_id}/assign-owner")
def assign_owner(finding_id: int, payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not _has_role(user, "internal_auditor", "process_manager", "admin"):
        raise HTTPException(status_code=403, detail="Only an auditor, process manager or administrator can assign finding ownership")
    record = _get_finding(finding_id, db, user)
    if record.status == "CLOSED":
        raise HTTPException(status_code=409, detail="Closed findings cannot be reassigned")
    if not payload.get("assigned_owner_id"):
        raise HTTPException(status_code=400, detail="assigned_owner_id is required")

    owner = _get_tenant_user(int(payload["assigned_owner_id"]), db, user)
    manager = _get_tenant_user(int(payload["process_manager_id"]), db, user) if payload.get("process_manager_id") else record.process_manager
    old_status = record.status
    record.assigned_owner_id = owner.id
    record.owner = owner.full_name or owner.email
    if manager:
        record.process_manager_id = manager.id
    record.status = "ASSIGNED"
    record.updated_at = datetime.utcnow()
    _event(record, db, user, "OWNER_ASSIGNED", old_status, record.status, payload.get("comment"))
    if manager:
        _event(record, db, user, "PROCESS_MANAGER_ASSIGNED", record.status, record.status, payload.get("manager_comment"))
    db.commit()
    db.refresh(record)
    return _serialize(record)


@router.post("/{finding_id}/owner-response")
def save_owner_response(finding_id: int, payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    record = _get_finding(finding_id, db, user)
    if not (_is_superadmin(user) or record.assigned_owner_id == user.id):
        raise HTTPException(status_code=403, detail="Only the assigned owner can submit the finding response")
    if record.status not in {"ASSIGNED", "OWNER_RESPONSE", "REVISION_REQUIRED", "VERIFICATION_FAILED"}:
        raise HTTPException(status_code=409, detail=f"Owner response is not allowed while finding is {record.status}")

    for field in ["root_cause", "correction", "corrective_action_plan", "recommendation", "implementation_evidence"]:
        if field in payload:
            setattr(record, field, (payload.get(field) or "").strip() or None)
    if "due_date" in payload:
        record.due_date = date.fromisoformat(payload["due_date"]) if payload["due_date"] else None
    old_status = record.status
    record.status = "OWNER_RESPONSE"
    record.manager_review_status = "NOT_SUBMITTED"
    record.updated_at = datetime.utcnow()
    _event(record, db, user, "OWNER_RESPONSE_SAVED", old_status, record.status, payload.get("comment"))
    db.commit()
    db.refresh(record)
    return _serialize(record)


@router.post("/{finding_id}/owner-submit")
def owner_submit(finding_id: int, payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    record = _get_finding(finding_id, db, user)
    if not (_is_superadmin(user) or record.assigned_owner_id == user.id):
        raise HTTPException(status_code=403, detail="Only the assigned owner can submit the corrective action plan")
    if record.status not in {"OWNER_RESPONSE", "REVISION_REQUIRED", "VERIFICATION_FAILED"}:
        raise HTTPException(status_code=409, detail=f"Submission is not allowed while finding is {record.status}")
    if not (record.root_cause or "").strip():
        raise HTTPException(status_code=400, detail="Root cause is required before submission")
    if not (record.corrective_action_plan or "").strip():
        raise HTTPException(status_code=400, detail="Corrective action plan is required before submission")
    if not record.due_date:
        raise HTTPException(status_code=400, detail="Target date is required before submission")
    if not record.process_manager_id:
        raise HTTPException(status_code=400, detail="A process manager must be assigned before submission")

    old_status = record.status
    record.status = "SUBMITTED_FOR_REVIEW"
    record.owner_submitted_at = datetime.utcnow()
    record.owner_submitted_by = user.id
    record.manager_review_status = "PENDING"
    record.manager_review_comment = None
    record.updated_at = datetime.utcnow()
    _event(record, db, user, "OWNER_SUBMITTED_FOR_REVIEW", old_status, record.status, payload.get("comment"))
    db.commit()
    db.refresh(record)
    return _serialize(record)


@router.post("/{finding_id}/manager-approve")
def manager_approve(finding_id: int, payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    record = _get_finding(finding_id, db, user)
    if not (_is_superadmin(user) or record.process_manager_id == user.id or _has_role(user, "process_manager")):
        raise HTTPException(status_code=403, detail="Only the assigned process manager can approve the corrective action plan")
    if record.status != "SUBMITTED_FOR_REVIEW":
        raise HTTPException(status_code=409, detail=f"Manager approval is not allowed while finding is {record.status}")

    old_status = record.status
    record.status = "PLAN_APPROVED"
    record.manager_review_status = "APPROVED"
    record.manager_review_comment = (payload.get("comment") or "").strip() or None
    record.manager_reviewed_by = user.id
    record.manager_reviewed_at = datetime.utcnow()
    record.updated_at = datetime.utcnow()
    _event(record, db, user, "PLAN_APPROVED", old_status, record.status, record.manager_review_comment)
    db.commit()
    db.refresh(record)
    return _serialize(record)


@router.post("/{finding_id}/manager-revision")
def manager_revision(finding_id: int, payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    record = _get_finding(finding_id, db, user)
    if not (_is_superadmin(user) or record.process_manager_id == user.id or _has_role(user, "process_manager")):
        raise HTTPException(status_code=403, detail="Only the assigned process manager can request a revision")
    if record.status != "SUBMITTED_FOR_REVIEW":
        raise HTTPException(status_code=409, detail=f"Revision request is not allowed while finding is {record.status}")
    comment = (payload.get("comment") or "").strip()
    if not comment:
        raise HTTPException(status_code=400, detail="A revision comment is required")

    old_status = record.status
    record.status = "REVISION_REQUIRED"
    record.manager_review_status = "REVISION_REQUIRED"
    record.manager_review_comment = comment
    record.manager_reviewed_by = user.id
    record.manager_reviewed_at = datetime.utcnow()
    record.updated_at = datetime.utcnow()
    _event(record, db, user, "REVISION_REQUIRED", old_status, record.status, comment)
    db.commit()
    db.refresh(record)
    return _serialize(record)


@router.post("/{finding_id}/implementation-complete")
def implementation_complete(finding_id: int, payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    record = _get_finding(finding_id, db, user)
    if not (_is_superadmin(user) or record.assigned_owner_id == user.id):
        raise HTTPException(status_code=403, detail="Only the assigned owner can mark implementation complete")
    if record.status != "PLAN_APPROVED":
        raise HTTPException(status_code=409, detail=f"Implementation completion is not allowed while finding is {record.status}")
    evidence = (payload.get("implementation_evidence") or "").strip()
    if not evidence:
        raise HTTPException(status_code=400, detail="Implementation evidence is required")

    old_status = record.status
    record.status = "READY_FOR_VERIFICATION"
    record.implementation_status = "COMPLETED"
    record.implementation_completed_at = datetime.utcnow()
    record.implementation_evidence = evidence
    record.verification_status = "PENDING"
    record.updated_at = datetime.utcnow()
    _event(record, db, user, "IMPLEMENTATION_COMPLETED", old_status, record.status, payload.get("comment"))
    db.commit()
    db.refresh(record)
    return _serialize(record)


@router.post("/{finding_id}/verify")
def verify_finding(finding_id: int, payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not _has_role(user, "internal_auditor"):
        raise HTTPException(status_code=403, detail="Only an internal auditor can verify and close a finding")
    record = _get_finding(finding_id, db, user)
    if record.status != "READY_FOR_VERIFICATION":
        raise HTTPException(status_code=409, detail=f"Verification is not allowed while finding is {record.status}")
    effective = payload.get("effective")
    if not isinstance(effective, bool):
        raise HTTPException(status_code=400, detail="effective must be true or false")
    comment = (payload.get("comment") or "").strip()
    if not comment:
        raise HTTPException(status_code=400, detail="Verification comment is required")

    old_status = record.status
    record.verification_comment = comment
    record.verified_by = user.id
    record.verified_at = datetime.utcnow()
    record.updated_at = datetime.utcnow()
    if effective:
        record.verification_status = "EFFECTIVE"
        record.status = "CLOSED"
        record.closed_by = user.id
        record.closed_at = datetime.utcnow()
        record.closure_comment = comment
        action = "VERIFIED_AND_CLOSED"
    else:
        record.verification_status = "INEFFECTIVE"
        record.status = "VERIFICATION_FAILED"
        action = "VERIFICATION_FAILED"
    _event(record, db, user, action, old_status, record.status, comment)
    db.commit()
    db.refresh(record)
    return _serialize(record)
