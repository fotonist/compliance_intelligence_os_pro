from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class ExecutiveRiskItem(BaseModel):
    risk_id: int
    title: str
    score: float
    level: str

    model_config = ConfigDict(from_attributes=True)


class ExecutiveTaskItem(BaseModel):
    task_id: int
    title: str
    status: str
    priority: str
    due_date: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ExecutiveEvidenceItem(BaseModel):
    evidence_id: int
    title: str
    status: str
    coverage: float

    model_config = ConfigDict(from_attributes=True)


class ExecutiveComplianceStatus(BaseModel):
    total_controls: int
    implemented_controls: int
    coverage_percent: float

    model_config = ConfigDict(from_attributes=True)


class ExecutiveKPI(BaseModel):
    compliance_score: float
    risk_score: float
    maturity_score: float
    evidence_strength: float
    open_findings: int

    model_config = ConfigDict(from_attributes=True)


class ExecutiveSummary(BaseModel):
    organization: str

    compliance: ExecutiveComplianceStatus

    kpi: ExecutiveKPI

    top_risks: List[ExecutiveRiskItem] = []

    critical_tasks: List[ExecutiveTaskItem] = []

    weak_evidences: List[ExecutiveEvidenceItem] = []

    generated_at: str

    model_config = ConfigDict(from_attributes=True)