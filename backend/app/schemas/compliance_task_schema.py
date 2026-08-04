from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict, Field


class ComplianceTaskCreate(BaseModel):
    process_id: int
    control_id: Optional[int] = None
    priority_score: int
    owner_role: str
    due_date: datetime
    title: Optional[str] = None
    description: Optional[str] = None


class ComplianceTaskResponse(BaseModel):
    id: int
    process_id: int
    control_id: Optional[int] = None
    priority_score: int
    owner_role: str
    due_date: datetime
    status: str
    title: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ComplianceTaskListResponse(BaseModel):
    total: int
    tasks: List[ComplianceTaskResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)