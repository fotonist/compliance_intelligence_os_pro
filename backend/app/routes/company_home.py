from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.permission_checker import require_permission
from app.dependencies.scope_checker import require_tenant_scope
from app.models.user import User
from app.services.uee_engine import UEEEngine


router = APIRouter(tags=["Company Home"])


@router.get("/matrix/kpi")
def company_home_kpi(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
) -> Dict[str, Any]:
    """
    Canonical Company Home KPI source.

    This endpoint intentionally delegates to the real UEE engine. It does not
    generate, cache, or return demo values.
    """
    state = UEEEngine().compute_summary(db=db, tenant_id=int(user.tenant_id))

    return {
        "tenant_id": state.tenant_id,
        "computed_at": state.computed_at.isoformat(),
        "unified_exposure_score": state.unified_exposure_score,
        "compliance_health_index": state.compliance_health_index,
        "indices": {
            "risk": state.risk_index,
            "coverage": state.coverage_index,
            "maturity": state.maturity_index,
            "evidence": state.evidence_index,
            "task_pressure": state.task_pressure_index,
        },
        "weights": state.weights,
        "components": state.components,
        "warnings": list(state.warnings),
    }
