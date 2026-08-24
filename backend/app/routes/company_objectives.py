from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db

from app.models.company_objective import CompanyObjective
from app.models.user import User


router = APIRouter(
    prefix="/company/objectives",
    tags=["Company Objectives"],
)


def objective_response(objective):

    return {
        "id": objective.id,
        "code": objective.code,
        "title": objective.title,
        "description": objective.description,
        "tenant_id": objective.tenant_id,
        "objective_type": objective.objective_type,
        "priority": objective.priority,
        "status": objective.status,
        "owner_user_id": objective.owner_user_id,
        "target_date": objective.target_date,
        "measurement_method": objective.measurement_method,
        "target_value": objective.target_value,
        "current_value": objective.current_value,
        "unit": objective.unit,
        "created_at": objective.created_at,
        "updated_at": objective.updated_at,
    }


@router.get("")
def list_objectives(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = (
        select(CompanyObjective)
        .where(
            CompanyObjective.tenant_id == user.tenant_id
        )
        .order_by(
            CompanyObjective.code,
            CompanyObjective.id,
        )
    )

    objectives = db.execute(stmt).scalars().all()

    return [
        objective_response(objective)
        for objective in objectives
    ]


@router.get("/{objective_id}")
def get_objective(
    objective_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = select(CompanyObjective).where(
        CompanyObjective.id == objective_id,
        CompanyObjective.tenant_id == user.tenant_id,
    )

    objective = db.execute(stmt).scalar_one_or_none()

    if not objective:
        raise HTTPException(
            status_code=404,
            detail="Objective not found",
        )

    return objective_response(objective)


@router.post("")
def create_objective(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    code = str(payload.get("code", "")).strip()

    if not code:
        raise HTTPException(
            status_code=400,
            detail="Code is required",
        )

    title = str(payload.get("title", "")).strip()

    if not title:
        raise HTTPException(
            status_code=400,
            detail="Title is required",
        )

    existing_stmt = select(CompanyObjective).where(
        CompanyObjective.tenant_id == user.tenant_id,
        CompanyObjective.code == code,
    )

    existing = db.execute(existing_stmt).scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Objective code already exists",
        )

    owner_user_id = payload.get("owner_user_id")

    if owner_user_id:
        owner_stmt = select(User).where(
            User.id == owner_user_id,
            User.tenant_id == user.tenant_id,
        )

        owner = db.execute(owner_stmt).scalar_one_or_none()

        if not owner:
            raise HTTPException(
                status_code=400,
                detail="Owner user not found in current tenant",
            )

    objective = CompanyObjective(
        tenant_id=user.tenant_id,
        code=code,
        title=title,
        description=payload.get("description"),
        objective_type=payload.get(
            "objective_type",
            "strategic",
        ),
        priority=payload.get(
            "priority",
            "medium",
        ),
        status=payload.get(
            "status",
            "draft",
        ),
        owner_user_id=owner_user_id,
        target_date=payload.get("target_date"),
        measurement_method=payload.get(
            "measurement_method"
        ),
        target_value=payload.get(
            "target_value"
        ),
        current_value=payload.get(
            "current_value"
        ),
        unit=payload.get("unit"),
    )

    db.add(objective)
    db.commit()
    db.refresh(objective)

    return objective_response(objective)


@router.put("/{objective_id}")
def update_objective(
    objective_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = select(CompanyObjective).where(
        CompanyObjective.id == objective_id,
        CompanyObjective.tenant_id == user.tenant_id,
    )

    objective = db.execute(stmt).scalar_one_or_none()

    if not objective:
        raise HTTPException(
            status_code=404,
            detail="Objective not found",
        )

    if "code" in payload:

        code = str(payload.get("code")).strip()

        if not code:
            raise HTTPException(
                status_code=400,
                detail="Code cannot be empty",
            )

        duplicate_stmt = select(CompanyObjective).where(
            CompanyObjective.tenant_id == user.tenant_id,
            CompanyObjective.code == code,
            CompanyObjective.id != objective_id,
        )

        duplicate = db.execute(
            duplicate_stmt
        ).scalar_one_or_none()

        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="Objective code already exists",
            )

        objective.code = code

    if "title" in payload:

        title = str(payload.get("title")).strip()

        if not title:
            raise HTTPException(
                status_code=400,
                detail="Title cannot be empty",
            )

        objective.title = title

    for field in [
        "description",
        "objective_type",
        "priority",
        "status",
        "target_date",
        "measurement_method",
        "target_value",
        "current_value",
        "unit",
    ]:
        if field in payload:
            setattr(
                objective,
                field,
                payload[field],
            )

    if "owner_user_id" in payload:

        owner_user_id = payload["owner_user_id"]

        if owner_user_id:

            owner_stmt = select(User).where(
                User.id == owner_user_id,
                User.tenant_id == user.tenant_id,
            )

            owner = db.execute(
                owner_stmt
            ).scalar_one_or_none()

            if not owner:
                raise HTTPException(
                    status_code=400,
                    detail="Owner user not found in current tenant",
                )

        objective.owner_user_id = owner_user_id

    db.commit()
    db.refresh(objective)

    return objective_response(objective)


@router.delete("/{objective_id}")
def delete_objective(
    objective_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = select(CompanyObjective).where(
        CompanyObjective.id == objective_id,
        CompanyObjective.tenant_id == user.tenant_id,
    )

    objective = db.execute(stmt).scalar_one_or_none()

    if not objective:
        raise HTTPException(
            status_code=404,
            detail="Objective not found",
        )

    db.delete(objective)
    db.commit()

    return {
        "success": True,
        "deleted_id": objective_id,
    }


@router.post("/{objective_id}/publish")
def publish_objective(
    objective_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = select(CompanyObjective).where(
        CompanyObjective.id == objective_id,
        CompanyObjective.tenant_id == user.tenant_id,
    )

    objective = db.execute(stmt).scalar_one_or_none()

    if not objective:
        raise HTTPException(
            status_code=404,
            detail="Objective not found",
        )

    objective.status = "active"

    db.commit()
    db.refresh(objective)

    return {
        "success": True,
        "id": objective.id,
        "status": objective.status,
    }
