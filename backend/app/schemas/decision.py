from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class DecisionActionOut(BaseModel):
    action_type: str
    priority: str

    title: str
    description: str

    risk_id: int
    control_id: Optional[int] = None
    process_id: Optional[int] = None

    forecast_id: int
    model_version: Optional[str] = None

    escalation_probability_30d: float
    expected_score_delta: float

    payload: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class DecisionCountsOut(BaseModel):
    forecasts: int
    exec_alerts: int
    watchlist: int
    gaps: int
    tasks: int

    model_config = ConfigDict(from_attributes=True)


class DecisionPackageOut(BaseModel):
    tenant_id: int
    generated_at: str
    counts: DecisionCountsOut

    exec_alerts: List[DecisionActionOut] = Field(default_factory=list)
    watchlist: List[DecisionActionOut] = Field(default_factory=list)
    gaps: List[DecisionActionOut] = Field(default_factory=list)
    tasks: List[DecisionActionOut] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ApplyRequest(BaseModel):
    dry_run: bool = False
    include_exec_alerts: bool = True
    include_tasks: bool = True
    include_gaps: bool = False  # gap adapter later
    max_create: int = 50


class ApplyCreatedItem(BaseModel):
    action_type: str
    task_id: Optional[int] = None
    risk_id: int
    process_id: Optional[int] = None
    control_id: Optional[int] = None
    forecast_id: int
    title: str

    model_config = ConfigDict(from_attributes=True)


class ApplySkippedItem(BaseModel):
    action_type: str
    risk_id: int
    forecast_id: int
    reason: str

    model_config = ConfigDict(from_attributes=True)


class ApplyResponse(BaseModel):
    tenant_id: int
    dry_run: bool
    created: List[ApplyCreatedItem] = Field(default_factory=list)
    skipped: List[ApplySkippedItem] = Field(default_factory=list)
    counts: Dict[str, int] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)