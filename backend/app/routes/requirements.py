from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.requirements import Requirement as RequirementModel
from app.models.clauses import Clause as ClauseModel
from app.models.standard_versions import StandardVersion

from app.schemas.requirement_schema import (
    Requirement,
    RequirementCreate,
    RequirementUpdate,
)

# AUDIT
from app.services.audit_service import log_event

router = APIRouter(
    prefix="/requirements",
    tags=["Requirements"],
)

# -------------------------------------------------------
# LIST REQUIREMENTS (READ-ONLY)
# -------------------------------------------------------
@router.get("/", response_model=List[Requirement])
def list_requirements(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    items = (
        db.query(RequirementModel)
        .order_by(RequirementModel.code)
        .offset(skip)
        .limit(limit)
        .all()
    )

    return items


# -------------------------------------------------------
# CREATE REQUIREMENT (DRAFT ONLY + AUDIT)
# -------------------------------------------------------
@router.post(
    "/",
    response_model=Requirement,
    status_code=status.HTTP_201_CREATED,
)
def create_requirement(
    payload: RequirementCreate,
    db: Session = Depends(get_db),
):
    clause = (
        db.query(ClauseModel)
        .filter(ClauseModel.id == payload.clause_id)
        .first()
    )
    if not clause:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Related clause not found",
        )

    # 🔒 DRAFT GUARD
    sv = (
        db.query(StandardVersion)
        .filter(
            StandardVersion.id == clause.standard_version_id,
            StandardVersion.status == "draft",
        )
        .first()
    )
    if not sv:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify published standard version",
        )

    obj = RequirementModel(
        code=payload.code,
        title=payload.title,
        clause_id=payload.clause_id,
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    # 🧾 AUDIT
    log_event(
        db=db,
        actor=None,
        entity_type="requirement",
        entity_id=obj.id,
        action="create",
        old_value=None,
        new_value={
            "code": obj.code,
            "title": obj.title,
            "clause_id": obj.clause_id,
        },
    )

    return obj


# -------------------------------------------------------
# UPDATE REQUIREMENT (DRAFT ONLY + AUDIT)
# -------------------------------------------------------
@router.put("/{requirement_id}", response_model=Requirement)
def update_requirement(
    requirement_id: int,
    payload: RequirementUpdate,
    db: Session = Depends(get_db),
):
    obj = (
        db.query(RequirementModel)
        .filter(RequirementModel.id == requirement_id)
        .first()
    )
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requirement not found",
        )

    clause = (
        db.query(ClauseModel)
        .filter(ClauseModel.id == obj.clause_id)
        .first()
    )
    if not clause:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Related clause not found",
        )

    # 🔒 DRAFT GUARD
    sv = (
        db.query(StandardVersion)
        .filter(
            StandardVersion.id == clause.standard_version_id,
            StandardVersion.status == "draft",
        )
        .first()
    )
    if not sv:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify published standard version",
        )

    before = {
        "code": obj.code,
        "title": obj.title,
        "clause_id": obj.clause_id,
    }

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(obj, field, value)

    db.add(obj)
    db.commit()
    db.refresh(obj)

    # 🧾 AUDIT
    log_event(
        db=db,
        actor=None,
        entity_type="requirement",
        entity_id=obj.id,
        action="update",
        old_value=before,
        new_value={
            "code": obj.code,
            "title": obj.title,
            "clause_id": obj.clause_id,
        },
    )

    return obj


# -------------------------------------------------------
# DELETE REQUIREMENT (DRAFT ONLY + AUDIT)
# -------------------------------------------------------
@router.delete(
    "/{requirement_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_requirement(
    requirement_id: int,
    db: Session = Depends(get_db),
):
    obj = (
        db.query(RequirementModel)
        .filter(RequirementModel.id == requirement_id)
        .first()
    )
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requirement not found",
        )

    clause = (
        db.query(ClauseModel)
        .filter(ClauseModel.id == obj.clause_id)
        .first()
    )
    if not clause:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Related clause not found",
        )

    # 🔒 DRAFT GUARD
    sv = (
        db.query(StandardVersion)
        .filter(
            StandardVersion.id == clause.standard_version_id,
            StandardVersion.status == "draft",
        )
        .first()
    )
    if not sv:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify published standard version",
        )

    # 🧾 AUDIT (BEFORE DELETE)
    log_event(
        db=db,
        actor=None,
        entity_type="requirement",
        entity_id=obj.id,
        action="delete",
        old_value={
            "code": obj.code,
            "title": obj.title,
            "clause_id": obj.clause_id,
        },
        new_value=None,
    )

    db.delete(obj)
    db.commit()
    return None
