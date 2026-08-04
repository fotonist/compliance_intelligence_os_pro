from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class IntelligenceSummary(BaseModel):
    total_risks: int
    forecasted_risks: int
    high_probability_risks: int  # prob >= 0.70
    executive_alerts: int        # prob >= 0.80 and risk_level_rank >= 3
    avg_escalation_probability: float
    avg_expected_score_delta: float

    model_config = ConfigDict(from_attributes=True)


class IntelligenceTopRisk(BaseModel):
    risk_id: int
    title: Optional[str] = None

    current_score: Optional[int] = None
    risk_level: Optional[str] = None
    status: Optional[str] = None

    escalation_probability_30d: float
    expected_score_delta: float
    model_version: Optional[str] = None
    forecast_created_at: Optional[datetime] = None

    control_id: Optional[int] = None
    control_code: Optional[str] = None
    control_title: Optional[str] = None

    process_ids: List[int] = Field(default_factory=list)
    process_names: List[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class IntelligenceTopControl(BaseModel):
    control_id: int
    control_code: Optional[str] = None
    control_title: Optional[str] = None

    risk_count: int

    avg_escalation_probability: float
    max_escalation_probability: float
    expected_score_delta_sum: float

    ai_priority_score: float  # aggregated hard metric

    model_config = ConfigDict(from_attributes=True)


class IntelligenceExecutiveAlert(BaseModel):
    risk_id: int
    title: Optional[str] = None

    current_score: Optional[int] = None
    risk_level: Optional[str] = None

    escalation_probability_30d: float
    expected_score_delta: float

    control_id: Optional[int] = None
    control_code: Optional[str] = None

    process_names: List[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class IntelligenceOverviewResponse(BaseModel):
    summary: IntelligenceSummary
    top_risks: List[IntelligenceTopRisk]
    top_controls: List[IntelligenceTopControl]
    executive_alerts: List[IntelligenceExecutiveAlert]

    model_config = ConfigDict(from_attributes=True)