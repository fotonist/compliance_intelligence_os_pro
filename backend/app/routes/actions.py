from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.actions import Action as ActionModel
from app.models.risks import Risk as RiskModel
from app.models.user import User as UserModel
from app.schemas.action_schema import Action, ActionCreate, ActionUpdate

router = APIRouter(
    prefix="/actions",
    tags=["Actions"],
)


@router.get("/", response_model=List[Action])
def list_actions(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    actions = (
        db.query(ActionModel)
        .order_by(ActionModel.id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return actions


@router.get("/{action_id}", response_model=Action)
def get_action(
    action_id: int,
    db: Session = Depends(get_db),
):
    obj = db.query(ActionModel).filter(ActionModel.id == action_id).first()
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Action not found",
        )
    return obj


@router.get("/by-risk/{risk_id}", response_model=List[Action])
def get_actions_by_risk(
    risk_id: int,
    db: Session = Depends(get_db),
):
    risk = db.query(RiskModel).filter(RiskModel.id == risk_id).first()
    if not risk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Risk not found",
        )

    actions = (
        db.query(ActionModel)
        .filter(ActionModel.risk_id == risk_id)
        .order_by(ActionModel.id)
        .all()
    )
    return actions


@router.get("/by-owner/{owner_id}", response_model=List[Action])
def get_actions_by_owner(
    owner_id: int,
    db: Session = Depends(get_db),
):
    user = db.query(UserModel).filter(UserModel.id == owner_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    actions = (
        db.query(ActionModel)
        .filter(ActionModel.owner_id == owner_id)
        .order_by(ActionModel.due_date)
        .all()
    )
    return actions


@router.post(
    "/",
    response_model=Action,
    status_code=status.HTTP_201_CREATED,
)
def create_action(
    action_in: ActionCreate,
    db: Session = Depends(get_db),
):
    if action_in.risk_id is not None:
        risk = db.query(RiskModel).filter(RiskModel.id == action_in.risk_id).first()
        if not risk:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Related risk not found.",
            )

    if action_in.owner_id is not None:
        user = db.query(UserModel).filter(UserModel.id == action_in.owner_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Related owner user not found.",
            )

    obj = ActionModel(
        title=action_in.title,
        description=action_in.description,
        risk_id=action_in.risk_id,
        owner_id=action_in.owner_id,
        due_date=action_in.due_date,
        status=action_in.status,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{action_id}", response_model=Action)
def update_action(
    action_id: int,
    action_in: ActionUpdate,
    db: Session = Depends(get_db),
):
    obj = db.query(ActionModel).filter(ActionModel.id == action_id).first()
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Action not found",
        )

    update_data = action_in.model_dump(exclude_unset=True)

    if "risk_id" in update_data and update_data["risk_id"] is not None:
        risk = db.query(RiskModel).filter(RiskModel.id == update_data["risk_id"]).first()
        if not risk:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Related risk not found.",
            )

    if "owner_id" in update_data and update_data["owner_id"] is not None:
        user = (
            db.query(UserModel)
            .filter(UserModel.id == update_data["owner_id"])
            .first()
        )
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Related owner user not found.",
            )

    for field, value in update_data.items():
        setattr(obj, field, value)

    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete(
    "/{action_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_action(
    action_id: int,
    db: Session = Depends(get_db),
):
    obj = db.query(ActionModel).filter(ActionModel.id == action_id).first()
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Action not found",
        )

    db.delete(obj)
    db.commit()
    return None
