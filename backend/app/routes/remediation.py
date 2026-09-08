from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.remediation import (
    RemediationItem,
    RemediationResponse,
)
from app.services.remediation_service import RemediationService


router = APIRouter(
    prefix="/company/remediation",
    tags=["company_remediation"],
)


@router.get(
    "",
    response_model=RemediationResponse,
)
def list_remediation(
    source: str | None = Query(default=None),
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return RemediationService.list(
        db=db,
        user=current_user,
        source=source,
        status_filter=status,
    )


@router.get(
    "/{source}/{source_id}",
    response_model=RemediationItem,
)
def get_remediation(
    source: str,
    source_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return RemediationService.get(
        db=db,
        user=current_user,
        source=source,
        source_id=source_id,
    )
