from typing import Any, Optional
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog
from app.models.user import User


def log_event(
    *,
    db: Session,
    actor: Optional[User],
    entity_type: str,
    entity_id: Optional[int],
    action: str,
    old_value: Any = None,
    new_value: Any = None,
):
    log = AuditLog(
        actor_id=actor.id if actor else None,
        actor_role=actor.roles[0].name if actor and actor.roles else None,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        old_value=old_value,
        new_value=new_value,
    )
    db.add(log)
