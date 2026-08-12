from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db

from app.services.compliance_object_service import ComplianceObjectService
from app.schemas.compliance_workspace_schema import ComplianceWorkspaceResponse

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
    Returns the complete Compliance Workspace for a single control.
    """
    try:
        service = ComplianceObjectService(db)
        result = await service.get_workspace(control_id)

        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Compliance object not found.",
            )

        return result

    except HTTPException:
        raise
    except Exception as exc:
        # Do not let an unhandled exception escape the route. In production this
        # also guarantees a normal JSON response so the frontend can display the
        # actual backend failure instead of the misleading generic "Failed to fetch".
        print(
            f"Compliance Workspace failed for control_id={control_id}: {exc}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Compliance Workspace failed: {exc}",
        ) from exc
