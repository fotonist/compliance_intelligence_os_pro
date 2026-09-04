from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

# âš  Bu import kalsÄ±n, dokunma
from app.core.database import get_db as core_get_db

# âš  Ã‡alÄ±ÅŸan DB session importu
from app.db.session import get_db as session_get_db

# ğŸ”¥ ZORUNLU & GARANTÄ° OVERRIDE
get_db = session_get_db

from app.models.controls import Control as ControlModel
from app.models.requirements import Requirement as RequirementModel
from app.models.clauses import Clause as ClauseModel
from app.models.standard_versions import StandardVersion

from app.schemas.controls_schema import (
    Control,
    ControlCreate,
    ControlUpdate,
)

# ğŸ”¹ AUDIT SERVICE
from app.services.audit_service import log_event
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.models.matrix_row import MatrixRow
from app.models.matrix_instance import MatrixInstance

router = APIRouter(
    prefix="/controls",
    tags=["Controls"],
)

# -------------------------------------------------------
# LIST CONTROLS (READ-ONLY, SAFE)
# -------------------------------------------------------
@router.get("/", response_model=List[Control])
def list_controls(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    controls = (
        db.query(ControlModel)
        .join(
            MatrixRow,
            MatrixRow.control_id == ControlModel.id,
        )
        .filter(
            MatrixRow.tenant_id == user.tenant_id
        )
        .distinct()
        .order_by(ControlModel.code)
        .offset(skip)
        .limit(limit)
        .all()
    )

    return [
        {
            "id": c.id,
            "code": c.code,
            "title": c.title,
            "description": c.description,
            "requirement_id": c.requirement_id,
            "standard_version_id": c.standard_version_id,
            "origin": c.origin,
            "requirement": None,
            "clause": None,
            "standard": None,
            "standard_version": None,
            "evidences": [],
        }
        for c in controls
    ]



# -------------------------------------------------------
# GET CONTROL DETAIL (TENANT-SCOPED)
# -------------------------------------------------------
@router.get("/{control_id}", response_model=Control)
def get_control(
    control_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    obj = (
        db.query(ControlModel)
        .join(
            StandardVersion,
            StandardVersion.id == ControlModel.standard_version_id,
        )
        .join(
            MatrixInstance,
            MatrixInstance.standard_version_id == StandardVersion.id,
        )
        .filter(
            ControlModel.id == control_id,
            MatrixInstance.tenant_id == user.tenant_id,
        )
        .first()
    )

    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Control not found",
        )

    requirement = None
    clause = None
    standard = None
    standard_version = None

    if obj.requirement_id:
        requirement = (
            db.query(RequirementModel)
            .filter(
                RequirementModel.id == obj.requirement_id,
            )
            .first()
        )

    if requirement:
        clause = (
            db.query(ClauseModel)
            .filter(
                ClauseModel.id == requirement.clause_id,
            )
            .first()
        )

    if clause:
        standard_version = (
            db.query(StandardVersion)
            .filter(
                StandardVersion.id == clause.standard_version_id,
            )
            .first()
        )

    if standard_version:
        from app.models.standards import Standard

        standard = (
            db.query(Standard)
            .filter(
                Standard.id == standard_version.standard_id,
            )
            .first()
        )

    return {
        "id": obj.id,
        "code": obj.code,
        "title": obj.title,
        "description": obj.description,
        "requirement_id": obj.requirement_id,
        "standard_version_id": obj.standard_version_id,
        "origin": obj.origin,

        "requirement": (
            {
                "id": requirement.id,
                "code": requirement.code,
                "title": requirement.title,
            }
            if requirement
            else None
        ),

        "clause": (
            {
                "id": clause.id,
                "code": clause.code,
                "title": clause.title,
            }
            if clause
            else None
        ),

        "standard": (
            {
                "id": standard.id,
                "code": standard.code,
                "title": standard.title,
            }
            if standard
            else None
        ),

        "standard_version": (
            {
                "id": standard_version.id,
                "version_code": standard_version.version_code,
                "status": standard_version.status,
            }
            if standard_version
            else None
        ),

        "evidences": [],
    }


# -------------------------------------------------------
# CREATE CONTROL (DRAFT ONLY + AUDIT)
# -------------------------------------------------------
@router.post(
    "/",
    response_model=Control,
    status_code=status.HTTP_201_CREATED,
)
def create_control(
    control_in: ControlCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # -------------------------------------------------------
    # STANDARD VERSION IS THE CANONICAL CONTROL OWNER
    # -------------------------------------------------------
    sv = (
        db.query(StandardVersion)
        .join(
            MatrixInstance,
            MatrixInstance.standard_version_id == StandardVersion.id,
        )
        .filter(
            StandardVersion.id == control_in.standard_version_id,
            StandardVersion.status == "draft",
            MatrixInstance.tenant_id == user.tenant_id,
        )
        .first()
    )

    if not sv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Draft standard version is not available for this tenant",
        )

    # -------------------------------------------------------
    # OPTIONAL REQUIREMENT VALIDATION
    # -------------------------------------------------------
    if control_in.requirement_id is not None:
        requirement = (
            db.query(RequirementModel)
            .filter(
                RequirementModel.id == control_in.requirement_id,
            )
            .first()
        )

        if not requirement:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Related requirement not found",
            )

        clause = (
            db.query(ClauseModel)
            .filter(
                ClauseModel.id == requirement.clause_id,
            )
            .first()
        )

        if not clause or clause.standard_version_id != sv.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Requirement does not belong to the selected standard version",
            )
    if not sv:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify published standard version",
        )

    obj = ControlModel(
        code=control_in.code,
        title=control_in.title,
        description=getattr(control_in, "description", None),
        requirement_id=control_in.requirement_id,
        standard_version_id=sv.id,
        origin="custom",
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)

    # ğŸ§¾ AUDIT
    log_event(
        db=db,
        actor=user,
        entity_type="control",
        entity_id=obj.id,
        action="create",
        old_value=None,
        new_value={
            "code": obj.code,
            "title": obj.title,
            "description": obj.description,
        },
    )

    return obj


