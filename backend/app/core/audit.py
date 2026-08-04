from typing import Optional
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def create_log(
    db: Session,
    user_id: Optional[int],
    action: str,
    entity: Optional[str] = None,
    entity_id: Optional[int] = None,
    detail: Optional[str] = None,
) -> None:
    """
    Basit kullanım:
        create_log(db, user_id=1, action="assign_role",
                   entity="User", entity_id=1, detail="Assigned role 'admin'")
    """
    log = AuditLog(
        user_id=user_id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        detail=detail,
    )
    db.add(log)
    db.commit()
