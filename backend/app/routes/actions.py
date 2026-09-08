from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.actions import Action as ActionModel
from app.models.action_lifecycle_history import ActionLifecycleHistory
from app.models.requirements import Requirement as RequirementModel
from app.models.risks import Risk as RiskModel
from app.models.user import User as UserModel
from app.schemas.action_schema import Action, ActionCreate, ActionUpdate, ActionTransitionRequest
from app.services.action_lifecycle import (
    STATUS_ASSIGNED,
    STATUS_CLOSED,
    STATUS_IN_PROGRESS,
    STATUS_OPEN,
    STATUS_REVISION_REQUIRED,
    STATUS_SUBMITTED_FOR_REVIEW,
    STATUS_VERIFIED,
    transition_action,
)

router = APIRouter(prefix="/actions", tags=["Actions"])


def get_scoped_action(
    db: Session,
    action_id: int,
    user: UserModel,
) -> ActionModel:
    obj = (
        db.query(ActionModel)
        .join(
            UserModel,
            UserModel.id == ActionModel.owner_id,
        )
        .filter(
            ActionModel.id == action_id,
            UserModel.tenant_id == user.tenant_id,
        )
        .first()
    )

    if not obj:
        raise HTTPException(
            status_code=404,
            detail="Action not found",
        )

    return obj


def get_user_in_tenant(
    db: Session,
    user_id: int,
    tenant_id: int,
) -> UserModel:
    obj = (
        db.query(UserModel)
        .filter(
            UserModel.id == user_id,
            UserModel.tenant_id == tenant_id,
        )
        .first()
    )

    if not obj:
        raise HTTPException(
            status_code=400,
            detail="User not found",
        )

    return obj


