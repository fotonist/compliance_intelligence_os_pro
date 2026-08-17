from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, model_validator

# =====================================================
# STANDARD
# =====================================================

class StandardDto(BaseModel):
    id: Optional[int] = None
    code: Optional[str] = None
    title: Optional[str] = None
    type: Optional[str] = None


# =====================================================
# CLAUSE
# =====================================================

class ClauseDto(BaseModel):
    id: Optional[int] = None
    code: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None


# =====================================================
# REQUIREMENT
# =====================================================

class RequirementDto(BaseModel):
    id: Optional[int] = None
    code: Optional[str] = None
    title: Optional[str] = None


# =====================================================
# CONTROL
# =====================================================

class ControlDto(BaseModel):
    id: int
    code: str
    title: Optional[str] = None
    description: Optional[str] = None
    standard_version_id: Optional[int] = None
    # =====================================================
# COVERAGE
# =====================================================

class CoverageDto(BaseModel):
    status: str
    percentage: float

    total_evidence: int

    approved_evidence: int

    pending_evidence: int

    rejected_evidence: int


# =====================================================
# EVIDENCE
# =====================================================

class EvidenceDto(BaseModel):

    id: int

    title: str

    description: Optional[str] = None

    status: Optional[str] = None

    approval_status: Optional[str] = None

    assessment_type: Optional[str] = None

    regulation: Optional[str] = None

    source_url: Optional[str] = None

    reviewed_by: Optional[int] = None

    reviewed_at: Optional[datetime] = None

    created_at: Optional[datetime] = None

    updated_at: Optional[datetime] = None

    file_count: int

    @model_validator(mode="after")
    def sync_status_with_approval_state(self):
        """
        The workspace evidence status must reflect the same
        evidence-file-derived approval state used by CoverageDto.

        This prevents stale evidences.status values (for example,
        APPROVED with zero files) from disagreeing with the KPI
        counters and coverage calculation.
        """
        if self.approval_status:
            self.status = self.approval_status
        return self


# =====================================================
# RISK
# =====================================================

class RiskDto(BaseModel):

    id: int

    title: str

    description: Optional[str] = None

    impact: int

    likelihood: int

    score: int

    risk_level: str

    status: str

    treatment: Optional[str] = None

    action: Optional[str] = None

    coverage_status: Optional[str] = None

    created_at: Optional[datetime] = None

    updated_at: Optional[datetime] = None


# =====================================================
# RISK SUMMARY
# =====================================================

class RiskSummaryDto(BaseModel):

    total: int

    critical: int

    high: int

    medium: int

    low: int

    total_score: int

    average_score: float
    # =====================================================
# TASK
# =====================================================

class TaskDto(BaseModel):

    id: int

    title: Optional[str] = None

    description: Optional[str] = None

    priority_score: Optional[int] = None

    status: Optional[str] = None

    owner_role: Optional[str] = None

    source_type: Optional[str] = None

    source_id: Optional[int] = None

    due_date: Optional[datetime] = None

    created_at: Optional[datetime] = None

    updated_at: Optional[datetime] = None


# =====================================================
# TASK SUMMARY
# =====================================================

class TaskSummaryDto(BaseModel):

    total: int

    open: int

    completed: int

    overdue: int


# =====================================================
# TIMELINE
# =====================================================

class TimelineDto(BaseModel):

    type: str

    action: str

    title: str

    date: datetime


# =====================================================
# ANALYTICS
# =====================================================

class AnalyticsDto(BaseModel):

    health_score: float

    coverage_percentage: float

    risk_score: int

    evidence_count: int

    approved_evidence: int

    pending_evidence: int

    rejected_evidence: int

    risk_count: int

    critical_risk_count: int

    high_risk_count: int

    medium_risk_count: int

    low_risk_count: int

    task_count: int

    open_tasks: int

    completed_tasks: int

    overdue_tasks: int


    
# =====================================================
# AI FINDING
# =====================================================

class AIFindingDto(BaseModel):

    category: str

    severity: str

    message: str



# =====================================================
# AI ENGINE
# =====================================================

class AIEngineDto(BaseModel):

    status: str

    source: str



# =====================================================
# ROOT RESPONSE
# =====================================================

class ComplianceWorkspaceResponse(BaseModel):

    standard: StandardDto

    clause: ClauseDto

    requirement: RequirementDto

    control: ControlDto

    coverage: CoverageDto

    evidences: List[EvidenceDto]

    risks: List[RiskDto]

    risk_summary: RiskSummaryDto

    tasks: List[TaskDto]

    task_summary: TaskSummaryDto

    analytics: AnalyticsDto

    timeline: List[TimelineDto]

    ai_summary: List[str]
    ai_executive_summary: Optional[str] = None
    ai_findings: List[AIFindingDto] = []

    ai_engine: AIEngineDto = AIEngineDto(
        status="ACTIVE",
        source="Compliance Intelligence Engine",
    )

    class Config:
        from_attributes = True