from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.control_assessment import ControlAssessment
from app.models.standards import Standard
from app.models.clauses import Clause
from app.models.requirements import Requirement
from app.models.controls import Control

router = APIRouter(prefix="/control-assessments", tags=["control_assessments"])


@router.get("")
def list_control_assessments(db: Session = Depends(get_db)):
    return (
        db.query(ControlAssessment)
        .order_by(ControlAssessment.id.desc())
        .all()
    )


@router.post("")
def create_control_assessment(payload: dict, db: Session = Depends(get_db)):
    ca = ControlAssessment(
        name=payload["name"],
        scope=payload.get("scope"),
        standard_id=payload["standard_id"],
    )
    db.add(ca)
    db.commit()
    db.refresh(ca)
    return ca


@router.get("/{assessment_id}")
def get_control_assessment_detail(
    assessment_id: int,
    db: Session = Depends(get_db),
):
    assessment = (
        db.query(ControlAssessment)
        .filter(ControlAssessment.id == assessment_id)
        .first()
    )

    if not assessment:
        raise HTTPException(status_code=404, detail="Control assessment not found")

    standard = (
        db.query(Standard)
        .filter(Standard.id == assessment.standard_id)
        .first()
    )

    if not standard:
        raise HTTPException(status_code=404, detail="Standard not found")

    # 🔗 Standard → Clause → Requirement → Control
    controls = (
        db.query(Control)
        .join(Requirement, Control.requirement_id == Requirement.id)
        .join(Clause, Requirement.clause_id == Clause.id)
        .filter(Clause.standard_id == standard.id)
        .order_by(Control.id)
        .all()
    )

    return {
        "assessment": {
            "id": assessment.id,
            "name": assessment.name,
            "scope": assessment.scope,
            "status": assessment.status,
            "created_at": assessment.created_at,
            "standard": {
                "id": standard.id,
                "code": standard.code,
            },
        },
        "controls": [
            {
                "id": c.id,
                "code": c.code,
                "title": c.title,
                "status": "NOT_ASSESSED",
                "requirement_id": c.requirement_id,
            }
            for c in controls
        ],
    }
