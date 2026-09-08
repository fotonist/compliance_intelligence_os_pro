from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.actions import Action
from app.models.audit_finding_records import AuditFindingRecord
from app.models.compliance_tasks import ComplianceTask
from app.models.user import User
from app.services.task_service import TaskService


class RemediationService:
    """
    Read-only aggregation layer for the Remediation Center.

    Source domains retain ownership of their own lifecycle and
    authorization rules.
    """

    COMPLETED_FINDING_STATUSES = {"CLOSED"}
    COMPLETED_ACTION_STATUSES = {"CLOSED"}
    COMPLETED_TASK_STATUSES = {"DONE", "CANCELLED"}

    REVIEW_FINDING_STATUSES = {
        "SUBMITTED_FOR_REVIEW",
        "READY_FOR_VERIFICATION",
    }
    REVIEW_ACTION_STATUSES = {
        "SUBMITTED_FOR_REVIEW",
        "VERIFIED",
    }
    REVIEW_TASK_STATUSES = {
        "UNDER_REVIEW",
        "READY_TO_CLOSE",
    }

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    @staticmethod
    def _due_flags(due_date: Optional[datetime]) -> tuple[bool, bool]:
        if due_date is None:
            return False, False

        current = RemediationService._now()

        if isinstance(due_date, datetime):
            if due_date.tzinfo is None:
                due_date = due_date.replace(tzinfo=timezone.utc)
        else:
            due_date = datetime.combine(
                due_date,
                datetime.min.time(),
                tzinfo=timezone.utc,
            )

        overdue = due_date < current
        due_soon = not overdue and due_date <= current + timedelta(days=7)

        return overdue, due_soon

    @staticmethod
    def _finding_items(
        db: Session,
        user: User,
    ) -> list[dict]:
        findings = (
            db.query(AuditFindingRecord)
            .filter(
                AuditFindingRecord.tenant_id == user.tenant_id,
            )
            .order_by(
                AuditFindingRecord.due_date.asc().nullslast(),
                AuditFindingRecord.id.desc(),
            )
            .all()
        )

        items: list[dict] = []

        for finding in findings:
            status_value = str(finding.status or "OPEN").upper()
            overdue, due_soon = RemediationService._due_flags(
                finding.due_date
            )

            owner = getattr(finding, "assigned_owner", None)
            manager = getattr(finding, "process_manager", None)

            owner_id = getattr(finding, "assigned_owner_id", None)
            owner_name = None

            if owner is not None:
                owner_name = (
                    getattr(owner, "full_name", None)
                    or getattr(owner, "name", None)
                    or getattr(owner, "email", None)
                )

            if owner_name is None:
                owner_name = getattr(finding, "owner", None)

            reviewer_id = getattr(finding, "process_manager_id", None)
            reviewer_name = None

            if manager is not None:
                reviewer_name = (
                    getattr(manager, "full_name", None)
                    or getattr(manager, "name", None)
                    or getattr(manager, "email", None)
                )

            severity = str(
                getattr(finding, "severity", "") or ""
            ).upper() or None

            items.append(
                {
                    "source": "AUDIT_FINDING",
                    "source_id": finding.id,
                    "title": finding.title or f"Finding #{finding.id}",
                    "description": finding.description,
                    "status": status_value,
                    "normalized_status": (
                        "COMPLETED"
                        if status_value in RemediationService.COMPLETED_FINDING_STATUSES
                        else "ACTIVE"
                    ),
                    "priority": severity,
                    "priority_score": None,
                    "severity": severity,
                    "owner_id": owner_id,
                    "owner_name": owner_name,
                    "reviewer_id": reviewer_id,
                    "reviewer_name": reviewer_name,
                    "process_id": finding.process_id,
                    "control_id": finding.control_id,
                    "due_date": finding.due_date,
                    "overdue": overdue,
                    "due_soon": due_soon,
                    "awaiting_review": (
                        status_value in RemediationService.REVIEW_FINDING_STATUSES
                    ),
                    "action_url": (
                        f"/audit/findings?finding_id={finding.id}"
                    ),
                }
            )

        return items

    @staticmethod
    def _action_items(
        db: Session,
        user: User,
    ) -> list[dict]:
        query = (
            db.query(Action)
            .join(
                User,
                Action.owner_id == User.id,
            )
            .filter(
                User.tenant_id == user.tenant_id,
            )
        )

        actions = query.order_by(
            Action.due_date.asc().nullslast(),
            Action.id.desc(),
        ).all()

        items: list[dict] = []

        for action in actions:
            status_value = str(action.status or "OPEN").upper()
            priority = str(
                getattr(action, "priority", "") or ""
            ).upper() or None

            overdue, due_soon = RemediationService._due_flags(
                action.due_date
            )

            owner = getattr(action, "assigned_to_user", None)

            if owner is None:
                owner = getattr(action, "owner", None)

            owner_id = getattr(
                action,
                "assigned_to_user_id",
                None,
            )

            if owner_id is None:
                owner_id = getattr(
                    action,
                    "owner_id",
                    None,
                )

            owner_name = None

            if owner is not None:
                owner_name = (
                    getattr(owner, "full_name", None)
                    or getattr(owner, "name", None)
                    or getattr(owner, "email", None)
                )

            reviewer = getattr(action, "reviewer", None)

            reviewer_id = getattr(
                action,
                "reviewer_user_id",
                None,
            )

            reviewer_name = None

            if reviewer is not None:
                reviewer_name = (
                    getattr(reviewer, "full_name", None)
                    or getattr(reviewer, "name", None)
                    or getattr(reviewer, "email", None)
                )

            items.append(
                {
                    "source": "ACTION",
                    "source_id": action.id,
                    "title": action.title or f"Action #{action.id}",
                    "description": action.description,
                    "status": status_value,
                    "normalized_status": (
                        "COMPLETED"
                        if status_value in RemediationService.COMPLETED_ACTION_STATUSES
                        else "ACTIVE"
                    ),
                    "priority": priority,
                    "priority_score": None,
                    "severity": None,
                    "owner_id": owner_id,
                    "owner_name": owner_name,
                    "reviewer_id": reviewer_id,
                    "reviewer_name": reviewer_name,
                    "process_id": None,
                    "control_id": None,
                    "due_date": action.due_date,
                    "overdue": overdue,
                    "due_soon": due_soon,
                    "awaiting_review": (
                        status_value in RemediationService.REVIEW_ACTION_STATUSES
                    ),
                    "action_url": "/audit/corrective-actions",
                }
            )

        return items

    @staticmethod
    def _task_items(
        db: Session,
        user: User,
    ) -> list[dict]:
        tasks = TaskService.list_tasks(
            db=db,
            user=user,
            process_id=None,
        )

        items: list[dict] = []

        for task in tasks:
            status_value = str(task.status or "OPEN").upper()
            overdue, due_soon = RemediationService._due_flags(
                task.due_date
            )

            assignee = getattr(task, "assignee", None)

            owner_name = None

            if assignee is not None:
                owner_name = (
                    getattr(assignee, "full_name", None)
                    or getattr(assignee, "name", None)
                    or getattr(assignee, "email", None)
                )

            priority_score = getattr(
                task,
                "priority_score",
                None,
            )

            priority = None

            if priority_score is not None:
                if priority_score >= 80:
                    priority = "CRITICAL"
                elif priority_score >= 60:
                    priority = "HIGH"
                elif priority_score >= 40:
                    priority = "MEDIUM"
                else:
                    priority = "LOW"

            items.append(
                {
                    "source": "TASK",
                    "source_id": task.id,
                    "title": task.title or f"Task #{task.id}",
                    "description": task.description,
                    "status": status_value,
                    "normalized_status": (
                        "COMPLETED"
                        if status_value in RemediationService.COMPLETED_TASK_STATUSES
                        else "ACTIVE"
                    ),
                    "priority": priority,
                    "priority_score": priority_score,
                    "severity": None,
                    "owner_id": task.assignee_user_id,
                    "owner_name": owner_name,
                    "reviewer_id": None,
                    "reviewer_name": None,
                    "process_id": task.process_id,
                    "control_id": task.control_id,
                    "due_date": task.due_date,
                    "overdue": overdue,
                    "due_soon": due_soon,
                    "awaiting_review": (
                        status_value in RemediationService.REVIEW_TASK_STATUSES
                    ),
                    "action_url": f"/company/tasks/{task.id}",
                }
            )

        return items

    @staticmethod
    def list(
        db: Session,
        user: User,
        source: Optional[str] = None,
        status_filter: Optional[str] = None,
    ) -> dict:
        normalized_source = (
            str(source).strip().upper()
            if source
            else None
        )

        allowed_sources = {
            None,
            "AUDIT_FINDING",
            "ACTION",
            "TASK",
        }

        if normalized_source not in allowed_sources:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid remediation source",
            )

        items: list[dict] = []

        if normalized_source in {None, "AUDIT_FINDING"}:
            items.extend(
                RemediationService._finding_items(
                    db,
                    user,
                )
            )

        if normalized_source in {None, "ACTION"}:
            items.extend(
                RemediationService._action_items(
                    db,
                    user,
                )
            )

        if normalized_source in {None, "TASK"}:
            items.extend(
                RemediationService._task_items(
                    db,
                    user,
                )
            )

        if status_filter:
            normalized_status = str(
                status_filter
            ).strip().upper()

            if normalized_status == "ACTIVE":
                items = [
                    item
                    for item in items
                    if item["normalized_status"] == "ACTIVE"
                ]
            elif normalized_status == "COMPLETED":
                items = [
                    item
                    for item in items
                    if item["normalized_status"] == "COMPLETED"
                ]
            else:
                items = [
                    item
                    for item in items
                    if item["status"] == normalized_status
                ]

        items.sort(
            key=lambda item: (
                not item["overdue"],
                not item["due_soon"],
                -(item["priority_score"] or 0),
                item["due_date"] is None,
                item["due_date"] or datetime.max.replace(
                    tzinfo=timezone.utc
                ),
                -item["source_id"],
            )
        )

        summary = {
            "total": len(items),
            "active": sum(
                item["normalized_status"] == "ACTIVE"
                for item in items
            ),
            "overdue": sum(
                item["overdue"]
                for item in items
            ),
            "due_soon": sum(
                item["due_soon"]
                for item in items
            ),
            "high_priority": sum(
                item["priority"] in {"HIGH", "CRITICAL"}
                or (item["priority_score"] or 0) >= 60
                for item in items
            ),
            "awaiting_review": sum(
                item["awaiting_review"]
                for item in items
            ),
            "completed": sum(
                item["normalized_status"] == "COMPLETED"
                for item in items
            ),
        }

        return {
            "summary": summary,
            "items": items,
        }

    @staticmethod
    def get(
        db: Session,
        user: User,
        source: str,
        source_id: int,
    ) -> dict:
        result = RemediationService.list(
            db=db,
            user=user,
            source=source,
        )

        for item in result["items"]:
            if item["source_id"] == source_id:
                return item

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Remediation item not found",
        )
