from __future__ import annotations

from datetime import date
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class AuditActionItem(BaseModel):
    priority_score: int

    standard_code: Optional[str] = None
    clause_code: Optional[str] = None
    requirement_code: Optional[str] = None
    control_code: Optional[str] = None

    control_id: int
    status: str

    risk_count: int
    max_risk_score: Optional[int] = None
    highest_risk_level: Optional[str] = None

    # 🔥 AI (hard integration)
    escalation_probability: float
    expected_score_delta: float
    ai_priority_score: float
    forecast_version: Optional[str] = None

    suggested_owner_role: str
    suggested_due_date: date
    suggested_evidence_types: List[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class AuditPlanResponse(BaseModel):
    process_id: int
    total_actions: int
    critical_actions: int
    actions: List[AuditActionItem] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)