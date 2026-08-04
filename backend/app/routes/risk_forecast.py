from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.models.risk_forecasts import RiskForecast

# 🔐 ACCESS LAYER
from app.dependencies.permission_checker import require_permission
from app.dependencies.scope_checker import require_tenant_scope

from app.services.risk_forecast_engine import RiskForecastEngine

router = APIRouter(prefix="/company/risk-forecast", tags=["Company", "Forecast"])


# =========================================================
# 1️⃣ RUN FORECAST (BOARD ONLY)
# =========================================================
@router.post("/run")
def run_risk_forecast(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("forecast.view")),
    model_perm: User = Depends(require_permission("forecast.model.view")),
    scope=Depends(require_tenant_scope()),
):
    """
    Board-only operation.
    Trains + runs forecast model.
    """

    tenant_id = user.tenant_id

    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id missing")

    engine = RiskForecastEngine()
    engine.train(db, tenant_id)
    engine.forecast(db, tenant_id)

    return {
        "status": "ok",
        "tenant_id": tenant_id,
        "message": "Forecast engine executed (Board-level access)"
    }


# =========================================================
# 2️⃣ FORECAST SUMMARY (BOARD + RISK MANAGER)
# =========================================================
@router.get("/summary")
def get_forecast_summary(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("forecast.view")),
    scope=Depends(require_tenant_scope()),
):
    """
    View forecast results.
    Allowed: Board + RiskManager
    """

    tenant_id = user.tenant_id

    rows = (
        db.query(RiskForecast)
        .filter(RiskForecast.tenant_id == tenant_id)
        .order_by(RiskForecast.created_at.desc())
        .limit(100)
        .all()
    )

    return [
        {
            "risk_id": r.risk_id,
            "predicted_score": r.predicted_score,
            "confidence": r.confidence,
            "trend": r.trend,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


# =========================================================
# 3️⃣ EXPLAINABILITY (BOARD ONLY)
# =========================================================
@router.get("/explain/{risk_id}")
def get_forecast_explainability(
    risk_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("forecast.explain.view")),
    scope=Depends(require_tenant_scope()),
):
    """
    Model explainability view.
    Board-only.
    """

    forecast = (
        db.query(RiskForecast)
        .filter(
            RiskForecast.tenant_id == user.tenant_id,
            RiskForecast.risk_id == risk_id,
        )
        .first()
    )

    if not forecast:
        raise HTTPException(status_code=404, detail="Forecast not found")

    return {
        "risk_id": forecast.risk_id,
        "feature_importance": forecast.feature_importance,
        "model_version": forecast.model_version,
        "confidence": forecast.confidence,
    }