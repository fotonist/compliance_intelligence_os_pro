from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.audit_finding_workflow_events import AuditFindingWorkflowEvent
from app.models.user import User
from app.routes.audit_findings import _get_finding, _serialize

router = APIRouter(prefix="/audit/findings", tags=["Audit Finding Workflow"])


@router.get("/{finding_id}/workflow")
def get_workflow(
    finding_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    record = _get_finding(finding_id, db, user)
    events = (
        db.query(AuditFindingWorkflowEvent)
        .filter(
            AuditFindingWorkflowEvent.finding_id == record.id,
            AuditFindingWorkflowEvent.tenant_id == user.tenant_id,
        )
        .order_by(AuditFindingWorkflowEvent.created_at.asc(), AuditFindingWorkflowEvent.id.asc())
        .all()
    )
    return {
        "finding": _serialize(record),
        "events": [
            {
                "id": event.id,
                "actor_id": event.actor_id,
                "actor_role": event.actor_role,
                "action": event.action,
                "from_status": event.from_status,
                "to_status": event.to_status,
                "comment": event.comment,
                "created_at": event.created_at,
            }
            for event in events
        ],
    }
