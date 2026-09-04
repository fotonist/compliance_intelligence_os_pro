from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.ai_audit_log import AIAuditLog

# ğŸ” AUTH / ACCESS LAYER
from app.dependencies.permission_checker import require_permission
from app.dependencies.scope_checker import require_tenant_scope
from app.dependencies.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/ai", tags=["AI"])


@router.get("/audit-logs")
def list_ai_audit_logs(
    scope: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("forecast.view")),
    tenant_scope=Depends(require_tenant_scope()),
):
    """
    List AI audit logs.
    Restricted:
        - Permission: forecast.view (Board only)
        - Scope: tenant-wide
    """

    q = db.query(AIAuditLog)

    if scope:
        q = q.filter(AIAuditLog.scope == scope)

    total = q.count()

    rows = (
        q.order_by(AIAuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "items": [
            {
                "id": r.id,
                "scope": r.scope,
                "summary": r.summary,
                "root_causes": r.root_causes,
                "warnings": r.warnings,
                "actions": r.actions,
                "kpi_snapshot": r.kpi_snapshot,
                "user_id": r.user_id,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.get("/audit-logs/{log_id}")
def get_ai_audit_log_detail(
    log_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("forecast.view")),
    tenant_scope=Depends(require_tenant_scope()),
):
    log = (
        db.query(AIAuditLog)
        .filter(AIAuditLog.id == log_id)
        .first()
    )

    if not log:
        raise HTTPException(
            status_code=404,
            detail="AI audit log not found"
        )

    return {
        "id": log.id,
        "scope": log.scope,
        "summary": log.summary,
        "root_causes": log.root_causes,
        "warnings": log.warnings,
        "actions": log.actions,
        "kpi_snapshot": log.kpi_snapshot,
        "user_id": log.user_id,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }
