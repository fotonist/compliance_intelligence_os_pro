from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.models.risk_forecasts import RiskForecast

from app.dependencies.permission_checker import require_permission
from app.dependencies.scope_checker import require_tenant_scope

from app.services.risk_forecast_engine import RiskForecastEngine


router = APIRouter(
    prefix="/company/risk-forecast",
    tags=["Company", "Forecast"],
)


def _serialize_forecast(forecast: RiskForecast) -> dict:
    explanation = forecast.explanation or {}

    mode = explanation.get("mode")

    if not mode:
        if str(forecast.model_version).startswith("baseline"):
            mode = "baseline"
        elif str(forecast.model_version).startswith("v"):
            mode = "rf"
        else:
            mode = "unknown"

    train_info = explanation.get("train_info") or {}

    if mode == "baseline":
        training_status = train_info.get("reason") or explanation.get("reason")
    else:
        training_status = "trained"

    return {
        "risk_id": int(forecast.risk_id),
        "model": {
            "version": forecast.model_version,
            "mode": mode,
            "training_status": training_status,
        },
        "forecast": {
            "escalation_probability_30d": float(
                forecast.escalation_probability_30d or 0.0
            ),
            "expected_score_delta": float(
                forecast.expected_score_delta or 0.0
            ),
        },
        "explanation": explanation,
        "created_at": (
            forecast.created_at.isoformat()
            if forecast.created_at
            else None
        ),
    }


# =========================================================
# 1. RUN FORECAST
# =========================================================
@router.post("/run")
def run_risk_forecast(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("forecast.view")),
    model_perm: User = Depends(require_permission("forecast.model.view")),
    scope=Depends(require_tenant_scope()),
):
    """
    Execute the canonical tenant risk forecast engine.

    The engine automatically falls back to a baseline model when
    there is insufficient historical data for ML training.
    """

    tenant_id = user.tenant_id

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="tenant_id missing",
        )

    engine = RiskForecastEngine()

    engine.train(db, tenant_id)
    engine.forecast(db, tenant_id)

    rows = (
        db.query(RiskForecast)
        .filter(RiskForecast.tenant_id == tenant_id)
        .order_by(RiskForecast.created_at.desc())
        .all()
    )

    return {
        "status": "ok",
        "tenant_id": int(tenant_id),
        "forecast_count": len(rows),
        "training": engine._train_info,
        "message": "Risk forecast engine executed successfully.",
    }


# =========================================================
# 2. FORECAST SUMMARY
# =========================================================
@router.get("/summary")
def get_forecast_summary(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("forecast.view")),
    scope=Depends(require_tenant_scope()),
):
    """
    Return the canonical RiskForecast representation.

    This endpoint intentionally exposes only fields that exist in
    the current RiskForecast ORM model.
    """

    tenant_id = user.tenant_id

    rows = (
        db.query(RiskForecast)
        .filter(RiskForecast.tenant_id == tenant_id)
        .order_by(RiskForecast.created_at.desc())
        .limit(100)
        .all()
    )

    return [_serialize_forecast(row) for row in rows]


# =========================================================
# 3. EXPLAINABILITY
# =========================================================
@router.get("/explain/{risk_id}")
def get_forecast_explainability(
    risk_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("forecast.explain.view")),
    scope=Depends(require_tenant_scope()),
):
    """
    Return model explanation for a specific risk.

    Explainability is stored in RiskForecast.explanation.
    """

    forecast = (
        db.query(RiskForecast)
        .filter(
            RiskForecast.tenant_id == user.tenant_id,
            RiskForecast.risk_id == risk_id,
        )
        .order_by(RiskForecast.created_at.desc())
        .first()
    )

    if not forecast:
        raise HTTPException(
            status_code=404,
            detail="Forecast not found",
        )

    explanation = forecast.explanation or {}

    return {
        "risk_id": int(forecast.risk_id),
        "model_version": forecast.model_version,
        "model_mode": explanation.get("mode"),
        "training_status": (
            explanation.get("train_info") or {}
        ).get("reason"),
        "feature_importance": explanation.get(
            "feature_importance",
            {},
        ),
        "features": explanation.get(
            "features",
            {},
        ),
        "reason": explanation.get("reason"),
        "train_info": explanation.get(
            "train_info",
            {},
        ),
        "created_at": (
            forecast.created_at.isoformat()
            if forecast.created_at
            else None
        ),
    }
