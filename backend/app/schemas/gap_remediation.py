from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class ControlGapRemediationCreate(BaseModel):
    standard_id: int
    standard_version_id: int
    adoption_id: int
    control_id: int

    priority_score: int = Field(ge=0, le=100)
    owner_role: str
    assignee_user_id: int | None = None
    due_date: datetime

    @field_validator("owner_role")
    @classmethod
    def validate_owner_role(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("owner_role cannot be empty.")

        return value


class GapRemediationResponse(BaseModel):
    created: bool
    task_id: int
    status: str
    action: str
    process_id: int | None = None
