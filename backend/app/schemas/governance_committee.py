from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ==========================================================
# COMMITTEE
# ==========================================================

class GovernanceCommitteeCreate(BaseModel):
    committee_code: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=500)
    committee_type: str = Field(..., min_length=1, max_length=100)

    description: Optional[str] = None

    chairperson_id: Optional[int] = None
    secretary_id: Optional[int] = None

    status: str = Field(default="ACTIVE", max_length=50)
    meeting_cadence: Optional[str] = Field(default=None, max_length=100)

    effective_date: Optional[date] = None
    review_date: Optional[date] = None


class GovernanceCommitteeUpdate(BaseModel):
    committee_code: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=500,
    )

    committee_type: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    description: Optional[str] = None

    chairperson_id: Optional[int] = None
    secretary_id: Optional[int] = None

    status: Optional[str] = Field(
        default=None,
        max_length=50,
    )

    meeting_cadence: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    effective_date: Optional[date] = None
    review_date: Optional[date] = None


class GovernanceCommitteeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: int

    committee_code: str
    name: str
    committee_type: str
    description: Optional[str] = None

    chairperson_id: Optional[int] = None
    secretary_id: Optional[int] = None

    status: str
    meeting_cadence: Optional[str] = None

    effective_date: Optional[date] = None
    review_date: Optional[date] = None

    created_by: Optional[int] = None
    updated_by: Optional[int] = None

    is_deleted: bool

    created_at: datetime
    updated_at: datetime


class GovernanceCommitteeListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int

    committee_code: str
    name: str
    committee_type: str
    status: str

    chairperson_id: Optional[int] = None
    secretary_id: Optional[int] = None

    meeting_cadence: Optional[str] = None

    effective_date: Optional[date] = None
    review_date: Optional[date] = None

    created_at: datetime
    updated_at: datetime


# ==========================================================
# MEMBERS
# ==========================================================

class GovernanceCommitteeMemberCreate(BaseModel):
    user_id: int

    member_role: str = Field(
        default="MEMBER",
        min_length=1,
        max_length=100,
    )

    is_voting_member: bool = True

    start_date: Optional[date] = None
    end_date: Optional[date] = None

    status: str = Field(
        default="ACTIVE",
        max_length=50,
    )


class GovernanceCommitteeMemberUpdate(BaseModel):
    member_role: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    is_voting_member: Optional[bool] = None

    start_date: Optional[date] = None
    end_date: Optional[date] = None

    status: Optional[str] = Field(
        default=None,
        max_length=50,
    )


class GovernanceCommitteeMemberRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: int
    committee_id: int
    user_id: int

    member_role: str
    is_voting_member: bool

    start_date: Optional[date] = None
    end_date: Optional[date] = None

    status: str

    created_at: datetime
    updated_at: datetime


# ==========================================================
# MEETING SUMMARY
# ==========================================================

class GovernanceCommitteeMeetingSummary(BaseModel):
    total: int = 0
    scheduled: int = 0
    completed: int = 0
    cancelled: int = 0

    next_meeting_id: Optional[int] = None
    next_meeting_code: Optional[str] = None
    next_meeting_title: Optional[str] = None
    next_meeting_at: Optional[datetime] = None


# ==========================================================
# DETAIL
# ==========================================================

class GovernanceCommitteeDetailRead(GovernanceCommitteeRead):
    members: list[GovernanceCommitteeMemberRead] = Field(default_factory=list)
    meeting_summary: GovernanceCommitteeMeetingSummary
    member_count: int = 0
    voting_member_count: int = 0


# ==========================================================
# HISTORY
# ==========================================================

class GovernanceCommitteeHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: int
    committee_id: int

    action: str
    field_name: Optional[str] = None

    old_value: Optional[str] = None
    new_value: Optional[str] = None

    comment: Optional[str] = None

    performed_by: Optional[int] = None
    created_at: datetime
