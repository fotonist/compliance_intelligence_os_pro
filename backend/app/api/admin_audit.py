from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from app.core.rbac import require_admin
from app.db.session import get_db
from app.models.audit_log import AuditLog


router = APIRouter(prefix="/admin/audit-logs", tags=["Admin"])


def serialize_audit_log(row: AuditLog) -> dict:
    actor = row.user

    return {
        "id": row.id,
        "actor_id": row.actor_id,
        "actor_role": row.actor_role,
        "actor": (
            {
                "id": actor.id,
                "tenant_id": actor.tenant_id,
                "full_name": actor.full_name,
                "email": actor.email,
            }
            if actor is not None
            else None
        ),
        "entity_type": row.entity_type,
        "entity_id": row.entity_id,
        "action": row.action,
        "old_value": row.old_value,
        "new_value": row.new_value,
        "created_at": row.created_at,
    }


@router.get("", dependencies=[Depends(require_admin)])
def list_audit_logs(
    entity_type: str | None = None,
    actor_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = (
        db.query(AuditLog)
        .options(joinedload(AuditLog.user))
        .order_by(AuditLog.created_at.desc())
    )

    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)

    if actor_id:
        query = query.filter(AuditLog.actor_id == actor_id)

    return [serialize_audit_log(row) for row in query.all()]