@router.get("/", response_model=List[Action])
def list_actions(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    return (
        db.query(ActionModel)
        .join(
            UserModel,
            UserModel.id == ActionModel.owner_id,
        )
        .filter(
            UserModel.tenant_id == user.tenant_id,
        )
        .order_by(ActionModel.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get(
    "/by-risk/{risk_id}",
    response_model=List[Action],
)
def get_actions_by_risk(
    risk_id: int,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    risk = (
        db.query(RiskModel)
        .filter(RiskModel.id == risk_id)
        .first()
    )

    if not risk:
        raise HTTPException(
            status_code=404,
            detail="Risk not found",
        )

    return (
        db.query(ActionModel)
        .join(
            UserModel,
            UserModel.id == ActionModel.owner_id,
        )
        .filter(
            ActionModel.risk_id == risk_id,
            UserModel.tenant_id == user.tenant_id,
        )
        .order_by(ActionModel.id.desc())
        .all()
    )


@router.get(
    "/by-owner/{owner_id}",
    response_model=List[Action],
)
def get_actions_by_owner(
    owner_id: int,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    get_user_in_tenant(
        db,
        owner_id,
        user.tenant_id,
    )

    return (
        db.query(ActionModel)
        .join(
            UserModel,
            UserModel.id == ActionModel.owner_id,
        )
        .filter(
            ActionModel.owner_id == owner_id,
            UserModel.tenant_id == user.tenant_id,
        )
        .order_by(
            ActionModel.due_date,
            ActionModel.id.desc(),
        )
        .all()
    )


@router.get(
    "/{action_id}",
    response_model=Action,
)
def get_action(
    action_id: int,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    return get_scoped_action(
        db,
        action_id,
        user,
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
    requirement = (
        db.query(RequirementModel)
        .filter(
            RequirementModel.id == action_in.requirement_id,
        )
        .first()
    )

    if not requirement:
        raise HTTPException(
            status_code=400,
            detail="Related requirement not found.",
        )

    if action_in.risk_id is not None:
        risk = (
            db.query(RiskModel)
            .filter(RiskModel.id == action_in.risk_id)
            .first()
        )

        if not risk:
            raise HTTPException(
                status_code=400,
                detail="Related risk not found.",
            )

    owner_id = getattr(action_in, "owner_id", None)

    if owner_id is not None:
        get_user_in_tenant(
            db,
            owner_id,
            user.tenant_id,
        )

    priority_value = (
        str(action_in.priority or "MEDIUM").upper()
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
        requirement_id=action_in.requirement_id,
        title=action_in.title.strip(),
        description=(
            (action_in.description or "").strip()
            or None
        ),
        risk_id=action_in.risk_id,
        user_id=owner_id,
        created_by_user_id=user.id,
        assigned_to_user_id=owner_id,
        due_date=action_in.due_date,
        status=STATUS_OPEN,
        priority=priority_value,
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    return obj


@router.put(
    "/{action_id}",
    response_model=Action,
)
def update_action(
    action_id: int,
    action_in: ActionUpdate,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    obj = get_scoped_action(
        db,
        action_id,
        user,
    )

    data = action_in.model_dump(
        exclude_unset=True,
    )

    if "status" in data:
        raise HTTPException(
            status_code=400,
            detail=(
                "Action status must be changed "
                "through the lifecycle endpoints."
            ),
        )

    if "requirement_id" in data:
        requirement = (
            db.query(RequirementModel)
            .filter(
                RequirementModel.id
                == data["requirement_id"],
            )
            .first()
        )

        if not requirement:
            raise HTTPException(
                status_code=400,
                detail="Related requirement not found.",
            )

    if "risk_id" in data:
        if data["risk_id"] is not None:
            risk = (
                db.query(RiskModel)
                .filter(
                    RiskModel.id == data["risk_id"],
                )
                .first()
            )

            if not risk:
                raise HTTPException(
                    status_code=400,
                    detail="Related risk not found.",
                )

    if "owner_id" in data:
        owner_id = data.pop("owner_id")

        if owner_id is not None:
            get_user_in_tenant(
                db,
                owner_id,
                user.tenant_id,
            )

        obj.owner_id = owner_id
        obj.assigned_to_user_id = owner_id

    if "priority" in data:
        priority_value = (
            str(data["priority"]).upper()
            if data["priority"] is not None
            else None
        )

        if priority_value is not None:
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

            data["priority"] = priority_value

    if "title" in data and data["title"] is not None:
        data["title"] = data["title"].strip()

    for field, value in data.items():
        if field == "owner_id":
            continue

        if hasattr(obj, field):
            setattr(obj, field, value)

    db.commit()
    db.refresh(obj)

    return obj


@router.get(
    "/{action_id}/lifecycle",
)
def get_action_lifecycle(
    action_id: int,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    action = get_scoped_action(
        db,
        action_id,
        user,
    )

    rows = (
        db.query(ActionLifecycleHistory)
        .filter(
            ActionLifecycleHistory.action_id
            == action.id,
        )
        .order_by(
            ActionLifecycleHistory.created_at.asc(),
            ActionLifecycleHistory.id.asc(),
        )
        .all()
    )

    return [
        {
            "id": row.id,
            "action_id": row.action_id,
            "from_status": row.from_status,
            "to_status": row.to_status,
            "performed_by_user_id": row.performed_by_user_id,
            "comment": row.comment,
            "created_at": row.created_at,
        }
        for row in rows
    ]


@router.post(
    "/{action_id}/assign",
    response_model=Action,
)
def assign_action(
    action_id: int,
    payload: ActionTransitionRequest,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    action = get_scoped_action(
        db,
        action_id,
        user,
    )

    assigned_to_user_id = payload.assigned_to_user_id
    reviewer_user_id = payload.reviewer_user_id

    if assigned_to_user_id is None:
        raise HTTPException(
            status_code=422,
            detail="assigned_to_user_id is required",
        )

    get_user_in_tenant(
        db,
        int(assigned_to_user_id),
        user.tenant_id,
    )

    if reviewer_user_id is not None:
        get_user_in_tenant(
            db,
            int(reviewer_user_id),
            user.tenant_id,
        )

    return transition_action(
        db=db,
        action=action,
        transition="assign",
        actor=user,
        comment=payload.comment,
        assigned_to_user_id=int(assigned_to_user_id),
        reviewer_user_id=(
            int(reviewer_user_id)
            if reviewer_user_id is not None
            else None
        ),
    )


@router.post(
    "/{action_id}/start",
    response_model=Action,
)
def start_action(
    action_id: int,
    payload: ActionTransitionRequest,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    action = get_scoped_action(
        db,
        action_id,
        user,
    )

    return transition_action(
        db=db,
        action=action,
        transition="start",
        actor=user,
        comment=payload.comment,
    )


@router.post(
    "/{action_id}/submit-for-review",
    response_model=Action,
)
def submit_action_for_review(
    action_id: int,
    payload: ActionTransitionRequest,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    action = get_scoped_action(
        db,
        action_id,
        user,
    )

    return transition_action(
        db=db,
        action=action,
        transition="submit_for_review",
        actor=user,
        comment=payload.comment,
    )


@router.post(
    "/{action_id}/request-revision",
    response_model=Action,
)
def request_action_revision(
    action_id: int,
    payload: ActionTransitionRequest,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    action = get_scoped_action(
        db,
        action_id,
        user,
    )

    return transition_action(
        db=db,
        action=action,
        transition="request_revision",
        actor=user,
        comment=payload.comment,
    )


@router.post(
    "/{action_id}/verify",
    response_model=Action,
)
def verify_action(
    action_id: int,
    payload: ActionTransitionRequest,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    action = get_scoped_action(
        db,
        action_id,
        user,
    )

    return transition_action(
        db=db,
        action=action,
        transition="verify",
        actor=user,
        comment=payload.comment,
    )


@router.post(
    "/{action_id}/close",
    response_model=Action,
)
def close_action(
    action_id: int,
    payload: ActionTransitionRequest,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    action = get_scoped_action(
        db,
        action_id,
        user,
    )

    return transition_action(
        db=db,
        action=action,
        transition="close",
        actor=user,
        comment=payload.comment,
    )


@router.post(
    "/{action_id}/reopen",
    response_model=Action,
)
def reopen_action(
    action_id: int,
    payload: ActionTransitionRequest,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    action = get_scoped_action(
        db,
        action_id,
        user,
    )

    return transition_action(
        db=db,
        action=action,
        transition="reopen",
        actor=user,
        comment=payload.comment,
    )


@router.delete(
    "/{action_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_action(
    action_id: int,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    obj = get_scoped_action(
        db,
        action_id,
        user,
    )

    db.delete(obj)
    db.commit()
