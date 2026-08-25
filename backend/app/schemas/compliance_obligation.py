from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ComplianceObligationBase(BaseModel):
    code: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=500)
    description: Optional[str] = None

    source_authority: Optional[str] = Field(
        default=None,
        max_length=255,
    )

    regulation_name: Optional[str] = Field(
        default=None,
        max_length=500,
    )

    jurisdiction: Optional[str] = Field(
        default=None,
        max_length=255,
    )

    reference_url: Optional[str] = Field(
        default=None,
        max_length=1000,
    )

    effective_date: Optional[date] = None
    expiry_date: Optional[date] = None
    review_date: Optional[date] = None

    status: str = Field(
        default="active",
        max_length=32,
    )

    criticality: str = Field(
        default="medium",
        max_length=32,
    )

    owner_user_id: Optional[int] = None

    applicability_status: str = Field(
        default="under_review",
        max_length=32,
    )

    applicability_reason: Optional[str] = None


class ComplianceObligationCreate(ComplianceObligationBase):
    """Schema for creating a compliance obligation."""

    pass


class ComplianceObligationUpdate(BaseModel):
    """Partial update schema for a compliance obligation."""

    code: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    title: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=500,
    )

    description: Optional[str] = None

    source_authority: Optional[str] = Field(
        default=None,
        max_length=255,
    )

    regulation_name: Optional[str] = Field(
        default=None,
        max_length=500,
    )

    jurisdiction: Optional[str] = Field(
        default=None,
        max_length=255,
    )

    reference_url: Optional[str] = Field(
        default=None,
        max_length=1000,
    )

    effective_date: Optional[date] = None
    expiry_date: Optional[date] = None
    review_date: Optional[date] = None

    status: Optional[str] = Field(
        default=None,
        max_length=32,
    )

    criticality: Optional[str] = Field(
        default=None,
        max_length=32,
    )

    owner_user_id: Optional[int] = None

    applicability_status: Optional[str] = Field(
        default=None,
        max_length=32,
    )

    applicability_reason: Optional[str] = None


class ComplianceObligationReview(BaseModel):
    """Schema for reviewing obligation applicability."""

    applicability_status: str = Field(
        min_length=1,
        max_length=32,
    )

    applicability_reason: Optional[str] = None

    review_date: Optional[date] = None


class ComplianceObligationInDBBase(ComplianceObligationBase):
    id: int
    tenant_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ComplianceObligation(ComplianceObligationInDBBase):
    """API response schema for a compliance obligation."""

    model_config = ConfigDict(from_attributes=True)


class ComplianceObligationListItem(ComplianceObligationInDBBase):
    """Compact list representation."""

    model_config = ConfigDict(from_attributes=True)
