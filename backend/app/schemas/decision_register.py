from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ==========================================================
# CREATE
# ==========================================================

class DecisionRegisterCreate(BaseModel):
    decision_code: str = Field(
        ...,
        min_length=1,
        max_length=100,
    )

    title: str = Field(
        ...,
        min_length=1,
        max_length=500,
    )

    decision_type: str = Field(
        default="governance",
        max_length=100,
    )

    status: str = Field(
        default="draft",
        max_length=50,
    )

    priority: str = Field(
        default="medium",
        max_length=30,
    )

    decision_date: Optional[datetime] = None

    decision_maker_id: Optional[int] = None
    owner_id: Optional[int] = None
    approver_id: Optional[int] = None

    approval_date: Optional[datetime] = None
    review_date: Optional[datetime] = None

    context: Optional[str] = None
    rationale: Optional[str] = None

    decision_statement: str = Field(
        ...,
        min_length=1,
    )

    expected_outcome: Optional[str] = None
    impact_assessment: Optional[str] = None

    policy_id: Optional[int] = None
    procedure_id: Optional[int] = None


# ==========================================================
# UPDATE
# ==========================================================

class DecisionRegisterUpdate(BaseModel):
    decision_code: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    title: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=500,
    )

    decision_type: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    status: Optional[str] = Field(
        default=None,
        max_length=50,
    )

    priority: Optional[str] = Field(
        default=None,
        max_length=30,
    )

    decision_date: Optional[datetime] = None

    decision_maker_id: Optional[int] = None
    owner_id: Optional[int] = None
    approver_id: Optional[int] = None

    approval_date: Optional[datetime] = None
    review_date: Optional[datetime] = None

    context: Optional[str] = None
    rationale: Optional[str] = None
    decision_statement: Optional[str] = None
    expected_outcome: Optional[str] = None
    impact_assessment: Optional[str] = None

    policy_id: Optional[int] = None
    procedure_id: Optional[int] = None


# ==========================================================
# READ
# ==========================================================

class DecisionRegisterRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: int
    tenant_id: int

    decision_code: str
    title: str

    decision_type: str
    status: str
    priority: str

    decision_date: Optional[datetime] = None

    decision_maker_id: Optional[int] = None
    owner_id: Optional[int] = None
    approver_id: Optional[int] = None

    approval_date: Optional[datetime] = None
    review_date: Optional[datetime] = None

    context: Optional[str] = None
    rationale: Optional[str] = None
    decision_statement: str

    expected_outcome: Optional[str] = None
    impact_assessment: Optional[str] = None

    policy_id: Optional[int] = None
    procedure_id: Optional[int] = None

    is_deleted: bool

    created_by: Optional[int] = None
    updated_by: Optional[int] = None

    created_at: datetime
    updated_at: datetime


# ==========================================================
# LIST
# ==========================================================

class DecisionRegisterListItem(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: int
    decision_code: str
    title: str

    decision_type: str
    status: str
    priority: str

    decision_date: Optional[datetime] = None
    review_date: Optional[datetime] = None

    decision_maker_id: Optional[int] = None
    owner_id: Optional[int] = None
    approver_id: Optional[int] = None

    policy_id: Optional[int] = None
    procedure_id: Optional[int] = None

    created_at: datetime
    updated_at: datetime


# ==========================================================
# HISTORY
# ==========================================================

class DecisionRegisterHistoryRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: int
    decision_register_id: int

    action: str
    field_name: Optional[str] = None

    old_value: Optional[str] = None
    new_value: Optional[str] = None

    comment: Optional[str] = None

    performed_by: Optional[int] = None
    created_at: datetime


# ==========================================================
# LINKS
# ==========================================================

class DecisionRegisterRiskLink(BaseModel):
    risk_id: int


class DecisionRegisterControlLink(BaseModel):
    control_id: int


class DecisionRegisterProcessLink(BaseModel):
    process_id: int


class DecisionRegisterTaskLink(BaseModel):
    task_id: int


class DecisionRegisterLinkRead(BaseModel):
    id: int
    decision_register_id: int
    target_id: int
    created_at: datetime

# ==========================================================
# LIFECYCLE
# ==========================================================

class DecisionRegisterReject(BaseModel):
    comment: str = Field(
        ...,
        min_length=1,
        max_length=5000,
    )


class DecisionRegisterLifecycleRead(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: int
    decision_code: str
    title: str
    status: str

    approver_id: Optional[int] = None
    approval_date: Optional[datetime] = None

    updated_by: Optional[int] = None
    updated_at: datetime
