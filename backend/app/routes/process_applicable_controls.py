from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.controls import Control
from app.models.process import Process
from app.models.process_applicable_controls import ProcessApplicableControl
from app.models.user import User


router = APIRouter(
    prefix="/company/processes",
    tags=["Process Applicable Controls"],
)


class ApplicableControlCreate(BaseModel):
    control_id: int


def _get_process(db: Session, user: User, process_id: int) -> Process:
    process = (
        db.query(Process)
        .filter(
            and_(
                Process.id == process_id,
                Process.tenant_id == user.tenant_id,
            )
        )
        .first()
    )

    if not process:
        raise HTTPException(
            status_code=404,
            detail="Process not found",
        )

    return process


def _get_control(db: Session, control_id: int) -> Control:
    control = (
        db.query(Control)
        .filter(Control.id == control_id)
        .first()
    )

    if not control:
        raise HTTPException(
            status_code=404,
            detail="Control not found",
        )

    return control


def _serialize(row: ProcessApplicableControl) -> dict:
    control = row.control

    return {
        "id": row.id,
        "process_id": row.process_id,
        "control_id": row.control_id,
        "control_code": control.code if control else None,
        "control_title": control.title if control else None,
        "control_description": control.description if control else None,
        "created_by_user_id": row.created_by_user_id,
        "created_at": row.created_at,
    }


@router.get("/{process_id}/applicable-controls")
def list_applicable_controls(
    process_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_process(db, user, process_id)

    rows = (
        db.query(ProcessApplicableControl)
        .filter(
            and_(
                ProcessApplicableControl.tenant_id == user.tenant_id,
                ProcessApplicableControl.process_id == process_id,
            )
        )
        .order_by(ProcessApplicableControl.id.asc())
        .all()
    )

    return [_serialize(row) for row in rows]


@router.post("/{process_id}/applicable-controls", status_code=201)
def add_applicable_control(
    process_id: int,
    payload: ApplicableControlCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_process(db, user, process_id)
    _get_control(db, payload.control_id)

    existing = (
        db.query(ProcessApplicableControl)
        .filter(
            and_(
                ProcessApplicableControl.tenant_id == user.tenant_id,
                ProcessApplicableControl.process_id == process_id,
                ProcessApplicableControl.control_id == payload.control_id,
            )
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Control is already applicable to this process",
        )

    row = ProcessApplicableControl(
        tenant_id=user.tenant_id,
        process_id=process_id,
        control_id=payload.control_id,
        created_by_user_id=user.id,
    )

    db.add(row)
    db.commit()
    db.refresh(row)

    return _serialize(row)


@router.delete("/{process_id}/applicable-controls/{control_id}")
def remove_applicable_control(
    process_id: int,
    control_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_process(db, user, process_id)

    row = (
        db.query(ProcessApplicableControl)
        .filter(
            and_(
                ProcessApplicableControl.tenant_id == user.tenant_id,
                ProcessApplicableControl.process_id == process_id,
                ProcessApplicableControl.control_id == control_id,
            )
        )
        .first()
    )

    if not row:
        raise HTTPException(
            status_code=404,
            detail="Applicable control not found",
        )

    db.delete(row)
    db.commit()

    return {
        "status": "removed",
        "process_id": process_id,
        "control_id": control_id,
    }
