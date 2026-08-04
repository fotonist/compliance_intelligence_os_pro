from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


CoverageStatus = Literal["covered", "partial", "uncovered", "unknown"]


class CoverageControl(BaseModel):
    id: int
    code: Optional[str] = None
    title: Optional[str] = None
    status: CoverageStatus
    risk_ids: List[int] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class CoverageRequirement(BaseModel):
    id: int
    code: Optional[str] = None
    title: Optional[str] = None
    status: CoverageStatus
    controls: List[CoverageControl] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class CoverageClause(BaseModel):
    id: int
    code: Optional[str] = None
    title: Optional[str] = None
    status: CoverageStatus
    requirements: List[CoverageRequirement] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class CoverageStandard(BaseModel):
    id: int
    code: Optional[str] = None
    title: Optional[str] = None
    status: CoverageStatus
    clauses: List[CoverageClause] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class CoverageProcessInfo(BaseModel):
    id: int
    code: Optional[str] = None
    name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CoverageSummary(BaseModel):
    risks_total: int
    controls_total: int
    covered_controls: int
    partial_controls: int
    uncovered_controls: int
    unknown_controls: int

    model_config = ConfigDict(from_attributes=True)


class CoverageResponse(BaseModel):
    process: CoverageProcessInfo
    summary: CoverageSummary
    standards: List[CoverageStandard] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


# -----------------------------------------------------------------------------
# GAP / AUDIT INTELLIGENCE
# -----------------------------------------------------------------------------

class GapRiskInfo(BaseModel):
    id: int
    title: Optional[str] = None
    score: Optional[int] = None
    level: Optional[str] = None

    # AI (latest forecast per risk)
    escalation_probability: Optional[float] = None
    expected_score_delta: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class GapItem(BaseModel):
    # chain identifiers
    standard_id: int
    standard_code: Optional[str] = None
    standard_title: Optional[str] = None

    clause_id: int
    clause_code: Optional[str] = None
    clause_title: Optional[str] = None

    requirement_id: int
    requirement_code: Optional[str] = None
    requirement_title: Optional[str] = None

    control_id: int
    control_code: Optional[str] = None
    control_title: Optional[str] = None

    # gap status & audit intelligence
    status: CoverageStatus  # only non-covered items are returned
    risk_count: int
    max_risk_score: Optional[int] = None
    highest_risk_level: Optional[str] = None

    # 🔥 AI (hard integration)
    ai_priority_score: float
    max_escalation_probability: float
    avg_escalation_probability: float
    expected_score_delta_sum: float
    forecast_version: Optional[str] = None

    # evidence for audit trail
    risks: List[GapRiskInfo] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class GapSummary(BaseModel):
    gaps_total: int
    uncovered: int
    partial: int
    unknown: int
    # simple health indicator
    worst_max_risk_score: Optional[int] = None
    worst_highest_risk_level: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class GapResponse(BaseModel):
    process: CoverageProcessInfo
    summary: GapSummary
    gaps: List[GapItem] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)