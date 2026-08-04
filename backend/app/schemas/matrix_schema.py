from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


# Evidence
class EvidenceResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    status: Optional[str] = None   # accepted / rejected / pending
    control_id: Optional[int] = None
    requirement_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


# Risk
class RiskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None

    # NEW FIELDS
    impact: Optional[int] = None
    likelihood: Optional[int] = None
    score: Optional[int] = None
    risk_level: Optional[str] = None

    previous_score: Optional[int] = None
    prev_impact: Optional[int] = None
    prev_likelihood: Optional[int] = None
    prev_risk_level: Optional[str] = None

    treatment: Optional[str] = None
    status: Optional[str] = None

    control_id: Optional[int] = None
    requirement_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


# Requirement
class RequirementResponse(BaseModel):
    id: int
    code: str
    title: str
    description: Optional[str] = None

    evidences: List[EvidenceResponse] = Field(default_factory=list)
    risks: List[RiskResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


# Clause
class ClauseResponse(BaseModel):
    id: int
    code: str
    title: str

    requirements: List[RequirementResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


# Standard
class StandardResponse(BaseModel):
    id: int
    code: Optional[str] = None      # ISO 27001, ISO 9001 vs.
    name: str
    description: Optional[str] = None
    created_at: datetime

    clauses: List[ClauseResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)