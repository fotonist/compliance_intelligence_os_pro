# backend/app/routes/risk_intelligence.py

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.risk_intelligence import build_hybrid_timeline

router = APIRouter(prefix="/risk-intelligence", tags=["Risk Intelligence"])


# ============================================================
# HYBRID RISK TIMELINE
# ============================================================

@router.get("/risk/{risk_id}")
def get_risk_intelligence(
    risk_id: int,
    window_days: int = 180,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Hybrid risk intelligence:
    - Live risk_versions
    - Snapshot history
    - Velocity
    - Stability
    - Mitigation effectiveness
    """

    tenant_id = user.tenant_id

    if not tenant_id:
        raise HTTPException(status_code=400, detail="User has no tenant")

    result = build_hybrid_timeline(
        db=db,
        tenant_id=tenant_id,
        risk_id=risk_id,
        window_days=window_days,
        now=datetime.utcnow(),
    )

    return result
