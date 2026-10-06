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


def _tenant_action_query(
    db: Session,
    tenant_id: int,
):
    return db.query(ActionModel).filter(
        ActionModel.tenant_id == tenant_id
    )


def _get_tenant_action_or_404(
    db: Session,
    action_id: int,
    tenant_id: int,
) -> ActionModel:
    obj = (
        _tenant_action_query(db, tenant_id)
        .filter(ActionModel.id == action_id)
        .first()
    )

    if not obj:
        raise HTTPException(
            status_code=404,
            detail="Action not found",
        )

    return obj


def _validate_owner(
    db: Session,
    owner_id: int | None,
    tenant_id: int,
) -> None:
    if owner_id is None:
        return

    owner = (
        db.query(UserModel)
        .filter(
            UserModel.id == owner_id,
            UserModel.tenant_id == tenant_id,
        )
        .first()
    )

    if not owner:
        raise HTTPException(
            status_code=400,
            detail="Related owner user not found.",
        )


def _validate_risk(
    db: Session,
    risk_id: int | None,
    tenant_id: int,
) -> None:
    if risk_id is None:
        return

    risk = (
        db.query(RiskModel)
        .filter(
            RiskModel.id == risk_id,
            RiskModel.tenant_id == tenant_id,
        )
        .first()
    )

    if not risk:
        raise HTTPException(
            status_code=400,
            detail="Related risk not found.",
        )


def _validate_requirement(
    db: Session,
    requirement_id: int,
) -> None:
    requirement = (
        db.query(RequirementModel)
        .filter(RequirementModel.id == requirement_id)
        .first()
    )

    if not requirement:
        raise HTTPException(
            status_code=400,
            detail="Related requirement not found.",
        )


@router.get("/", response_model=List[Action])
def list_actions(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    return (
        _tenant_action_query(db, user.tenant_id)
        .order_by(ActionModel.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/by-risk/{risk_id}", response_model=List[Action])
def get_actions_by_risk(
    risk_id: int,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    risk = (
        db.query(RiskModel)
        .filter(
            RiskModel.id == risk_id,
            RiskModel.tenant_id == user.tenant_id,
        )
        .first()
    )

    if not risk:
        raise HTTPException(
            status_code=404,
            detail="Risk not found",
        )

    return (
        _tenant_action_query(db, user.tenant_id)
        .filter(ActionModel.risk_id == risk_id)
        .order_by(ActionModel.id.desc())
        .all()
    )


@router.get("/by-owner/{owner_id}", response_model=List[Action])
def get_actions_by_owner(
    owner_id: int,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    owner = (
        db.query(UserModel)
        .filter(
            UserModel.id == owner_id,
            UserModel.tenant_id == user.tenant_id,
        )
        .first()
    )

    if not owner:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return (
        _tenant_action_query(db, user.tenant_id)
        .filter(ActionModel.owner_id == owner_id)
        .order_by(
            ActionModel.due_date,
            ActionModel.id.desc(),
        )
        .all()
    )


@router.get("/{action_id}", response_model=Action)
def get_action(
    action_id: int,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    return _get_tenant_action_or_404(
        db,
        action_id,
        user.tenant_id,
    )


@router.post(
    "/",
    response_model=Action,
    status_code=status.HTTP_201_CREATED,
)
def create_action(
    action_in: ActionCreate,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    _validate_requirement(
        db,
        action_in.requirement_id,
    )

    _validate_risk(
        db,
        action_in.risk_id,
        user.tenant_id,
    )

    _validate_owner(
        db,
        action_in.owner_id,
        user.tenant_id,
    )

    status_value = (action_in.status or "OPEN").upper()
    priority_value = (action_in.priority or "MEDIUM").upper()

    if status_value not in {
        "OPEN",
        "IN_PROGRESS",
        "COMPLETED",
    }:
        raise HTTPException(
            status_code=400,
            detail="Invalid action status",
        )

    if priority_value not in {
        "LOW",
        "MEDIUM",
        "HIGH",
        "CRITICAL",
    }:
        raise HTTPException(
            status_code=400,
            detail="Invalid action priority",
        )

    obj = ActionModel(
        tenant_id=user.tenant_id,
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
def update_action(
    action_id: int,
    action_in: ActionUpdate,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    obj = _get_tenant_action_or_404(
        db,
        action_id,
        user.tenant_id,
    )

    data = action_in.model_dump(exclude_unset=True)

    if "requirement_id" in data:
        _validate_requirement(
            db,
            data["requirement_id"],
        )

    if "risk_id" in data:
        _validate_risk(
            db,
            data["risk_id"],
            user.tenant_id,
        )

    if "owner_id" in data:
        _validate_owner(
            db,
            data["owner_id"],
            user.tenant_id,
        )

    if "status" in data and data["status"] is not None:
        data["status"] = str(data["status"]).upper()

        if data["status"] not in {
            "OPEN",
            "IN_PROGRESS",
            "COMPLETED",
        }:
            raise HTTPException(
                status_code=400,
                detail="Invalid action status",
            )

    if "priority" in data and data["priority"] is not None:
        data["priority"] = str(data["priority"]).upper()

        if data["priority"] not in {
            "LOW",
            "MEDIUM",
            "HIGH",
            "CRITICAL",
        }:
            raise HTTPException(
                status_code=400,
                detail="Invalid action priority",
            )

    if "title" in data and data["title"] is not None:
        data["title"] = data["title"].strip()

    for field, value in data.items():
        setattr(obj, field, value)

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
    user: UserModel = Depends(get_current_user),
):
    obj = _get_tenant_action_or_404(
        db,
        action_id,
        user.tenant_id,
    )

    db.delete(obj)
    db.commit()
