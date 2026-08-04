# app/services/action_service.py
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.action_model import Action
from app.schemas.action_schema import ActionCreate, ActionUpdate


def get_actions_by_requirement(
    db: Session, requirement_id: int
) -> List[Action]:
    return (
        db.query(Action)
        .filter(Action.requirement_id == requirement_id)
        .order_by(Action.due_date.nulls_last(), Action.created_at.desc())
        .all()
    )


def create_action(db: Session, data: ActionCreate) -> Action:
    action = Action(
        requirement_id=data.requirement_id,
        risk_id=data.risk_id,
        owner_id=data.owner_id,
        title=data.title,
        description=data.description,
        status=data.status or "OPEN",
        priority=data.priority or "MEDIUM",
        due_date=data.due_date,
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return action


def update_action(
    db: Session, action_id: int, data: ActionUpdate
) -> Optional[Action]:
    action = db.query(Action).filter(Action.id == action_id).first()
    if not action:
        return None

    update_data = data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(action, field, value)

    db.commit()
    db.refresh(action)
    return action


def delete_action(db: Session, action_id: int) -> bool:
    action = db.query(Action).filter(Action.id == action_id).first()
    if not action:
        return False
    db.delete(action)
    db.commit()
    return True
