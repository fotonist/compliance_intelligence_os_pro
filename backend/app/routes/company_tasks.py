from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user

from app.models.compliance_tasks import ComplianceTask
from app.models.evidences import Evidence
from app.models.task_evidence_link import TaskEvidenceLink
from app.models.user import User

from app.schemas.compliance_task_schema import (
    ComplianceTaskCreate,
    ComplianceTaskListResponse,
    ComplianceTaskResponse,
    ComplianceTaskUpdate,
    TaskAssignRequest,
    TaskEvidenceRequirementCreate,
    TaskEvidenceCreate,
    TaskEvidenceRequirementResponse,
    TaskEvidenceRequirementUpdate,
    TaskTransitionRequest,
)

from app.services.task_service import TaskService


router = APIRouter(
    prefix="/company/tasks",
    tags=["company_tasks"],
)


# ==========================================================
# LIST TASKS
# ==========================================================

@router.get(
    "",
    response_model=ComplianceTaskListResponse,
)
def list_tasks(
    process_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tasks = TaskService.list_tasks(
        db=db,
        user=current_user,
        process_id=process_id,
    )

    return {
        "total": len(tasks),
        "tasks": tasks,
    }


# ==========================================================
# MY TASKS
# ==========================================================

@router.get(
    "/my",
    response_model=ComplianceTaskListResponse,
)
def get_my_tasks(
    process_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tasks = TaskService.list_tasks(
        db=db,
        user=current_user,
        process_id=process_id,
    )

    # "my" means tasks assigned to the current user.
    tasks = [
        task
        for task in tasks
        if task.assignee_user_id == current_user.id
    ]

    return {
        "total": len(tasks),
        "tasks": tasks,
    }


# ==========================================================
# TASKS BY PROCESS
# ==========================================================

@router.get(
    "/process/{process_id}",
    response_model=ComplianceTaskListResponse,
)
def get_tasks_by_process(
    process_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tasks = TaskService.list_tasks(
        db=db,
        user=current_user,
        process_id=process_id,
    )

    return {
        "total": len(tasks),
        "tasks": tasks,
    }


# ==========================================================
# CREATE TASK
# ==========================================================

@router.post(
    "",
    response_model=ComplianceTaskResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_task(
    payload: ComplianceTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return TaskService.create_task(
        db=db,
        user=current_user,
        payload=payload,
    )


# ==========================================================
# GET TASK
# ==========================================================

@router.get(
    "/{task_id}",
    response_model=ComplianceTaskResponse,
)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return TaskService.get_task(
        db=db,
        user=current_user,
        task_id=task_id,
    )


# ==========================================================
# UPDATE TASK METADATA
# ==========================================================

@router.put(
    "/{task_id}",
    response_model=ComplianceTaskResponse,
)
def update_task(
    task_id: int,
    payload: ComplianceTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return TaskService.update_task(
        db=db,
        user=current_user,
        task_id=task_id,
        payload=payload,
    )


# ==========================================================
# ASSIGN TASK
# ==========================================================

@router.post(
    "/{task_id}/assign",
    response_model=ComplianceTaskResponse,
)
def assign_task(
    task_id: int,
    payload: TaskAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return TaskService.assign_task(
        db=db,
        user=current_user,
        task_id=task_id,
        payload=payload,
    )


# ==========================================================
# TRANSITION TASK
# ==========================================================

@router.post(
    "/{task_id}/transition",
    response_model=ComplianceTaskResponse,
)
def transition_task(
    task_id: int,
    payload: TaskTransitionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return TaskService.transition_task(
        db=db,
        user=current_user,
        task_id=task_id,
        new_status=payload.status,
    )


# ==========================================================
# CANCEL TASK
# ==========================================================

@router.post(
    "/{task_id}/cancel",
    response_model=ComplianceTaskResponse,
)
def cancel_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return TaskService.cancel_task(
        db=db,
        user=current_user,
        task_id=task_id,
    )


# ==========================================================
# CLOSE TASK
# ==========================================================

@router.post(
    "/{task_id}/close",
    response_model=ComplianceTaskResponse,
)
def close_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return TaskService.close_task(
        db=db,
        user=current_user,
        task_id=task_id,
    )


# ==========================================================
# GET TASK EVIDENCE
# ==========================================================

@router.get(
    "/{task_id}/evidence",
)
def get_task_evidence(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = TaskService.get_task(
        db=db,
        user=current_user,
        task_id=task_id,
    )

    links = (
        db.query(TaskEvidenceLink)
        .filter(
            TaskEvidenceLink.task_id == task.id,
            TaskEvidenceLink.tenant_id == current_user.tenant_id,
        )
        .all()
    )

    evidence_ids = [
        link.evidence_id
        for link in links
    ]

    if not evidence_ids:
        return {
            "total": 0,
            "evidences": [],
        }

    evidences = (
        db.query(Evidence)
        .filter(
            Evidence.id.in_(evidence_ids),
            Evidence.tenant_id == current_user.tenant_id,
            Evidence.is_deleted.is_(False),
        )
        .order_by(Evidence.created_at.desc())
        .all()
    )

    return {
        "total": len(evidences),
        "evidences": evidences,
    }


# ==========================================================
# CREATE TASK EVIDENCE
# ==========================================================

@router.post(
    "/{task_id}/evidence",
)
def create_task_evidence(
    task_id: int,
    payload: TaskEvidenceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = TaskService.get_task(
        db=db,
        user=current_user,
        task_id=task_id,
    )

    if not task.control_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task must have a control before evidence can be created.",
        )

    evidence = Evidence(
        tenant_id=current_user.tenant_id,
        control_id=task.control_id,
        title=payload.title,
        description=payload.description,
        regulation=payload.regulation,
        source_url=payload.source_url,
        status="Uploaded",
        is_deleted=False,
    )

    db.add(evidence)
    db.flush()

    link = TaskEvidenceLink(
        tenant_id=current_user.tenant_id,
        task_id=task.id,
        evidence_id=evidence.id,
    )

    db.add(link)

    db.commit()
    db.refresh(evidence)

    return {
        "success": True,
        "task_id": task.id,
        "evidence_id": evidence.id,
    }


# ==========================================================
# EVIDENCE REQUIREMENTS
# ==========================================================

@router.get(
    "/{task_id}/evidence-requirements",
    response_model=list[TaskEvidenceRequirementResponse],
)
def get_evidence_requirements(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return TaskService.get_evidence_requirements(
        db=db,
        user=current_user,
        task_id=task_id,
    )


@router.post(
    "/{task_id}/evidence-requirements",
    response_model=TaskEvidenceRequirementResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_evidence_requirement(
    task_id: int,
    payload: TaskEvidenceRequirementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return TaskService.add_evidence_requirement(
        db=db,
        user=current_user,
        task_id=task_id,
        payload=payload,
    )


@router.put(
    "/{task_id}/evidence-requirements/{requirement_id}",
    response_model=TaskEvidenceRequirementResponse,
)
def update_evidence_requirement(
    task_id: int,
    requirement_id: int,
    payload: TaskEvidenceRequirementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return TaskService.update_evidence_requirement(
        db=db,
        user=current_user,
        task_id=task_id,
        requirement_id=requirement_id,
        payload=payload,
    )

