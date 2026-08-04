from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services.risk_decision_engine import RiskDecisionEngine, DecisionRuleSet

router = APIRouter(prefix="/company/decision", tags=["Company", "Decision"])


@router.get("/actions")
def decision_actions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tenant_id = user.tenant_id
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id missing")

    engine = RiskDecisionEngine(rules=DecisionRuleSet())
    return engine.generate_actions(db, tenant_id)