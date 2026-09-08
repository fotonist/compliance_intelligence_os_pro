from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class RemediationItem(BaseModel):
    source: str
    source_id: int
    title: str
    description: Optional[str] = None
    status: str
    normalized_status: str
    priority: Optional[str] = None
    priority_score: Optional[int] = None
    severity: Optional[str] = None
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    reviewer_id: Optional[int] = None
    reviewer_name: Optional[str] = None
    process_id: Optional[int] = None
    control_id: Optional[int] = None
    due_date: Optional[datetime] = None
    overdue: bool = False
    due_soon: bool = False
    awaiting_review: bool = False
    action_url: str


class RemediationSummary(BaseModel):
    total: int
    active: int
    overdue: int
    due_soon: int
    high_priority: int
    awaiting_review: int
    completed: int


class RemediationResponse(BaseModel):
    summary: RemediationSummary
    items: list[RemediationItem]
