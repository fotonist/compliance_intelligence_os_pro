from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class RiskHistoryResponse(BaseModel):
    id: int
    risk_id: int

    old_impact: Optional[int] = None
    old_likelihood: Optional[int] = None
    old_score: Optional[int] = None

    new_impact: Optional[int] = None
    new_likelihood: Optional[int] = None
    new_score: Optional[int] = None

    treatment: Optional[str] = None
    status: Optional[str] = None

    created_at: datetime

    model_config = ConfigDict(from_attributes=True)