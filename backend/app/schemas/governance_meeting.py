from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ==========================================================
# MEETING
# ==========================================================

class GovernanceMeetingCreate(BaseModel):
    meeting_code: str = Field(..., min_length=1, max_length=100)
    title: str = Field(..., min_length=1, max_length=500)
    meeting_type: str = Field(..., min_length=1, max_length=100)

    scheduled_at: datetime
    duration_minutes: Optional[int] = Field(default=None, ge=1)
    location: Optional[str] = Field(default=None, max_length=500)
    description: Optional[str] = None

    chairperson_id: Optional[int] = None


class GovernanceMeetingUpdate(BaseModel):
    meeting_code: Optional[str] = Field(default=None, min_length=1, max_length=100)
    title: Optional[str] = Field(default=None, min_length=1, max_length=500)
    meeting_type: Optional[str] = Field(default=None, min_length=1, max_length=100)

    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(default=None, ge=1)
    location: Optional[str] = Field(default=None, max_length=500)
    description: Optional[str] = None

    chairperson_id: Optional[int] = None


class GovernanceMeetingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: int

    meeting_code: str
    title: str
    meeting_type: str
    status: str

    scheduled_at: datetime
    duration_minutes: Optional[int] = None
    location: Optional[str] = None
    description: Optional[str] = None

    chairperson_id: Optional[int] = None
    created_by: Optional[int] = None
    updated_by: Optional[int] = None

    is_deleted: bool

    created_at: datetime
    updated_at: datetime


class GovernanceMeetingListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    meeting_code: str
    title: str
    meeting_type: str
    status: str

    scheduled_at: datetime
    duration_minutes: Optional[int] = None
    location: Optional[str] = None

    chairperson_id: Optional[int] = None

    created_at: datetime
    updated_at: datetime


# ==========================================================
# PARTICIPANTS
# ==========================================================

class GovernanceMeetingParticipantCreate(BaseModel):
    user_id: int
    role: str = Field(default="ATTENDEE", max_length=50)
    attendance_status: str = Field(default="INVITED", max_length=50)


class GovernanceMeetingParticipantUpdate(BaseModel):
    role: Optional[str] = Field(default=None, max_length=50)
    attendance_status: Optional[str] = Field(default=None, max_length=50)


class GovernanceMeetingParticipantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    meeting_id: int
    user_id: int

    role: str
    attendance_status: str

    created_at: datetime


# ==========================================================
# AGENDA
# ==========================================================

class GovernanceMeetingAgendaItemCreate(BaseModel):
    item_order: int = Field(..., ge=1)
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    presenter_id: Optional[int] = None
    status: str = Field(default="PENDING", max_length=50)


class GovernanceMeetingAgendaItemUpdate(BaseModel):
    item_order: Optional[int] = Field(default=None, ge=1)
    title: Optional[str] = Field(default=None, min_length=1, max_length=500)
    description: Optional[str] = None
    presenter_id: Optional[int] = None
    status: Optional[str] = Field(default=None, max_length=50)


class GovernanceMeetingAgendaItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    meeting_id: int

    item_order: int
    title: str
    description: Optional[str] = None

    presenter_id: Optional[int] = None
    status: str

    created_at: datetime
    updated_at: datetime


# ==========================================================
# LINKS
# ==========================================================

class GovernanceMeetingDecisionLink(BaseModel):
    decision_register_id: int


class GovernanceMeetingActionLink(BaseModel):
    action_id: int


class GovernanceMeetingDecisionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    meeting_id: int
    decision_register_id: int
    created_at: datetime


class GovernanceMeetingActionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    meeting_id: int
    action_id: int
    created_at: datetime


# ==========================================================
# HISTORY
# ==========================================================

class GovernanceMeetingHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    meeting_id: int

    action: str
    field_name: Optional[str] = None

    old_value: Optional[str] = None
    new_value: Optional[str] = None

    comment: Optional[str] = None

    performed_by: Optional[int] = None
    created_at: datetime
