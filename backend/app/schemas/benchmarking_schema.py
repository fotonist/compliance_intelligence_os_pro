from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class BenchmarkSnapshotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    snapshot_at: datetime
    period_start: datetime | None = None
    period_end: datetime | None = None

    uee_score: float = Field(ge=0, le=100)
    compliance_health_index: float = Field(ge=0, le=100)

    risk_index: float = Field(ge=0, le=100)
    coverage_index: float = Field(ge=0, le=100)
    maturity_index: float = Field(ge=0, le=100)
    evidence_index: float = Field(ge=0, le=100)
    task_pressure_index: float = Field(ge=0, le=100)

    risk_count: int = Field(ge=0)
    control_count: int = Field(ge=0)
    evidence_count: int = Field(ge=0)

    data_quality_score: float | None = Field(
        default=None,
        ge=0,
        le=100,
    )

    source: str
    engine_version: str | None = None


class BenchmarkComparisonResponse(BaseModel):
    current: float | None = None
    previous: float | None = None
    delta: float | None = None

    direction: Literal[
        "improved",
        "deteriorated",
        "unchanged",
        "insufficient_data",
    ]

    sufficient_data: bool


class PeerPopulationCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    industry: str | None = Field(default=None, max_length=255)
    geography: str | None = Field(default=None, max_length=255)
    company_size_band: str | None = Field(default=None, max_length=100)
    revenue_band: str | None = Field(default=None, max_length=100)
    standard_id: int | None = Field(default=None, ge=1)
    minimum_sample_size: int = Field(default=5, ge=1)
    status: Literal[
        "DRAFT",
        "CONFIGURING",
        "ACTIVE",
        "SUSPENDED",
        "RETIRED",
    ] = "DRAFT"


class PeerPopulationUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    industry: str | None = Field(default=None, max_length=255)
    geography: str | None = Field(default=None, max_length=255)
    company_size_band: str | None = Field(default=None, max_length=100)
    revenue_band: str | None = Field(default=None, max_length=100)
    standard_id: int | None = Field(default=None, ge=1)
    minimum_sample_size: int | None = Field(default=None, ge=1)
    status: Literal[
        "DRAFT",
        "CONFIGURING",
        "ACTIVE",
        "SUSPENDED",
        "RETIRED",
    ] | None = None


class PeerPopulationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    industry: str | None = None
    geography: str | None = None
    company_size_band: str | None = None
    revenue_band: str | None = None
    standard_id: int | None = None
    minimum_sample_size: int
    status: str
    created_by: int | None = None
    approved_by: int | None = None
    created_at: datetime
    updated_at: datetime


class PeerPopulationMemberCreateRequest(BaseModel):
    tenant_id: int = Field(ge=1)
    membership_type: Literal[
        "MANUAL",
        "RULE_BASED",
        "SYSTEM",
    ] = "MANUAL"
    eligibility_status: Literal[
        "ELIGIBLE",
        "INELIGIBLE",
        "PENDING",
    ] = "PENDING"
    effective_from: datetime | None = None
    effective_to: datetime | None = None


class PeerPopulationMemberUpdateRequest(BaseModel):
    membership_type: Literal[
        "MANUAL",
        "RULE_BASED",
        "SYSTEM",
    ] | None = None
    eligibility_status: Literal[
        "ELIGIBLE",
        "INELIGIBLE",
        "PENDING",
    ] | None = None
    effective_from: datetime | None = None
    effective_to: datetime | None = None


class PeerPopulationMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    population_id: int
    tenant_id: int
    membership_type: str
    eligibility_status: str
    effective_from: datetime | None = None
    effective_to: datetime | None = None
    created_at: datetime
    updated_at: datetime


class PeerBenchmarkResponse(BaseModel):
    available: bool
    reason: str | None = None

    population_id: int | None = None
    population_name: str | None = None

    current_tenant_score: float | None = None
    peer_average_score: float | None = None
    delta_vs_peer: float | None = None

    peer_sample_size: int = Field(default=0, ge=0)
    minimum_sample_size: int | None = Field(default=None, ge=1)

    metric: Literal["uee_score"] = "uee_score"
    evaluated_at: datetime | None = None


class BenchmarkSummaryResponse(BaseModel):
    tenant_id: int

    latest: BenchmarkSnapshotResponse | None = None
    comparison: BenchmarkComparisonResponse

    historical_snapshot_count: int = Field(ge=0)

    peer_benchmark_available: bool
    peer_benchmark_reason: str | None = None
    peer_benchmark: PeerBenchmarkResponse | None = None
