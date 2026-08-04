from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user

from app.models.requirements import Requirement
from app.models.controls import Control
from app.models.standard_versions import StandardVersion

router = APIRouter(
    prefix="/requirements",
    tags=["RequirementControls"],
)


# =====================================================
# GET /requirements/{requirement_id}/controls
# =====================================================
@router.get("/{requirement_id}/controls", response_model=List[dict])
def list_requirement_controls(
    requirement_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    req = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")

    controls = (
        db.query(Control)
        .filter(Control.requirement_id == requirement_id)
        .order_by(Control.code)
        .all()
    )

    return [
        {
            "id": c.id,
            "code": c.code,
            "title": c.title,
        }
        for c in controls
    ]


# =====================================================
# POST /requirements/{requirement_id}/controls/{control_id}
# =====================================================
@router.post(
    "/{requirement_id}/controls/{control_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def attach_control_to_requirement(
    requirement_id: int,
    control_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    req = db.query(Requirement).filter(Requirement.id == requirement_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Requirement not found")

    ctl = db.query(Control).filter(Control.id == control_id).first()
    if not ctl:
        raise HTTPException(status_code=404, detail="Control not found")

    sv = (
        db.query(StandardVersion)
        .filter(
            StandardVersion.id == req.clause.standard_version_id,
            StandardVersion.status == "draft",
        )
        .first()
    )
    if not sv:
        raise HTTPException(
            status_code=403,
            detail="Cannot modify published standard",
        )

    ctl.requirement_id = requirement_id
    db.add(ctl)
    db.commit()
    return None


# =====================================================
# DELETE /requirements/{requirement_id}/controls/{control_id}
# =====================================================
@router.delete(
    "/{requirement_id}/controls/{control_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def detach_control_from_requirement(
    requirement_id: int,
    control_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ctl = (
        db.query(Control)
        .filter(
            Control.id == control_id,
            Control.requirement_id == requirement_id,
        )
        .first()
    )
    if not ctl:
        raise HTTPException(status_code=404, detail="Link not found")

    sv = (
        db.query(StandardVersion)
        .filter(
            StandardVersion.id == ctl.standard_version_id,
            StandardVersion.status == "draft",
        )
        .first()
    )
    if not sv:
        raise HTTPException(
            status_code=403,
            detail="Cannot modify published standard",
        )

    ctl.requirement_id = None
    db.add(ctl)
    db.commit()
    return None
