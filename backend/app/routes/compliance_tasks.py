from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.compliance_tasks import ComplianceTask
from app.schemas.compliance_task_schema import (
    ComplianceTaskCreate,
    ComplianceTaskResponse,
    ComplianceTaskListResponse,
)

router = APIRouter(prefix="/company/tasks", tags=["Company"])


@router.post("", response_model=ComplianceTaskResponse)
def create_task(
    payload: ComplianceTaskCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    task = ComplianceTask(
        tenant_id=user.tenant_id,
        process_id=payload.process_id,
        control_id=payload.control_id,
        priority_score=payload.priority_score,
        owner_role=payload.owner_role,
        due_date=payload.due_date,
        title=payload.title,
        description=payload.description,
    )

    db.add(task)
    db.commit()
    db.refresh(task)

    return task


@router.get("", response_model=ComplianceTaskListResponse)
def list_tasks(
    process_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(ComplianceTask).where(
        ComplianceTask.tenant_id == user.tenant_id
    )

    if process_id:
        stmt = stmt.where(ComplianceTask.process_id == process_id)

    stmt = stmt.order_by(ComplianceTask.priority_score.desc())

    rows = db.execute(stmt).scalars().all()

    return {
        "total": len(rows),
        "tasks": rows,
    }


@router.put("/{task_id}/status")
def update_task_status(
    task_id: int,
    status: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    task = db.execute(
        select(ComplianceTask).where(
            and_(
                ComplianceTask.id == task_id,
                ComplianceTask.tenant_id == user.tenant_id,
            )
        )
    ).scalar_one_or_none()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.status = status
    db.commit()

    return {"ok": True, "task_id": task_id, "new_status": status}