from __future__ import annotations

from datetime import datetime
from typing import Any, Iterable, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.compliance_tasks import ComplianceTask
from app.models.controls import Control
from app.models.evidences import Evidence
from app.models.process import Process
from app.models.task_checklist_item import TaskChecklistItem
from app.models.task_evidence_link import TaskEvidenceLink
from app.models.task_evidence_requirement import TaskEvidenceRequirement
from app.models.user import User

from app.schemas.compliance_task_schema import (
    ComplianceTaskCreate,
    ComplianceTaskUpdate,
    TaskAssignRequest,
    TaskEvidenceRequirementCreate,
    TaskEvidenceRequirementUpdate,
)

from app.services.task_authorization import (
    TASK_PERMISSIONS,
    require_assignee_access,
    require_process_scope,
    require_task_access,
    require_task_permission_and_access,
    require_task_permission_for_create,
)


TASK_STATUS_TRANSITIONS = {
    "OPEN": {"IN_PROGRESS", "CANCELLED"},
    "IN_PROGRESS": {"BLOCKED", "UNDER_REVIEW", "CANCELLED"},
    "BLOCKED": {"IN_PROGRESS", "CANCELLED"},
    "UNDER_REVIEW": {"IN_PROGRESS", "READY_TO_CLOSE"},
    "READY_TO_CLOSE": {"DONE"},
    "DONE": set(),
    "CANCELLED": set(),
}


