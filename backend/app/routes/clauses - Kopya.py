from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.clauses import Clause as ClauseModel
from app.models.standards import Standard as StandardModel
from app.models.standard_versions import StandardVersion
from app.schemas.clause_schema import Clause, ClauseCreate, ClauseUpdate

router = APIRouter(
    prefix="/clauses",
    tags=["Clauses"],
)


@router.get("/", response_model=List[Clause])
def list_clauses(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return (
        db.query(ClauseModel)
        .order_by(ClauseModel.code)
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{clause_id}", response_model=Clause)
def get_clause(
    clause_id: int,
    db: Session = Depends(get_db),
):
    clause = db.query(ClauseModel).filter(ClauseModel.id == clause_id).first()
    if not clause:
        raise HTTPException(status_code=404, detail="Clause not found")
    return clause


@router.get("/by-standard/{standard_id}", response_model=List[Clause])
def get_clauses_by_standard(
    standard_id: int,
    db: Session = Depends(get_db),
):
    standard = db.query(StandardModel).filter(StandardModel.id == standard_id).first()
    if not standard:
        raise HTTPException(status_code=404, detail="Standard not found")

    return (
        db.query(ClauseModel)
        .filter(ClauseModel.standard_id == standard_id)
        .order_by(ClauseModel.code)
        .all()
    )


# ============================
# CREATE (DRAFT ONLY)
# ============================
@router.post("/", response_model=Clause, status_code=status.HTTP_201_CREATED)
def create_clause(
    clause_in: ClauseCreate,
    db: Session = Depends(get_db),
):
    sv = (
        db.query(StandardVersion)
        .filter(
            StandardVersion.standard_id == clause_in.standard_id,
            StandardVersion.status == "draft",
        )
        .first()
    )
    if not sv:
        raise HTTPException(
            status_code=403,
            detail="Cannot modify published standard version",
        )

    obj = ClauseModel(
        code=clause_in.code,
        title=clause_in.title,
        description=clause_in.description,
        standard_id=clause_in.standard_id,      # legacy
        standard_version_id=sv.id,              # 🔒 draft
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


# ============================
# UPDATE (DRAFT ONLY)
# ============================
@router.put("/{clause_id}", response_model=Clause)
def update_clause(
    clause_id: int,
    clause_in: ClauseUpdate,
    db: Session = Depends(get_db),
):
    obj = db.query(ClauseModel).filter(ClauseModel.id == clause_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Clause not found")

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
            status_code=403,
            detail="Cannot modify published standard version",
        )

    for field, value in clause_in.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)

    db.commit()
    db.refresh(obj)
    return obj


# ============================
# DELETE (DRAFT ONLY)
# ============================
@router.delete("/{clause_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_clause(
    clause_id: int,
    db: Session = Depends(get_db),
):
    obj = db.query(ClauseModel).filter(ClauseModel.id == clause_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Clause not found")

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
            status_code=403,
            detail="Cannot modify published standard version",
        )

    db.delete(obj)
    db.commit()
    return None
