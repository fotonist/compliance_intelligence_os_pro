from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
# from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.core.rbac import require_admin

router = APIRouter(prefix="/admin/audit-logs", tags=["Admin"])


@router.get("", dependencies=[Depends(require_admin)])
def list_audit_logs(
    entity_type: str | None = None,
    actor_id: int | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog).order_by(AuditLog.created_at.desc())

    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)

    if actor_id:
        q = q.filter(AuditLog.actor_id == actor_id)

    return q.all()
