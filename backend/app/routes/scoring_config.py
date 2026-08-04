from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.scoring_config import RiskScoringConfig
from app.core.security import require_roles

router = APIRouter(prefix="/scoring-configs", tags=["scoring-configs"])


@router.get("/active")
def get_active(db: Session = Depends(get_db)):
    return db.query(RiskScoringConfig).filter(RiskScoringConfig.active.is_(True)).first()


@router.post("/", dependencies=[Depends(require_roles("admin"))])
def create_config(payload: dict, db: Session = Depends(get_db)):
    # önce tüm active’leri kapat
    db.query(RiskScoringConfig).update({"active": False})
    cfg = RiskScoringConfig(**payload, active=True)
    db.add(cfg)
    db.commit()
    return cfg
