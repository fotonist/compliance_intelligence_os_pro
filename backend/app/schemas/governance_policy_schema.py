from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict


class GovernancePolicyStatus(str, Enum):
    draft = "draft"
    under_review = "under_review"
    approved = "approved"
    expired = "expired"
    archived = "archived"


class GovernancePolicyCategory(str, Enum):
    information_security = "information_security"
    quality = "quality"
    compliance = "compliance"
    risk = "risk"
    operation = "operation"
    hr = "hr"
    other = "other"


class GovernancePolicyBase(BaseModel):

    description: Optional[str] = None

    category: GovernancePolicyCategory = (
        GovernancePolicyCategory.other
    )

    status: GovernancePolicyStatus = (
        GovernancePolicyStatus.draft
    )

    version: str = "1.0"

    owner_id: Optional[int] = None

    approver_id: Optional[int] = None

    effective_date: Optional[datetime] = None

    review_date: Optional[datetime] = None


class GovernancePolicyCreate(
    GovernancePolicyBase
):
    pass


class GovernancePolicyUpdate(BaseModel):

    title: Optional[str] = None

    description: Optional[str] = None

    category: Optional[
        GovernancePolicyCategory
    ] = None

    status: Optional[
        GovernancePolicyStatus
    ] = None

    version: Optional[str] = None

    owner_id: Optional[int] = None

    approver_id: Optional[int] = None

    effective_date: Optional[datetime] = None

    review_date: Optional[datetime] = None


class GovernancePolicyInDBBase(BaseModel):

    created_at: Optional[datetime] = None

    updated_at: Optional[datetime] = None

    model_config = ConfigDict(
        from_attributes=True
    )


class GovernancePolicy(
    GovernancePolicyInDBBase
):

    model_config = ConfigDict(
        from_attributes=True
    )


class GovernancePolicyList(BaseModel):

    items: list[GovernancePolicy] = []

