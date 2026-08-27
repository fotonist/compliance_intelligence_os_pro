from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator


class IntelligenceWeightingBase(BaseModel):
    risk_weight: float = Field(0.35, ge=0, le=1)
    coverage_weight: float = Field(0.25, ge=0, le=1)
    maturity_weight: float = Field(0.15, ge=0, le=1)
    evidence_weight: float = Field(0.10, ge=0, le=1)
    task_pressure_weight: float = Field(0.15, ge=0, le=1)

    @model_validator(mode="after")
    def validate_total_weight(self):
        total = (
            self.risk_weight
            + self.coverage_weight
            + self.maturity_weight
            + self.evidence_weight
            + self.task_pressure_weight
        )

        if abs(total - 1.0) > 0.000001:
            raise ValueError(
                f"UEE weighting total must equal 1.0; received {total:.6f}"
            )

        return self


class IntelligenceConfigurationResponse(
    IntelligenceWeightingBase
):
    id: int
    tenant_id: int
    model_name: str
    version: int
    status: str
    effective_from: Optional[datetime] = None
    change_reason: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    active: bool


class IntelligenceConfigurationDraftRequest(
    IntelligenceWeightingBase
):
    change_reason: Optional[str] = None


class IntelligenceConfigurationPreviewRequest(
    IntelligenceWeightingBase
):
    pass


class IntelligenceConfigurationPreviewResponse(BaseModel):
    current_model_version: Optional[int] = None

    current_unified_exposure: float
    projected_unified_exposure: float

    current_compliance_health: float
    projected_compliance_health: float

    exposure_delta: float
    health_delta: float

    effective_weights: dict[str, float]
    warnings: list[str] = []
