from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.standards import Standard
from app.models.clauses import Clause
from app.models.requirements import Requirement
from app.models.controls import Control
from app.models.risks import Risk
from app.models.evidences import Evidence

router = APIRouter(prefix="/debug", tags=["Debug"])

@router.get("/counts")
def get_counts(db: Session = Depends(get_db)):
    return {
        "standards": db.query(Standard).count(),
        "clauses": db.query(Clause).count(),
        "requirements": db.query(Requirement).count(),
        "controls": db.query(Control).count(),
        "risks": db.query(Risk).count(),
        "evidences": db.query(Evidence).count(),
    }

@router.get("/links")
def get_links(db: Session = Depends(get_db)):
    # kaç kontrolün risk/evidence’i var, onu görelim
    from sqlalchemy import exists

    controls_with_risk = (
        db.query(Control)
        .filter(
            exists().where(Risk.control_id == Control.id)
        )
        .count()
    )
    controls_with_evidence = (
        db.query(Control)
        .filter(
            exists().where(Evidence.control_id == Control.id)
        )
        .count()
    )
    return {
        "controls_total": db.query(Control).count(),
        "controls_with_risk": controls_with_risk,
        "controls_with_evidence": controls_with_evidence,
    }
