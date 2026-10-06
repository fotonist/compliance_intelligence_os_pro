from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.compliance_tasks import ComplianceTask
from app.models.evidence_files import EvidenceFile
from app.models.user import User
from app.models.user_role import UserRole
from app.models.role_permission import RolePermission
from app.models.permission import Permission
from app.services.notification_events import (
    NotificationCategory,
    NotificationEvent,
    NotificationEventType,
)
from app.services.notification_service import NotificationManager


logger = logging.getLogger("notification_deadline_scanner")


_TERMINAL_TASK_STATUSES = {
    "DONE",
    "COMPLETED",
    "CANCELLED",
    "CANCELED",
    "CLOSED",
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _resolve_evidence_reviewers(
    db: Session,
    *,
    tenant_id: int,
    exclude_user_id: int | None = None,
) -> list[int]:
    query = (
        db.query(User.id)
        .join(
            UserRole,
            UserRole.user_id == User.id,
        )
        .join(
            RolePermission,
            RolePermission.role_id == UserRole.role_id,
        )
        .join(
            Permission,
            Permission.id == RolePermission.permission_id,
        )
        .filter(
            User.tenant_id == tenant_id,
            User.is_active.is_(True),
            User.is_locked.is_(False),
            Permission.code == "evidence.approve",
        )
        .distinct()
    )

    if exclude_user_id is not None:
        query = query.filter(
            User.id != exclude_user_id
        )

    return [
        int(row[0])
        for row in query.order_by(User.id.asc()).all()
    ]


def _scan_overdue_tasks(
    db: Session,
    *,
    now: datetime,
) -> int:
    tasks = (
        db.query(ComplianceTask)
        .join(
            User,
            User.id == ComplianceTask.assignee_user_id,
        )
        .filter(
            ComplianceTask.assignee_user_id.isnot(None),
            ComplianceTask.due_date < now,
            ~ComplianceTask.status.in_(
                _TERMINAL_TASK_STATUSES
            ),
            User.tenant_id == ComplianceTask.tenant_id,
            User.is_active.is_(True),
            User.is_locked.is_(False),
        )
        .order_by(ComplianceTask.id.asc())
        .all()
    )

    emitted = 0

    for task in tasks:
        recipient_user_id = int(task.assignee_user_id)

        NotificationManager.emit(
            db,
            NotificationEvent(
                event_type=NotificationEventType.TASK_OVERDUE,
                category=NotificationCategory.TASK,
                tenant_id=task.tenant_id,
                actor_user_id=None,
                entity_type="COMPLIANCE_TASK",
                entity_id=task.id,
                title="Compliance task overdue",
                message=(
                    f"Compliance task {task.id} is overdue."
                ),
                payload={
                    "severity": "WARNING",
                },
            ),
            recipient_user_id=recipient_user_id,
            idempotency_key=(
                f"task-overdue:{task.id}:"
                f"{recipient_user_id}:"
                f"{task.due_date.isoformat()}"
            ),
        )

        emitted += 1

    return emitted


def _scan_overdue_evidence_reviews(
    db: Session,
    *,
    now: datetime,
) -> int:
    files = (
        db.query(EvidenceFile)
        .filter(
            EvidenceFile.status == "PendingApproval",
            EvidenceFile.review_due_at.isnot(None),
            EvidenceFile.review_due_at < now,
        )
        .order_by(EvidenceFile.id.asc())
        .all()
    )

    emitted = 0

    for evidence_file in files:
        reviewer_ids = _resolve_evidence_reviewers(
            db,
            tenant_id=evidence_file.tenant_id,
            exclude_user_id=evidence_file.submitted_by,
        )

        for reviewer_user_id in reviewer_ids:
            NotificationManager.emit(
                db,
                NotificationEvent(
                    event_type=(
                        NotificationEventType
                        .EVIDENCE_REVIEW_OVERDUE
                    ),
                    category=NotificationCategory.EVIDENCE,
                    tenant_id=evidence_file.tenant_id,
                    actor_user_id=None,
                    entity_type="EVIDENCE_FILE",
                    entity_id=evidence_file.id,
                    title="Evidence review overdue",
                    message=(
                        f"Evidence file version "
                        f"{evidence_file.version} "
                        "is overdue for review."
                    ),
                    payload={
                        "severity": "WARNING",
                    },
                ),
                recipient_user_id=reviewer_user_id,
                idempotency_key=(
                    f"evidence-review-overdue:"
                    f"{evidence_file.id}:"
                    f"{reviewer_user_id}:"
                    f"{evidence_file.version}:"
                    f"{evidence_file.review_due_at.isoformat()}"
                ),
            )

            emitted += 1

    return emitted


def scan_overdue_notifications(
    db: Session,
    *,
    now: datetime | None = None,
) -> int:
    current_time = now or _utcnow()

    task_count = _scan_overdue_tasks(
        db,
        now=current_time,
    )

    evidence_count = _scan_overdue_evidence_reviews(
        db,
        now=current_time,
    )

    db.commit()

    total = task_count + evidence_count

    if total:
        logger.info(
            "Generated %s overdue notifications "
            "(tasks=%s, evidence=%s).",
            total,
            task_count,
            evidence_count,
        )

    return total