# C:\Projects\compliance_app\backend\app\routes\uee.py

from typing import Any, Dict

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.uee_engine import UEEEngine
from app.services.uee_config_provider import get_active_uee_weights
from app.dependencies.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/uee", tags=["UEE"])

engine = UEEEngine(weights_provider=get_active_uee_weights)


@router.get("/summary")
def uee_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    tenant_id = current_user.tenant_id

    state = engine.compute_summary(db=db, tenant_id=tenant_id)

    framework_context = engine._get_framework_context(
        db,
        tenant_id=tenant_id,
    )

    maturity_context = engine._get_maturity_framework_state(
        db,
        tenant_id=tenant_id,
        framework_context=framework_context,
    )

    framework_summary = {
        "active_framework_count": framework_context["active_framework_count"],
        "control_based_count": framework_context["control_based_count"],
        "maturity_based_count": framework_context["maturity_based_count"],
        "has_control_based": framework_context["has_control_based"],
        "has_maturity_based": framework_context["has_maturity_based"],
        "adoptions": framework_context["adoptions"],
    }

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
        "framework_context": framework_summary,
        "maturity_context": maturity_context,
    }
