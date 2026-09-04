from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict, Field, field_validator


TASK_TYPES = {
    "REMEDIATION",
    "CORRECTIVE_ACTION",
    "EVIDENCE_COLLECTION",
    "RISK_TREATMENT",
    "COMPLIANCE_ACTION",
    "REVIEW",
}

TASK_STATUSES = {
    "OPEN",
    "IN_PROGRESS",
    "UNDER_REVIEW",
    "READY_TO_CLOSE",
    "DONE",
    "BLOCKED",
    "CANCELLED",
}


class ComplianceTaskCreate(BaseModel):
    process_id: int
    control_id: Optional[int] = None
    task_type: str = "COMPLIANCE_ACTION"
    title: str
    description: Optional[str] = None
    priority_score: int = Field(ge=0, le=100)
    owner_role: str
    assignee_user_id: Optional[int] = None
    due_date: datetime

    @field_validator("task_type")
    @classmethod
    def validate_task_type(cls, value: str) -> str:
        value = value.strip().upper()
        if value not in TASK_TYPES:
            raise ValueError(
                f"Invalid task_type. Allowed values: {sorted(TASK_TYPES)}"
            )
        return value


class ComplianceTaskUpdate(BaseModel):
    control_id: Optional[int] = None
    task_type: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    priority_score: Optional[int] = Field(default=None, ge=0, le=100)
    owner_role: Optional[str] = None
    assignee_user_id: Optional[int] = None
    due_date: Optional[datetime] = None

    @field_validator("task_type")
    @classmethod
    def validate_task_type(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None

        value = value.strip().upper()
        if value not in TASK_TYPES:
            raise ValueError(
                f"Invalid task_type. Allowed values: {sorted(TASK_TYPES)}"
            )
        return value


class TaskAssignRequest(BaseModel):
    assignee_user_id: int


class TaskTransitionRequest(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        value = value.strip().upper()
        if value not in TASK_STATUSES:
            raise ValueError(
                f"Invalid status. Allowed values: {sorted(TASK_STATUSES)}"
            )
        return value


class ComplianceTaskResponse(BaseModel):
    id: int
    process_id: int
    control_id: Optional[int] = None
    task_type: str
    title: str
    description: Optional[str] = None
    priority_score: int
    owner_role: str
    assignee_user_id: Optional[int] = None
    created_by_user_id: Optional[int] = None
    due_date: datetime
    status: str
    source_type: str
    source_id: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ComplianceTaskListResponse(BaseModel):
    total: int
    tasks: List[ComplianceTaskResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class TaskEvidenceRequirementCreate(BaseModel):
    name: str
    description: Optional[str] = None
    evidence_type: Optional[str] = None
    required: bool = True


class TaskEvidenceRequirementUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    evidence_type: Optional[str] = None
    required: Optional[bool] = None
    status: Optional[str] = None


class TaskEvidenceRequirementResponse(BaseModel):
    id: int
    task_id: int
    name: str
    description: Optional[str] = None
    evidence_type: Optional[str] = None
    required: bool
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class TaskEvidenceCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    regulation: Optional[str] = None
    source_url: Optional[str] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Evidence title cannot be empty.")
        return value
