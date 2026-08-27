# C:\Projects\compliance_app\backend\app\routes\uee.py

from typing import Any, Dict

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.uee_engine import UEEEngine
from app.services.uee_config_provider import get_active_uee_weights

router = APIRouter(prefix="/uee", tags=["UEE"])

engine = UEEEngine(weights_provider=get_active_uee_weights)


@router.get("/summary")
def uee_summary(
    tenant_id: int = Query(..., description="Tenant ID"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:

    if tenant_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid tenant_id")

    state = engine.compute_summary(db=db, tenant_id=tenant_id)

    return {
        "tenant_id": state.tenant_id,
        "computed_at": state.computed_at.isoformat(),
        "unified_exposure_score": state.unified_exposure_score,
        "compliance_health_index": state.compliance_health_index,
        "indices": {
            "risk_index": state.risk_index,
            "coverage_index": state.coverage_index,
            "maturity_index": state.maturity_index,
            "evidence_index": state.evidence_index,
            "task_pressure_index": state.task_pressure_index,
        },
        "weights": state.weights,
        "components": state.components,
        "warnings": state.warnings,
    }
