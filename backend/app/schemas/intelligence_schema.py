from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


# =========================================================
# SUMMARY
# =========================================================

class IntelligenceSummary(BaseModel):
    total_risks: int
    open_risks: int

    forecasted_risks: int
    high_probability_risks: int
    executive_alerts: int

    avg_escalation_probability: float
    avg_expected_score_delta: float

    # -----------------------------------------------------
    # Forecast coverage / model posture
    # -----------------------------------------------------

    forecast_coverage: int = 0
    forecast_coverage_percent: float = 0.0

    baseline_forecast_risks: int = 0
    ml_forecast_risks: int = 0
    insufficient_history_risks: int = 0

    latest_forecast_at: Optional[datetime] = None

    # -----------------------------------------------------
    # Exposure posture
    # -----------------------------------------------------

    total_inherent_exposure: float = 0.0
    total_residual_exposure: float = 0.0
    total_unified_exposure: float = 0.0

    exposure_delta: float = 0.0
    exposure_delta_percent: float = 0.0

    # -----------------------------------------------------
    # Evidence posture
    # -----------------------------------------------------

    covered_risks: int = 0
    uncovered_risks: int = 0
    coverage_percent: float = 0.0

    # Evidence analytics eligibility boundary
    evidence_eligible_risks: int = 0
    evidence_unavailable_risks: int = 0

    # -----------------------------------------------------
    # Framework-aware canonical risk universe
    # -----------------------------------------------------

    resolved_risks: int = 0
    unresolved_risks: int = 0
    control_based_risks: int = 0
    maturity_based_risks: int = 0

    # Analytics eligibility boundary
    analytics_eligible_risks: int = 0
    analytics_unavailable_risks: int = 0
    analytics_coverage_percent: float = 0.0

    # Forecast coverage within the eligible analytics universe
    forecast_eligible_risks: int = 0
    forecast_model_coverage_percent: float = 0.0

    model_config = ConfigDict(from_attributes=True)


# =========================================================
# TOP RISK
# =========================================================

class IntelligenceTopRisk(BaseModel):
    risk_id: int
    title: Optional[str] = None

    current_score: Optional[int] = None
    risk_level: Optional[str] = None
    status: Optional[str] = None

    # -----------------------------------------------------
    # Forecast
    # -----------------------------------------------------

    escalation_probability_30d: float
    expected_score_delta: float

    model_version: Optional[str] = None
    forecast_mode: Optional[str] = None
    forecast_status: Optional[str] = None

    forecast_created_at: Optional[datetime] = None

    # -----------------------------------------------------
    # Exposure
    # -----------------------------------------------------

    inherent_exposure: float = 0.0
    residual_exposure: float = 0.0
    unified_score: float = 0.0

    evidence_quality: float = 0.0
    linked_evidence_count: int = 0
    approved_evidence_count: int = 0

    density_factor: float = 0.0
    pressure_factor: float = 1.0
    velocity_factor: float = 1.0

    is_covered: bool = False

    # -----------------------------------------------------
    # Historical intelligence
    # -----------------------------------------------------

    historical_change_count: int = 0
    changes_90d: int = 0
    avg_delta_90d: float = 0.0
    max_delta_90d: float = 0.0

    # -----------------------------------------------------
    # Control / Process
    # -----------------------------------------------------

    control_id: Optional[int] = None
    control_code: Optional[str] = None
    control_title: Optional[str] = None

    process_ids: List[int] = Field(default_factory=list)
    process_names: List[str] = Field(default_factory=list)

    # -----------------------------------------------------
    # Framework provenance
    # -----------------------------------------------------

    framework_resolved: bool = False
    framework_consistency_status: Optional[str] = None
    framework_reason: Optional[str] = None

    standard_id: Optional[int] = None
    standard_code: Optional[str] = None
    standard_title: Optional[str] = None

    standard_version_id: Optional[int] = None
    standard_version_code: Optional[str] = None

    adoption_id: Optional[int] = None
    framework_type: Optional[str] = None
    target_type: Optional[str] = None

    # -----------------------------------------------------
    # Maturity target context
    # -----------------------------------------------------

    base_practice_id: Optional[int] = None
    base_practice_code: Optional[str] = None
    base_practice_title: Optional[str] = None

    reference_process_id: Optional[int] = None
    reference_process_code: Optional[str] = None
    reference_process_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# =========================================================
