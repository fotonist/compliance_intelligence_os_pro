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


class BenchmarkSummaryResponse(BaseModel):
    tenant_id: int

    latest: BenchmarkSnapshotResponse | None = None
    comparison: BenchmarkComparisonResponse

    historical_snapshot_count: int = Field(ge=0)

    peer_benchmark_available: bool
    peer_benchmark_reason: str | None = None
