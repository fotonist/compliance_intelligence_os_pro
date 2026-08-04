from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.risks import Risk

router = APIRouter(prefix="/risks", tags=["Risks"])


def _risk_level_from_score(score: int) -> str:
    # Senin evaluate mantığınla uyumlu eşikler
    if score <= 4:
        return "LOW"
    if score <= 9:
        return "MEDIUM"
    if score <= 16:
        return "HIGH"
    return "CRITICAL"


@router.put("/{risk_id}/update-formula-b")
def update_risk_formula_b(
    risk_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Formula-B: Şimdilik 404'ü kaldırmak için minimum güvenli uygulama.
    - Mevcut risk kayıtlı impact/likelihood üzerinden score + risk_level'i yeniden hesaplar.
    - Evidence coverage/approval logic'i bir sonraki adımda bu endpoint içine genişletilir.
    """

    risk = db.query(Risk).filter(Risk.id == risk_id).first()
    if not risk:
        raise HTTPException(status_code=404, detail="Risk not found")

    # Guard: DB'de nullable olabilir; güvenli default
    impact = int(risk.impact or 1)
    likelihood = int(risk.likelihood or 1)

    score = impact * likelihood
    level = _risk_level_from_score(score)

    # History snapshot alanların varsa doldur
    # (Modelinde varsa çalışır; yoksa attribute error vermesin diye getattr/setattr ile ilerliyoruz)
    if hasattr(risk, "prev_impact"):
        risk.prev_impact = getattr(risk, "impact", None)
    if hasattr(risk, "prev_likelihood"):
        risk.prev_likelihood = getattr(risk, "likelihood", None)
    if hasattr(risk, "previous_score"):
        risk.previous_score = getattr(risk, "score", None)
    if hasattr(risk, "prev_risk_level"):
        risk.prev_risk_level = getattr(risk, "risk_level", None)

    risk.score = score
    risk.risk_level = level
    risk.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(risk)

    return {
        "risk_id": risk.id,
        "risk_level": risk.risk_level,
        "score": risk.score,
    }