# TOP CONTROL
# =========================================================

class IntelligenceTopControl(BaseModel):
    control_id: int
    control_code: Optional[str] = None
    control_title: Optional[str] = None

    risk_count: int

    avg_escalation_probability: float
    max_escalation_probability: float
    expected_score_delta_sum: float

    ai_priority_score: float

    # -----------------------------------------------------
    # Enterprise control posture
    # -----------------------------------------------------

    covered_risk_count: int = 0
    uncovered_risk_count: int = 0

    avg_unified_exposure: float = 0.0
    max_unified_exposure: float = 0.0

    model_config = ConfigDict(from_attributes=True)


# =========================================================
# EXECUTIVE ALERT
# =========================================================

class IntelligenceExecutiveAlert(BaseModel):
    risk_id: int
    title: Optional[str] = None

    current_score: Optional[int] = None
    risk_level: Optional[str] = None

    escalation_probability_30d: float
    expected_score_delta: float

    # -----------------------------------------------------
    # Exposure
    # -----------------------------------------------------

    residual_exposure: float = 0.0
    unified_score: float = 0.0

    # -----------------------------------------------------
    # Forecast
    # -----------------------------------------------------

    model_version: Optional[str] = None
    forecast_mode: Optional[str] = None
    forecast_status: Optional[str] = None

    forecast_created_at: Optional[datetime] = None

    # -----------------------------------------------------
    # Evidence
    # -----------------------------------------------------

    linked_evidence_count: int = 0
    approved_evidence_count: int = 0
    is_covered: bool = False

    # -----------------------------------------------------
    # Control / Process
    # -----------------------------------------------------

    control_id: Optional[int] = None
    control_code: Optional[str] = None

    process_names: List[str] = Field(default_factory=list)

    # -----------------------------------------------------
    # Framework provenance
    # -----------------------------------------------------

    framework_resolved: bool = False
    framework_consistency_status: Optional[str] = None
    framework_reason: Optional[str] = None

    standard_id: Optional[int] = None
    standard_code: Optional[str] = None
    standard_title: Optional[str] = None

    standard_version_id: Optional[int] = None
    standard_version_code: Optional[str] = None

    adoption_id: Optional[int] = None
    framework_type: Optional[str] = None
    target_type: Optional[str] = None

    # -----------------------------------------------------
    # Maturity target context
    # -----------------------------------------------------

    base_practice_id: Optional[int] = None
    base_practice_code: Optional[str] = None
    base_practice_title: Optional[str] = None

    reference_process_id: Optional[int] = None
    reference_process_code: Optional[str] = None
    reference_process_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# =========================================================
# MATURITY RISK
# =========================================================

class IntelligenceMaturityRisk(BaseModel):
    risk_id: int
    title: Optional[str] = None
    description: Optional[str] = None

    likelihood: Optional[int] = None
    impact: Optional[int] = None
    current_score: Optional[int] = None
    risk_level: Optional[str] = None
    status: Optional[str] = None

    treatment: Optional[str] = None
    action: Optional[str] = None

    framework_resolved: bool = True
    framework_consistency_status: Optional[str] = None
    framework_reason: Optional[str] = None

    standard_id: Optional[int] = None
    standard_code: Optional[str] = None
    standard_title: Optional[str] = None

    standard_version_id: Optional[int] = None
    standard_version_code: Optional[str] = None
    adoption_id: Optional[int] = None

    framework_type: str = "MATURITY_BASED"
    target_type: Optional[str] = None

    risk_version_id: Optional[int] = None

    base_practice_id: Optional[int] = None
    base_practice_code: Optional[str] = None
    base_practice_title: Optional[str] = None

    reference_process_id: Optional[int] = None
    reference_process_code: Optional[str] = None
    reference_process_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# =========================================================
# OVERVIEW RESPONSE
# =========================================================

class IntelligenceOverviewResponse(BaseModel):
    summary: IntelligenceSummary

    top_risks: List[IntelligenceTopRisk]
    maturity_risks: List[IntelligenceMaturityRisk] = Field(
        default_factory=list
    )
    top_controls: List[IntelligenceTopControl]
    executive_alerts: List[IntelligenceExecutiveAlert]

    model_config = ConfigDict(from_attributes=True)


