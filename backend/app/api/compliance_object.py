from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db

from app.services.compliance_object_service import ComplianceObjectService
from app.schemas.compliance_workspace_schema import (
    ComplianceWorkspaceResponse,
)

router = APIRouter(
    prefix="/company/compliance-object",
    tags=["Compliance Workspace"],
)


@router.get(
    "/{control_id}",
    response_model=ComplianceWorkspaceResponse,
    status_code=status.HTTP_200_OK,
)
async def get_compliance_object(
    control_id: int,
    db: Session = Depends(get_db),
):
    """
    Returns the complete Compliance Workspace
    for a single control.

    Includes

    - Standard
    - Clause
    - Requirement
    - Control
    - Evidences
    - Risks
    - Tasks
    - Coverage
    - Analytics
    """

    service = ComplianceObjectService(db)

    result = await service.get_workspace(control_id)

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Compliance object not found.",
        )

    return result