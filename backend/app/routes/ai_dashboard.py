from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Dict, Any
from app.core.security import get_current_user
from app.services.ai_client import generate_ai_insight

router = APIRouter(prefix="/ai/dashboard", tags=["AI"])

class DashboardInsightRequest(BaseModel):
    period_days: int
    kpis: Dict[str, Any]

class DashboardInsightUsage(BaseModel):
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None


class DashboardInsightResponse(BaseModel):
    summary: List[str]
    root_causes: List[str]
    warnings: List[str]
    actions: List[str]

    provider: str = "platform"
    model: str | None = None
    status: str = "ok"
    usage: DashboardInsightUsage | None = None
    error: str | None = None

@router.post("/insights", response_model=DashboardInsightResponse)
async def dashboard_insights(
    payload: DashboardInsightRequest,
    user=Depends(get_current_user),
):
    """
    Read-only AI insight endpoint.
    - No calculation
    - No data mutation
    - KPI values are interpreted only
    """

    result = await generate_ai_insight(
        kpis=payload.kpis,
        period_days=payload.period_days,
    )

    return result