class TaskService:
    """
    Canonical business service for ComplianceTask.

    Route -> Authorization -> TaskService -> ORM/DB
    """

    # ==========================================================
    # Internal helpers
    # ==========================================================

    @staticmethod
    def _not_found(detail: str = "Task not found") -> None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
        )

    @staticmethod
    def _bad_request(detail: str) -> None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        )

    @staticmethod
    def _get_task(
        db: Session,
        task_id: int,
        user: User,
    ) -> ComplianceTask:
        task = (
            db.query(ComplianceTask)
            .filter(
                ComplianceTask.id == task_id,
                ComplianceTask.tenant_id == user.tenant_id,
            )
            .first()
        )

        if not task:
            TaskService._not_found()

        require_task_access(db, user, task)
        return task

    @staticmethod
    def _get_process(
        db: Session,
        process_id: int,
        user: User,
    ) -> Process:
        process = (
            db.query(Process)
            .filter(
                Process.id == process_id,
                Process.tenant_id == user.tenant_id,
            )
            .first()
        )

        if not process:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Process not found",
            )

        require_process_scope(process.id, user, db)
        return process

    @staticmethod
    def _validate_control(
        db: Session,
        control_id: Optional[int],
    ) -> Optional[Control]:
        if control_id is None:
            return None

        control = (
            db.query(Control)
            .filter(Control.id == control_id)
            .first()
        )

        if not control:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Control not found",
            )

        return control

    @staticmethod
    def _normalize_status(value: str) -> str:
        return str(value or "").strip().upper()

    @staticmethod
    def _approved_evidence_count(
        db: Session,
        task_id: int,
    ) -> int:
        """
        Counts approved evidences linked to the task.

        Evidence approval remains owned by the Evidence domain.
        TaskService only consumes the approved state.
        """

        evidences = (
            db.query(Evidence)
            .join(
                TaskEvidenceLink,
                TaskEvidenceLink.evidence_id == Evidence.id,
            )
            .filter(
                TaskEvidenceLink.task_id == task_id,
            )
            .all()
        )

        count = 0

        for evidence in evidences:
            approval_status = str(
                getattr(evidence, "approval_status", "") or ""
            ).upper()

            evidence_status = str(
                getattr(evidence, "status", "") or ""
            ).upper()

            if (
                approval_status == "APPROVED"
                or evidence_status == "APPROVED"
            ):
                count += 1

        return count

    @staticmethod
    def _required_evidence_count(
        db: Session,
        task_id: int,
    ) -> int:
        return (
            db.query(TaskEvidenceRequirement)
            .filter(
                TaskEvidenceRequirement.task_id == task_id,
                TaskEvidenceRequirement.required.is_(True),
                TaskEvidenceRequirement.status != "CANCELLED",
            )
            .count()
        )

    @staticmethod
    def _required_checklist_complete(
        db: Session,
        task_id: int,
    ) -> bool:
        required_items = (
            db.query(TaskChecklistItem)
            .filter(
                TaskChecklistItem.task_id == task_id,
                TaskChecklistItem.required.is_(True),
            )
            .all()
        )

        return all(
            bool(item.completed)
            for item in required_items
        )

    @staticmethod
    def _validate_close_gate(
        db: Session,
        task: ComplianceTask,
    ) -> None:
        required_evidence = TaskService._required_evidence_count(
            db,
            task.id,
        )

        approved_evidence = TaskService._approved_evidence_count(
            db,
            task.id,
        )

        if approved_evidence < required_evidence:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Task cannot be closed: required evidence is not "
                    "fully approved."
                ),
            )

        if not TaskService._required_checklist_complete(
            db,
            task.id,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Task cannot be closed: required checklist items "
                    "are incomplete."
                ),
            )

    # ==========================================================
    # LIST
    # ==========================================================

    @staticmethod
    def list_tasks(
        db: Session,
        user: User,
        process_id: Optional[int] = None,
    ) -> list[ComplianceTask]:
        from app.services.task_authorization import (
            _has_task_permission,
            user_has_process_scope,
        )

        if not _has_task_permission(
            db,
            user,
            TASK_PERMISSIONS["view"],
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Missing permission: task.view",
            )

        query = (
            db.query(ComplianceTask)
            .filter(
                ComplianceTask.tenant_id == user.tenant_id,
            )
        )

        if process_id is not None:
            require_process_scope(process_id, user, db)
            query = query.filter(
                ComplianceTask.process_id == process_id
            )
        else:
            # Only expose tasks belonging to processes within
            # the user's effective scope.
            tasks = query.order_by(
                ComplianceTask.created_at.desc()
            ).all()

            return [
                task
                for task in tasks
                if user_has_process_scope(
                    db,
                    user,
                    int(task.process_id),
                    int(user.tenant_id),
                )
            ]

        return query.order_by(
            ComplianceTask.created_at.desc()
        ).all()

    # ==========================================================
    # GET
    # ==========================================================

    @staticmethod
    def get_task(
        db: Session,
        user: User,
        task_id: int,
    ) -> ComplianceTask:
        from app.services.task_authorization import _has_task_permission

        if not _has_task_permission(
            db,
            user,
            TASK_PERMISSIONS["view"],
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Missing permission: task.view",
            )

        return TaskService._get_task(
            db,
            task_id,
            user,
        )

    # ==========================================================
    # CREATE
    # ==========================================================

    @staticmethod
    def create_task(
        db: Session,
        user: User,
        payload: ComplianceTaskCreate,
    ) -> ComplianceTask:
        require_task_permission_for_create(
            TASK_PERMISSIONS["create"],
            db,
            user,
            payload.process_id,
        )

        process = TaskService._get_process(
            db,
            payload.process_id,
            user,
        )

        control = TaskService._validate_control(
            db,
            payload.control_id,
        )

        if payload.assignee_user_id is not None:
            assignee = (
                db.query(User)
                .filter(
                    User.id == payload.assignee_user_id,
                    User.tenant_id == user.tenant_id,
                    User.is_active.is_(True),
                    User.is_locked.is_(False),
                )
                .first()
            )

            if not assignee:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Assignee not found or inactive",
                )

            require_assignee_access(
                db,
                user,
                assignee,
                process.id,
            )

        task = ComplianceTask(
            tenant_id=user.tenant_id,
            process_id=process.id,
            control_id=control.id if control else None,
            task_type=payload.task_type,
            title=payload.title,
            description=payload.description,
            priority_score=payload.priority_score,
            owner_role=payload.owner_role,
            assignee_user_id=payload.assignee_user_id,
            created_by_user_id=user.id,
            due_date=payload.due_date,
            status="OPEN",
            source_type="manual",
        )

        db.add(task)
        db.flush()

        db.commit()
        db.refresh(task)

        return task

    # ==========================================================
    # UPDATE
    # ==========================================================

    @staticmethod
    def update_task(
        db: Session,
        user: User,
        task_id: int,
        payload: ComplianceTaskUpdate,
    ) -> ComplianceTask:
        task = TaskService._get_task(
            db,
            task_id,
            user,
        )

        require_task_permission_and_access(
            TASK_PERMISSIONS["edit"],
            db,
            user,
            task,
        )

        values = payload.model_dump(
            exclude_unset=True,
        )

        # Status deliberately cannot be updated here.
        values.pop("status", None)

        if "control_id" in values:
            control = TaskService._validate_control(
                db,
                values["control_id"],
            )

            values["control_id"] = (
                control.id if control else None
            )

        if "assignee_user_id" in values:
            assignee_id = values["assignee_user_id"]

            if assignee_id is None:
                values["assignee_user_id"] = None
            else:
                assignee = (
                    db.query(User)
                    .filter(
                        User.id == assignee_id,
                        User.tenant_id == user.tenant_id,
                        User.is_active.is_(True),
                        User.is_locked.is_(False),
                    )
                    .first()
                )

                if not assignee:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Assignee not found or inactive",
                    )

                require_assignee_access(
                    db,
                    user,
                    assignee,
                    task.process_id,
                )

        for field, value in values.items():
            setattr(task, field, value)

        db.commit()
        db.refresh(task)

        return task

    # ==========================================================
    # ASSIGN
    # ==========================================================

    @staticmethod
    def assign_task(
        db: Session,
        user: User,
        task_id: int,
        payload: TaskAssignRequest,
    ) -> ComplianceTask:
        task = TaskService._get_task(
            db,
            task_id,
            user,
        )

        require_task_permission_and_access(
            TASK_PERMISSIONS["assign"],
            db,
            user,
            task,
        )

        assignee = (
            db.query(User)
            .filter(
                User.id == payload.assignee_user_id,
                User.tenant_id == user.tenant_id,
                User.is_active.is_(True),
                User.is_locked.is_(False),
            )
            .first()
        )

        if not assignee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assignee not found or inactive",
            )

        require_assignee_access(
            db,
            user,
            assignee,
            task.process_id,
        )

        task.assignee_user_id = assignee.id

        db.commit()
        db.refresh(task)

        return task

    # ==========================================================
    # TRANSITION
    # ==========================================================

    @staticmethod
    def transition_task(
        db: Session,
        user: User,
        task_id: int,
        new_status: str,
    ) -> ComplianceTask:
        task = TaskService._get_task(
            db,
            task_id,
            user,
        )

        require_task_permission_and_access(
            TASK_PERMISSIONS["transition"],
            db,
            user,
            task,
        )

        current = TaskService._normalize_status(
            task.status
        )

        target = TaskService._normalize_status(
            new_status
        )

        allowed = TASK_STATUS_TRANSITIONS.get(
            current,
            set(),
        )

        if target not in allowed:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Invalid task status transition: "
                    f"{current} -> {target}"
                ),
            )

        task.status = target

        db.commit()
        db.refresh(task)

        return task

    # ==========================================================
    # CANCEL
    # ==========================================================

    @staticmethod
    def cancel_task(
        db: Session,
        user: User,
        task_id: int,
    ) -> ComplianceTask:
        task = TaskService._get_task(
            db,
            task_id,
            user,
        )

        require_task_permission_and_access(
            TASK_PERMISSIONS["cancel"],
            db,
            user,
            task,
        )

        current = TaskService._normalize_status(
            task.status
        )

        if "CANCELLED" not in TASK_STATUS_TRANSITIONS.get(
            current,
            set(),
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Task cannot be cancelled from {current}",
            )

        task.status = "CANCELLED"

        db.commit()
        db.refresh(task)

        return task

    # ==========================================================
    # CLOSE
    # ==========================================================

    @staticmethod
    def close_task(
        db: Session,
        user: User,
        task_id: int,
    ) -> ComplianceTask:
        task = TaskService._get_task(
            db,
            task_id,
            user,
        )

        require_task_permission_and_access(
            TASK_PERMISSIONS["close"],
            db,
            user,
            task,
        )

        current = TaskService._normalize_status(
            task.status
        )

        if current != "READY_TO_CLOSE":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Task must be READY_TO_CLOSE before it can "
                    "be completed."
                ),
            )

        TaskService._validate_close_gate(
            db,
            task,
        )

        task.status = "DONE"

        db.commit()
        db.refresh(task)

        return task

    # ==========================================================
    # EVIDENCE REQUIREMENTS
    # ==========================================================

    @staticmethod
    def get_evidence_requirements(
        db: Session,
        user: User,
        task_id: int,
    ) -> list[TaskEvidenceRequirement]:
        task = TaskService._get_task(
            db,
            task_id,
            user,
        )

        require_task_permission_and_access(
            TASK_PERMISSIONS["view"],
            db,
            user,
            task,
        )

        return (
            db.query(TaskEvidenceRequirement)
            .filter(
                TaskEvidenceRequirement.task_id == task.id,
                TaskEvidenceRequirement.tenant_id == user.tenant_id,
            )
            .order_by(
                TaskEvidenceRequirement.created_at.asc()
            )
            .all()
        )

    @staticmethod
    def add_evidence_requirement(
        db: Session,
        user: User,
        task_id: int,
        payload: TaskEvidenceRequirementCreate,
    ) -> TaskEvidenceRequirement:
        task = TaskService._get_task(
            db,
            task_id,
            user,
        )

        require_task_permission_and_access(
            TASK_PERMISSIONS["edit"],
            db,
            user,
            task,
        )

        name = payload.name.strip()

        if not name:
            TaskService._bad_request(
                "Evidence requirement name cannot be empty"
            )

        existing = (
            db.query(TaskEvidenceRequirement)
            .filter(
                TaskEvidenceRequirement.task_id == task.id,
                TaskEvidenceRequirement.tenant_id == user.tenant_id,
                TaskEvidenceRequirement.name == name,
            )
            .first()
        )

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Evidence requirement already exists",
            )

        requirement = TaskEvidenceRequirement(
            tenant_id=user.tenant_id,
            task_id=task.id,
            name=name,
            description=payload.description,
            evidence_type=payload.evidence_type,
            required=payload.required,
            status="OPEN",
        )

        db.add(requirement)
        db.commit()
        db.refresh(requirement)

        return requirement

    @staticmethod
    def update_evidence_requirement(
        db: Session,
        user: User,
        task_id: int,
        requirement_id: int,
        payload: TaskEvidenceRequirementUpdate,
    ) -> TaskEvidenceRequirement:
        task = TaskService._get_task(
            db,
            task_id,
            user,
        )

        require_task_permission_and_access(
            TASK_PERMISSIONS["edit"],
            db,
            user,
            task,
        )

        requirement = (
            db.query(TaskEvidenceRequirement)
            .filter(
                TaskEvidenceRequirement.id == requirement_id,
                TaskEvidenceRequirement.task_id == task.id,
                TaskEvidenceRequirement.tenant_id == user.tenant_id,
            )
            .first()
        )

        if not requirement:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Evidence requirement not found",
            )

        values = payload.model_dump(
            exclude_unset=True,
        )

        if "name" in values:
            name = str(values["name"]).strip()

            if not name:
                TaskService._bad_request(
                    "Evidence requirement name cannot be empty"
                )

            duplicate = (
                db.query(TaskEvidenceRequirement)
                .filter(
                    TaskEvidenceRequirement.task_id == task.id,
                    TaskEvidenceRequirement.name == name,
                    TaskEvidenceRequirement.id != requirement.id,
                )
                .first()
            )

            if duplicate:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Evidence requirement already exists",
                )

            values["name"] = name

        for field, value in values.items():
            setattr(requirement, field, value)

        db.commit()
        db.refresh(requirement)

        return requirement