# -------------------------------------------------------
# UPDATE CONTROL (DRAFT ONLY + AUDIT)
# -------------------------------------------------------
@router.put("/{control_id}", response_model=Control)
def update_control(
    control_id: int,
    control_in: ControlUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    obj = (
        db.query(ControlModel)
        .join(
            MatrixRow,
            MatrixRow.control_id == ControlModel.id,
        )
        .filter(
            ControlModel.id == control_id,
            MatrixRow.tenant_id == user.tenant_id,
        )
        .first()
    )
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Control not found",
        )

    if obj.origin == "canonical":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Canonical controls cannot be modified",
        )

    # -------------------------------------------------------
    # CONTROL'S OWN STANDARD VERSION IS THE LIFECYCLE OWNER
    # -------------------------------------------------------
    sv = (
        db.query(StandardVersion)
        .join(
            MatrixInstance,
            MatrixInstance.standard_version_id == StandardVersion.id,
        )
        .filter(
            StandardVersion.id == obj.standard_version_id,
            StandardVersion.status == "draft",
            MatrixInstance.tenant_id == user.tenant_id,
        )
        .first()
    )

    if not sv:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify a control outside the tenant's draft scope",
        )

    # -------------------------------------------------------
    # OPTIONAL REQUIREMENT VALIDATION
    # -------------------------------------------------------
    if control_in.requirement_id is not None:
        requirement = (
            db.query(RequirementModel)
            .filter(
                RequirementModel.id == control_in.requirement_id,
            )
            .first()
        )

        if not requirement:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Related requirement not found",
            )

        clause = (
            db.query(ClauseModel)
            .filter(
                ClauseModel.id == requirement.clause_id,
            )
            .first()
        )

        if not clause or clause.standard_version_id != obj.standard_version_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Requirement does not belong to the control's standard version",
            )
    if not sv:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify published standard version",
        )

    # ğŸ§¾ BEFORE SNAPSHOT
    before = {
        "code": obj.code,
        "title": obj.title,
        "description": obj.description,
    }

    update_data = control_in.model_dump(exclude_unset=True)

    # standard_version_id is immutable through ControlUpdate.
    allowed_fields = {
        "code",
        "title",
        "description",
        "requirement_id",
    }

    for field, value in update_data.items():
        if field in allowed_fields:
            setattr(obj, field, value)

    db.add(obj)
    db.commit()
    db.refresh(obj)

    # ğŸ§¾ AUDIT
    log_event(
        db=db,
        actor=user,
        entity_type="control",
        entity_id=obj.id,
        action="update",
        old_value=before,
        new_value={
            "code": obj.code,
            "title": obj.title,
            "description": obj.description,
        },
    )

    return obj


# -------------------------------------------------------
# DELETE CONTROL (DRAFT ONLY + AUDIT)
# -------------------------------------------------------
@router.delete(
    "/{control_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_control(
    control_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    obj = (
        db.query(ControlModel)
        .join(
            MatrixRow,
            MatrixRow.control_id == ControlModel.id,
        )
        .filter(
            ControlModel.id == control_id,
            MatrixRow.tenant_id == user.tenant_id,
        )
        .first()
    )
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Control not found",
        )

    if obj.origin == "canonical":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Canonical controls cannot be deleted",
        )

    sv = (
        db.query(StandardVersion)
        .join(
            MatrixInstance,
            MatrixInstance.standard_version_id == StandardVersion.id,
        )
        .filter(
            StandardVersion.id == obj.standard_version_id,
            StandardVersion.status == "draft",
            MatrixInstance.tenant_id == user.tenant_id,
        )
        .first()
    )

    if not sv:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot delete a control outside the tenant's draft scope",
        )
    if not sv:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify published standard version",
        )

    # AUDIT (BEFORE DELETE)
    log_event(
        db=db,
        actor=user,
        entity_type="control",
        entity_id=obj.id,
        action="delete",
        old_value={
            "code": obj.code,
            "title": obj.title,
            "description": obj.description,
        },
        new_value=None,
    )

    db.delete(obj)
    db.commit()
    return None
