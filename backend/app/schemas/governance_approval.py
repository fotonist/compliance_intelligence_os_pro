from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ApprovalAuthorityBase(BaseModel):
    authority_code: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=500)
    authority_type: str = Field(..., min_length=1, max_length=100)
    scope: Optional[str] = None
    approver_id: Optional[int] = None
    approval_limit: Optional[Decimal] = Field(default=None, ge=0)
    currency: Optional[str] = Field(default=None, max_length=10)
    effective_date: Optional[date] = None
    review_date: Optional[date] = None
    status: str = Field(default="ACTIVE", max_length=50)

    @model_validator(mode="after")
    def validate_dates(self):
        if (
            self.effective_date is not None
            and self.review_date is not None
            and self.review_date < self.effective_date
        ):
            raise ValueError("review_date cannot be before effective_date")
        return self


class ApprovalAuthorityCreate(ApprovalAuthorityBase):
    pass


class ApprovalAuthorityUpdate(BaseModel):
    authority_code: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=500,
    )
    authority_type: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    scope: Optional[str] = None
    approver_id: Optional[int] = None
    approval_limit: Optional[Decimal] = Field(default=None, ge=0)
    currency: Optional[str] = Field(default=None, max_length=10)
    effective_date: Optional[date] = None
    review_date: Optional[date] = None
    status: Optional[str] = Field(default=None, max_length=50)

    @model_validator(mode="after")
    def validate_dates(self):
        if (
            self.effective_date is not None
            and self.review_date is not None
            and self.review_date < self.effective_date
        ):
            raise ValueError("review_date cannot be before effective_date")
        return self


class ApprovalAuthorityResponse(ApprovalAuthorityBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: int
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    is_deleted: bool
    created_at: datetime
    updated_at: datetime


class DelegationBase(BaseModel):
    authority_id: Optional[int] = None
    delegation_code: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=500)
    delegator_id: Optional[int] = None
    delegate_id: Optional[int] = None
    scope: Optional[str] = None
    authority_limit: Optional[Decimal] = Field(default=None, ge=0)
    currency: Optional[str] = Field(default=None, max_length=10)
    start_date: date
    end_date: date
    reason: Optional[str] = None
    status: str = Field(default="ACTIVE", max_length=50)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date cannot be before start_date")
        return self


class DelegationCreate(DelegationBase):
    pass


class DelegationUpdate(BaseModel):
    authority_id: Optional[int] = None
    delegation_code: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=500,
    )
    delegator_id: Optional[int] = None
    delegate_id: Optional[int] = None
    scope: Optional[str] = None
    authority_limit: Optional[Decimal] = Field(default=None, ge=0)
    currency: Optional[str] = Field(default=None, max_length=10)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    reason: Optional[str] = None
    status: Optional[str] = Field(default=None, max_length=50)

    @model_validator(mode="after")
    def validate_dates(self):
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError("end_date cannot be before start_date")
        return self


class DelegationResponse(DelegationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: int
    created_by: Optional[int] = None
    updated_by: Optional[int] = None
    is_deleted: bool
    created_at: datetime
    updated_at: datetime


class ApprovalHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: int
    authority_id: Optional[int] = None
    delegation_id: Optional[int] = None
    action: str
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    comment: Optional[str] = None
    performed_by: Optional[int] = None
    created_at: datetime


class ApprovalSummaryResponse(BaseModel):
    active_authorities: int
    active_delegations: int
    expiring_soon: int
    expired: int


class ApprovalAuthorityListResponse(BaseModel):
    items: list[ApprovalAuthorityResponse]
    total: int


class DelegationListResponse(BaseModel):
    items: list[DelegationResponse]
    total: int
