from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.compliance_task import ComplianceTask
from app.services.jira_client import JiraClient
from app.services.clickup_client import ClickUpClient


router = APIRouter(prefix="/company/tasks", tags=["External Sync"])


@router.post("/{task_id}/sync/jira")
def sync_task_to_jira(
    task_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    task = db.query(ComplianceTask).filter_by(
        id=task_id,
        tenant_id=user.tenant_id,
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return JiraClient.sync_task(task, db)


@router.post("/{task_id}/sync/clickup")
def sync_task_to_clickup(
    task_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    task = db.query(ComplianceTask).filter_by(
        id=task_id,
        tenant_id=user.tenant_id,
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return ClickUpClient.sync_task(task, db)