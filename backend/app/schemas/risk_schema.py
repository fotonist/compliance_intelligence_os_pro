from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class RiskResponse(BaseModel):
    id: int

    title: str
    description: Optional[str] = None

    impact: int
    likelihood: int
    score: int

    risk_level: Optional[str] = None
    status: Optional[str] = None

    treatment: Optional[str] = None
    action: Optional[str] = None

    # 🔁 previous values
    prev_impact: Optional[int] = None
    prev_likelihood: Optional[int] = None
    previous_score: Optional[int] = None
    prev_risk_level: Optional[str] = None

    # 🔗 relations
    control_id: Optional[int] = None
    standard_id: Optional[int] = None
    requirement_id: Optional[int] = None

    control_coverage_status: Optional[str] = None

    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)