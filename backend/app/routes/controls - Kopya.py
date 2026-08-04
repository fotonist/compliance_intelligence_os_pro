from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

# ⚠ Bu import kalsın, dokunma
from app.core.database import get_db as core_get_db

# ⚠ Çalışan DB session importu
from app.db.session import get_db as session_get_db

# 🔥 ZORUNLU & GARANTİ OVERRIDE
get_db = session_get_db

from app.models.controls import Control as ControlModel
from app.models.requirements import Requirement as RequirementModel
from app.models.clauses import Clause as ClauseModel
from app.models.standard_versions import StandardVersion

from app.schemas.controls_schema import (
    Control,
    ControlCreate,
    ControlUpdate,
)

router = APIRouter(
    prefix="/controls",
    tags=["Controls"],
)

# -------------------------------------------------------
# LIST CONTROLS (READ-ONLY, SAFE)
# -------------------------------------------------------
@router.get("/", response_model=List[Control])
def list_controls(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    controls = (
        db.query(ControlModel)
        .order_by(ControlModel.code)
        .offset(skip)
        .limit(limit)
        .all()
    )

    return [
        {
            "id": c.id,
            "code": c.code,
            "title": c.title,
            "requirement_id": c.requirement_id,
        }
        for c in controls
    ]


# -------------------------------------------------------
# CREATE CONTROL (DRAFT ONLY)
# -------------------------------------------------------
@router.post(
    "/",
    response_model=Control,
    status_code=status.HTTP_201_CREATED,
)
def create_control(
    control_in: ControlCreate,
    db: Session = Depends(get_db),
):
    requirement = (
        db.query(RequirementModel)
        .filter(RequirementModel.id == control_in.requirement_id)
        .first()
    )
    if not requirement:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Related requirement not found",
        )

    clause = (
        db.query(ClauseModel)
        .filter(ClauseModel.id == requirement.clause_id)
        .first()
    )
    if not clause:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Related clause not found",
        )

    # 🔒 DRAFT VERSION KİLİDİ
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

    obj = ControlModel(
        code=control_in.code,
        title=control_in.title,
        description=getattr(control_in, "description", None),
        requirement_id=control_in.requirement_id,
        standard_version_id=sv.id,
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


# -------------------------------------------------------
# UPDATE CONTROL (DRAFT ONLY)
# -------------------------------------------------------
@router.put("/{control_id}", response_model=Control)
def update_control(
    control_id: int,
    control_in: ControlUpdate,
    db: Session = Depends(get_db),
):
    obj = (
        db.query(ControlModel)
        .filter(ControlModel.id == control_id)
        .first()
    )
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Control not found",
        )

    requirement = (
        db.query(RequirementModel)
        .filter(RequirementModel.id == obj.requirement_id)
        .first()
    )
    if not requirement:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Related requirement not found",
        )

    clause = (
        db.query(ClauseModel)
        .filter(ClauseModel.id == requirement.clause_id)
        .first()
    )
    if not clause:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Related clause not found",
        )

    # 🔒 DRAFT VERSION KİLİDİ
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

    update_data = control_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(obj, field, value)

    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


# -------------------------------------------------------
# DELETE CONTROL (DRAFT ONLY)
# -------------------------------------------------------
@router.delete(
    "/{control_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_control(
    control_id: int,
    db: Session = Depends(get_db),
):
    obj = (
        db.query(ControlModel)
        .filter(ControlModel.id == control_id)
        .first()
    )
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Control not found",
        )

    requirement = (
        db.query(RequirementModel)
        .filter(RequirementModel.id == obj.requirement_id)
        .first()
    )
    if not requirement:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Related requirement not found",
        )

    clause = (
        db.query(ClauseModel)
        .filter(ClauseModel.id == requirement.clause_id)
        .first()
    )
    if not clause:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Related clause not found",
        )

    # 🔒 DRAFT VERSION KİLİDİ
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

    db.delete(obj)
    db.commit()
    return None
