from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class AuditPlanCreate(BaseModel):
    reference: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    audit_type: str = "internal"
    objective: Optional[str] = None
    scope: Optional[str] = None
    standard_id: Optional[int] = None
    standard_version_id: Optional[int] = None
    process_id: Optional[int] = None
    lead_auditor_id: Optional[int] = None
    planned_start: Optional[date] = None
    planned_end: Optional[date] = None


class AuditPlanSummary(BaseModel):
    id: int
    reference: str
    name: str
    audit_type: str
    status: str
    process_id: Optional[int] = None
    standard_id: Optional[int] = None
    lead_auditor_id: Optional[int] = None
    planned_start: Optional[date] = None
    planned_end: Optional[date] = None

    model_config = ConfigDict(from_attributes=True)


class AuditPlanDetail(AuditPlanSummary):
    objective: Optional[str] = None
    scope: Optional[str] = None
    standard_version_id: Optional[int] = None
    created_by: Optional[int] = None
    created_at: object
    updated_at: object

    model_config = ConfigDict(from_attributes=True)
