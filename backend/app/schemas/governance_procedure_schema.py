from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)


class GovernanceProcedureStatus(str, Enum):

    draft = "draft"
    under_review = "under_review"
    approved = "approved"
    expired = "expired"
    archived = "archived"


class GovernanceProcedureBase(BaseModel):

    policy_id: int

    procedure_code: str

    title: str

    description: Optional[str] = None

    owner_id: Optional[int] = None

    status: GovernanceProcedureStatus = (
        GovernanceProcedureStatus.draft
    )

    version: str = "1.0"

    effective_date: Optional[datetime] = None

    review_date: Optional[datetime] = None


class GovernanceProcedureCreate(
    GovernanceProcedureBase
):
    pass


class GovernanceProcedureUpdate(BaseModel):

    title: Optional[str] = None

    description: Optional[str] = None

    owner_id: Optional[int] = None

    status: Optional[
        GovernanceProcedureStatus
    ] = None

    version: Optional[str] = None

    effective_date: Optional[datetime] = None

    review_date: Optional[datetime] = None


class GovernanceProcedureInDBBase(BaseModel):

    id: int

    tenant_id: int

    is_deleted: bool = False

    created_at: Optional[datetime] = None

    updated_at: Optional[datetime] = None

    model_config = ConfigDict(
        from_attributes=True
    )


class GovernanceProcedure(
    GovernanceProcedureInDBBase
):

    model_config = ConfigDict(
        from_attributes=True
    )


class GovernanceProcedureList(BaseModel):

    items: list[GovernanceProcedure]

    total: int


class DocumentRejectRequest(BaseModel):

    review_comment: str = Field(
        min_length=5,
        max_length=2000
    )
