from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User

# Engine (senin projende bu dosya zaten var)
# Beklenen path: backend/app/services/risk_forecast_engine.py
from app.services.risk_forecast_engine import RiskForecastEngine

router = APIRouter(prefix="/company/risk-forecast", tags=["Company", "Forecast"])


@router.post("/run")
def run_risk_forecast(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Runs tenant-scoped training + inference and persists rows to risk_forecasts.
    Hard Integration depends on risk_forecasts being populated.
    """
    tenant_id = user.tenant_id
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id missing")

    engine = RiskForecastEngine()

    # Train (time-based split inside engine) + forecast persist
    engine.train(db, tenant_id)
    engine.forecast(db, tenant_id)

    return {"status": "ok", "tenant_id": tenant_id}