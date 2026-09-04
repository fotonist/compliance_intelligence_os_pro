from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.evidences import Evidence
from app.models.controls import Control
from app.models.standards import Standard
from app.models.standard_versions import StandardVersion
from app.models.matrix_instance import MatrixInstance

router = APIRouter(prefix="/evidences", tags=["evidence-create"])


@router.post("")
@router.post("/")
def create_evidence_fixed(
    payload: dict,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    assessment_type = str(payload.get("assessment_type", "control")).strip().lower()
    if assessment_type not in {"control", "maturity"}:
        raise HTTPException(
            status_code=400,
            detail="assessment_type must be 'control' or 'maturity'",
        )

    title = str(payload.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="title is required")

    tenant_id = getattr(user, "tenant_id", None)
    if not tenant_id:
        raise HTTPException(status_code=403, detail="User tenant is not available")

    control = None
    standard_version_id = payload.get("standard_version_id")
    standard_id = payload.get("standard_id")
    requirement_id = payload.get("requirement_id")

    if assessment_type == "control":
        control_id = payload.get("control_id")
        if not control_id:
            raise HTTPException(
                status_code=400,
                detail="control_id is required for control evidence",
            )

        control = (
            db.query(Control)
            .join(
                StandardVersion,
                StandardVersion.id == Control.standard_version_id,
            )
            .join(
                MatrixInstance,
                MatrixInstance.standard_version_id == StandardVersion.id,
            )
            .filter(
                Control.id == int(control_id),
                MatrixInstance.tenant_id == tenant_id,
            )
            .first()
        )

        if not control:
            raise HTTPException(
                status_code=404,
                detail="Control not found in current tenant scope",
            )

        # The selected control is the authoritative version context.
        # A control evidence record must always use the exact
        # standard_version_id of its control.
        control_standard_version_id = control.standard_version_id

        if not control_standard_version_id:
            raise HTTPException(
                status_code=409,
                detail="Selected control is not linked to a standard version",
            )

        if (
            standard_version_id is not None
            and int(standard_version_id) != int(control_standard_version_id)
        ):
            raise HTTPException(
                status_code=409,
                detail="standard_version_id does not match the selected control",
            )

        standard_version_id = control_standard_version_id

        if not requirement_id:
            requirement_id = control.requirement_id

    if not standard_version_id:
        raise HTTPException(
            status_code=400,
            detail="standard_version_id is required",
        )

    standard_version = (
        db.query(StandardVersion)
        .filter(StandardVersion.id == int(standard_version_id))
        .first()
    )
    if not standard_version:
        raise HTTPException(status_code=404, detail="Standard version not found")

    # Standard root is derived from the selected standard version.
    if not standard_id:
        standard_id = standard_version.standard_id

    standard = db.query(Standard).filter(Standard.id == int(standard_id)).first()
    if not standard:
        raise HTTPException(status_code=404, detail="Standard not found")

    if int(standard_id) != int(standard_version.standard_id):
        raise HTTPException(
            status_code=409,
            detail="Standard does not match the selected standard version",
        )

    evidence = Evidence(
        tenant_id=tenant_id,
        standard_id=int(standard_id),
        standard_version_id=int(standard_version_id),
        control_id=control.id if control else payload.get("control_id"),
        requirement_id=requirement_id,
        title=title,
        description=payload.get("description"),
        regulation=payload.get("regulation"),
        source_url=payload.get("source_url"),
        assessment_type=assessment_type,
        # A new evidence record has no approved file yet.
        status="draft",
        is_deleted=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    return {
        "id": evidence.id,
        "title": evidence.title,
        "description": evidence.description,
        "assessment_type": evidence.assessment_type,
        "status": evidence.status,
        "control_id": evidence.control_id,
        "requirement_id": evidence.requirement_id,
        "standard_id": evidence.standard_id,
        "standard_version_id": evidence.standard_version_id,
        "standard": {
            "id": standard.id,
            "code": standard.code,
            "title": standard.title,
        },
        "standard_version": {
            "id": standard_version.id,
            "version_code": standard_version.version_code,
            "status": standard_version.status,
        },
    }
