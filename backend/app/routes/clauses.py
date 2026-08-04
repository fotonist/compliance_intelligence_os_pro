from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.models.standards import Standard
from app.routes.standards import ensure_draft
from app.db.session import get_db
from app.models.clauses import Clause as ClauseModel
from app.models.standard_versions import StandardVersion

from app.schemas.clause_schema import (
    Clause,
    ClauseCreate,
    ClauseUpdate,
)

# AUDIT
from app.services.audit_service import log_event

router = APIRouter(
    prefix="/clauses",
    tags=["Clauses"],
)

# -------------------------------------------------------
# LIST CLAUSES (READ-ONLY)
# -------------------------------------------------------
@router.get("/", response_model=List[Clause])
def list_clauses(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    items = (
        db.query(ClauseModel)
        .order_by(ClauseModel.code)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return items


# -------------------------------------------------------
# CREATE CLAUSE (DRAFT ONLY + AUDIT)
# -------------------------------------------------------
@router.post(
    "/",
    response_model=Clause,
    status_code=status.HTTP_201_CREATED,
)
@router.post("/", response_model=Clause, status_code=status.HTTP_201_CREATED)
def create_clause(
    payload: ClauseCreate,
    db: Session = Depends(get_db),
):
    standard = (
        db.query(Standard)
        .filter(Standard.id == payload.standard_id)
        .first()
    )
    if not standard:
        raise HTTPException(status_code=404, detail="Standard not found")

    draft = ensure_draft(db, standard)

    obj = ClauseModel(
        code=payload.code,
        title=payload.title,
        standard_id=standard.id,
        standard_version_id=draft.id,
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    log_event(
        db=db,
        actor=None,
        entity_type="clause",
        entity_id=obj.id,
        action="create",
        old_value=None,
        new_value={
            "code": obj.code,
            "title": obj.title,
            "standard_version_id": obj.standard_version_id,
        },
    )

    return obj
    # 🔒 DRAFT GUARD
    sv = (
        db.query(StandardVersion)
        .filter(
            StandardVersion.id == payload.standard_version_id,
            StandardVersion.status == "draft",
        )
        .first()
    )
    if not sv:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify published standard version",
        )

    obj = ClauseModel(
        code=payload.code,
        title=payload.title,
        standard_id=payload.standard_id,
        standard_version_id=payload.standard_version_id,
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    # 🧾 AUDIT
    log_event(
        db=db,
        actor=None,
        entity_type="clause",
        entity_id=obj.id,
        action="create",
        old_value=None,
        new_value={
            "code": obj.code,
            "title": obj.title,
            "standard_version_id": obj.standard_version_id,
        },
    )

    return obj


# -------------------------------------------------------
# UPDATE CLAUSE (DRAFT ONLY + AUDIT)
# -------------------------------------------------------
@router.put("/{clause_id}", response_model=Clause)
def update_clause(
    clause_id: int,
    payload: ClauseUpdate,
    db: Session = Depends(get_db),
):
    obj = (
        db.query(ClauseModel)
        .filter(ClauseModel.id == clause_id)
        .first()
    )
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clause not found",
        )

    # 🔒 DRAFT GUARD
    sv = (
        db.query(StandardVersion)
        .filter(
            StandardVersion.id == obj.standard_version_id,
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
        "standard_version_id": obj.standard_version_id,
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
        entity_type="clause",
        entity_id=obj.id,
        action="update",
        old_value=before,
        new_value={
            "code": obj.code,
            "title": obj.title,
            "standard_version_id": obj.standard_version_id,
        },
    )

    return obj


# -------------------------------------------------------
# DELETE CLAUSE (DRAFT ONLY + AUDIT)
# -------------------------------------------------------
@router.delete(
    "/{clause_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_clause(
    clause_id: int,
    db: Session = Depends(get_db),
):
    obj = (
        db.query(ClauseModel)
        .filter(ClauseModel.id == clause_id)
        .first()
    )
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clause not found",
        )

    # 🔒 DRAFT GUARD
    sv = (
        db.query(StandardVersion)
        .filter(
            StandardVersion.id == obj.standard_version_id,
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
        entity_type="clause",
        entity_id=obj.id,
        action="delete",
        old_value={
            "code": obj.code,
            "title": obj.title,
            "standard_version_id": obj.standard_version_id,
        },
        new_value=None,
    )

    db.delete(obj)
    db.commit()
    return None
