from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class RiskOut(BaseModel):
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

    # Previous values
    prev_impact: Optional[int] = None
    prev_likelihood: Optional[int] = None
    previous_score: Optional[int] = None
    prev_risk_level: Optional[str] = None

    # Relations
    control_id: Optional[int] = None
    standard_id: Optional[int] = None
    requirement_id: Optional[int] = None
    clause_id: Optional[int] = None

    # Risk / Control coverage
    control_coverage_status: Optional[str] = None
    coverage: Optional[str] = None

    # Evidence intelligence
    evidence_count: int = 0

    # Optional owner information
    owner: Optional[str] = None

    # Timestamps
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(
        from_attributes=True
    )


class RiskListResponse(BaseModel):
    items: list[RiskOut]

    total: int
    page: int
    page_size: int
    total_pages: int
