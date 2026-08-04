from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from datetime import datetime

from app.core.database import get_db
from app.core.security import require_roles, get_current_user
from app.models.audit_log import AuditLog
from app.models.user import User
from app.models.audit_sessions import AuditSession

router = APIRouter(prefix="/audit", tags=["Audit"])


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

    # ✅ tenant_id artık JWT'den geliyor
    tenant_id = user.tenant_id

    standard_id = payload.get("standard_id")
    standard_version_id = payload.get("standard_version_id")
    audit_type = payload.get("type")

    if not standard_id or not standard_version_id:
        raise HTTPException(status_code=400, detail="Missing required fields")

    # Close existing ACTIVE audit if exists
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
