from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.actions import Action as ActionModel
from app.models.requirements import Requirement as RequirementModel
from app.models.risks import Risk as RiskModel
from app.models.user import User as UserModel
from app.schemas.action_schema import Action, ActionCreate, ActionUpdate

router = APIRouter(prefix="/actions", tags=["Actions"])


@router.get("/", response_model=List[Action])
def list_actions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    return (
        db.query(ActionModel)
        .outerjoin(UserModel, UserModel.id == ActionModel.owner_id)
        .filter((UserModel.tenant_id == user.tenant_id) | (ActionModel.owner_id.is_(None)))
        .order_by(ActionModel.id.desc())
        .offset(skip).limit(limit).all()
    )


@router.get("/by-risk/{risk_id}", response_model=List[Action])
def get_actions_by_risk(risk_id: int, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    if not db.query(RiskModel).filter(RiskModel.id == risk_id).first():
        raise HTTPException(status_code=404, detail="Risk not found")
    return (
        db.query(ActionModel)
        .outerjoin(UserModel, UserModel.id == ActionModel.owner_id)
        .filter(ActionModel.risk_id == risk_id, (UserModel.tenant_id == user.tenant_id) | (ActionModel.owner_id.is_(None)))
        .order_by(ActionModel.id.desc()).all()
    )


@router.get("/by-owner/{owner_id}", response_model=List[Action])
def get_actions_by_owner(owner_id: int, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    owner = db.query(UserModel).filter(UserModel.id == owner_id, UserModel.tenant_id == user.tenant_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="User not found")
    return db.query(ActionModel).filter(ActionModel.owner_id == owner_id).order_by(ActionModel.due_date, ActionModel.id.desc()).all()


@router.get("/{action_id}", response_model=Action)
def get_action(action_id: int, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    obj = (
        db.query(ActionModel)
        .outerjoin(UserModel, UserModel.id == ActionModel.owner_id)
        .filter(ActionModel.id == action_id, (UserModel.tenant_id == user.tenant_id) | (ActionModel.owner_id.is_(None)))
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Action not found")
    return obj


@router.post("/", response_model=Action, status_code=status.HTTP_201_CREATED)
def create_action(action_in: ActionCreate, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    if not db.query(RequirementModel).filter(RequirementModel.id == action_in.requirement_id).first():
        raise HTTPException(status_code=400, detail="Related requirement not found.")
    if action_in.risk_id is not None and not db.query(RiskModel).filter(RiskModel.id == action_in.risk_id).first():
        raise HTTPException(status_code=400, detail="Related risk not found.")
    if action_in.owner_id is not None and not db.query(UserModel).filter(UserModel.id == action_in.owner_id, UserModel.tenant_id == user.tenant_id).first():
        raise HTTPException(status_code=400, detail="Related owner user not found.")

    status_value = (action_in.status or "OPEN").upper()
    priority_value = (action_in.priority or "MEDIUM").upper()
    if status_value not in {"OPEN", "IN_PROGRESS", "COMPLETED"}:
        raise HTTPException(status_code=400, detail="Invalid action status")
    if priority_value not in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}:
        raise HTTPException(status_code=400, detail="Invalid action priority")

    obj = ActionModel(
        requirement_id=action_in.requirement_id,
        title=action_in.title.strip(),
        description=(action_in.description or "").strip() or None,
        risk_id=action_in.risk_id,
        owner_id=action_in.owner_id,
        due_date=action_in.due_date,
        status=status_value,
        priority=priority_value,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{action_id}", response_model=Action)
def update_action(action_id: int, action_in: ActionUpdate, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    obj = (
        db.query(ActionModel)
        .outerjoin(UserModel, UserModel.id == ActionModel.owner_id)
        .filter(ActionModel.id == action_id, (UserModel.tenant_id == user.tenant_id) | (ActionModel.owner_id.is_(None)))
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Action not found")

    data = action_in.model_dump(exclude_unset=True)
    if "requirement_id" in data and not db.query(RequirementModel).filter(RequirementModel.id == data["requirement_id"]).first():
        raise HTTPException(status_code=400, detail="Related requirement not found.")
    if "risk_id" in data and data["risk_id"] is not None and not db.query(RiskModel).filter(RiskModel.id == data["risk_id"]).first():
        raise HTTPException(status_code=400, detail="Related risk not found.")
    if "owner_id" in data and data["owner_id"] is not None and not db.query(UserModel).filter(UserModel.id == data["owner_id"], UserModel.tenant_id == user.tenant_id).first():
        raise HTTPException(status_code=400, detail="Related owner user not found.")
    if "status" in data and data["status"] is not None:
        data["status"] = str(data["status"]).upper()
    if "priority" in data and data["priority"] is not None:
        data["priority"] = str(data["priority"]).upper()
    if "title" in data and data["title"] is not None:
        data["title"] = data["title"].strip()
    for field, value in data.items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{action_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_action(action_id: int, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    obj = (
        db.query(ActionModel)
        .outerjoin(UserModel, UserModel.id == ActionModel.owner_id)
        .filter(ActionModel.id == action_id, (UserModel.tenant_id == user.tenant_id) | (ActionModel.owner_id.is_(None)))
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Action not found")
    db.delete(obj)
    db.commit()
