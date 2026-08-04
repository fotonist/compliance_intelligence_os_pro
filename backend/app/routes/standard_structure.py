from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user

from app.models.standards import Standard
from app.models.clauses import Clause
from app.models.requirements import Requirement
from app.models.controls import Control

router = APIRouter(
    prefix="/standards",
    tags=["Standard Structure"]
)


# -----------------------------
# CLAUSES
# -----------------------------
@router.post("/{standard_id}/clauses")
def create_clause(
    standard_id: int,
    body: dict,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    std = db.query(Standard).filter(Standard.id == standard_id).first()
    if not std:
        raise HTTPException(404, "Standard not found")

    clause = Clause(
        standard_id=standard_id,
        code=body["code"],
        title=body.get("title"),
        description=body.get("description"),
    )
    db.add(clause)
    db.commit()
    db.refresh(clause)
    return clause


@router.get("/{standard_id}/clauses")
def list_clauses(
    standard_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return (
        db.query(Clause)
        .filter(Clause.standard_id == standard_id)
        .order_by(Clause.code)
        .all()
    )


# -----------------------------
# REQUIREMENTS
# -----------------------------
@router.post("/clauses/{clause_id}/requirements")
def create_requirement(
    clause_id: int,
    body: dict,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    clause = db.query(Clause).filter(Clause.id == clause_id).first()
    if not clause:
        raise HTTPException(404, "Clause not found")

    req = Requirement(
        clause_id=clause_id,
        code=body["code"],
        title=body["title"],
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.get("/clauses/{clause_id}/requirements")
def list_requirements(
    clause_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return (
        db.query(Requirement)
        .filter(Requirement.clause_id == clause_id)
        .order_by(Requirement.code)
        .all()
    )


# -----------------------------
# CONTROLS
# -----------------------------
@router.post("/requirements/{requirement_id}/controls")
def create_control(
    requirement_id: int,
    body: dict,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    req = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not req:
        raise HTTPException(404, "Requirement not found")

    control = Control(
        requirement_id=requirement_id,
        code=body["code"],
        title=body.get("title"),
        description=body.get("description"),
    )
    db.add(control)
    db.commit()
    db.refresh(control)
    return control


@router.get("/requirements/{requirement_id}/controls")
def list_controls(
    requirement_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return (
        db.query(Control)
        .filter(Control.requirement_id == requirement_id)
        .order_by(Control.code)
        .all()
    )
