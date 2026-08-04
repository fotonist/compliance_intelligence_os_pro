from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.risks import Risk
from app.schemas.risk import RiskOut
from app.core.security import get_current_user

router = APIRouter(
    prefix="/risks",
    tags=["Risks"],
)

@router.get("", response_model=list[RiskOut])
def list_risks(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    risks = db.query(Risk).order_by(Risk.score.desc()).all()
    return risks
