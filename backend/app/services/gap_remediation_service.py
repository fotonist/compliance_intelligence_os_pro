from sqlalchemy import text
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.compliance_tasks import ComplianceTask
from app.services.gap_intelligence_service import GapIntelligenceService


class GapRemediationService:
    ACTIVE_STATUSES = (
        "OPEN",
        "IN_PROGRESS",
        "BLOCKED",
        "UNDER_REVIEW",
        "READY_TO_CLOSE",
    )

    @classmethod
    def start_control_gap(
        cls,
        db: Session,
        *,
        tenant_id: int,
        user_id: int,
        standard_id: int,
        standard_version_id: int,
        adoption_id: int,
        control_id: int,
        priority_score: int,
        owner_role: str,
        assignee_user_id: int | None,
        due_date,
    ):
        intelligence = GapIntelligenceService.get(
            db,
            tenant_id=tenant_id,
        )

        framework = next(
            (
                item
                for item in intelligence.get("frameworks", [])
                if item.get("framework_type") == "CONTROL_BASED"
                and int(item.get("standard_id") or 0) == standard_id
                and int(item.get("standard_version_id") or 0)
                    == standard_version_id
                and int(item.get("adoption_id") or 0) == adoption_id
            ),
            None,
        )

        if framework is None:
            raise HTTPException(
                status_code=404,
                detail="Active control framework not found.",
            )

        gap_item = next(
            (
                item
                for item in (
                    framework.get("control_gap", {}).get("items", [])
                )
                if int(item.get("control_id") or 0) == control_id
            ),
            None,
        )

        if gap_item is None:
            raise HTTPException(
                status_code=409,
                detail="Control is not currently a canonical gap.",
            )

        existing = (
            db.query(ComplianceTask)
            .filter(
                ComplianceTask.tenant_id == tenant_id,
                ComplianceTask.task_type == "REMEDIATION",
                ComplianceTask.source_type == "CONTROL_GAP",
                ComplianceTask.source_id == control_id,
                ComplianceTask.control_id == control_id,
                ComplianceTask.status.in_(cls.ACTIVE_STATUSES),
            )
            .order_by(ComplianceTask.id.desc())
            .first()
        )

        if existing is not None:
            return {
                "created": False,
                "task_id": existing.id,
                "status": existing.status,
                "action": "VIEW_REMEDIATION",
                "process_id": existing.process_id,
            }

        process_rows = db.execute(
            text(
                """
                SELECT DISTINCT pac.process_id
                FROM process_applicable_controls pac
                JOIN processes p
                  ON p.id = pac.process_id
                 AND p.tenant_id = :tenant_id
                WHERE pac.tenant_id = :tenant_id
                  AND pac.control_id = :control_id
                ORDER BY pac.process_id
                """
            ),
            {
                "tenant_id": tenant_id,
                "control_id": control_id,
            },
        ).scalars().all()

        process_id = (
            int(process_rows[0])
            if len(process_rows) == 1
            else None
        )

        if assignee_user_id is not None:
            assignee = db.execute(
                text(
                    """
                    SELECT id
                    FROM users
                    WHERE id = :user_id
                      AND tenant_id = :tenant_id
                      AND is_active IS TRUE
                      AND is_locked IS FALSE
                    """
                ),
                {
                    "user_id": assignee_user_id,
                    "tenant_id": tenant_id,
                },
            ).scalar_one_or_none()

            if assignee is None:
                raise HTTPException(
                    status_code=422,
                    detail="Assignee is not an active tenant user.",
                )

        code = gap_item.get("control_code") or str(control_id)
        title = gap_item.get("control_title") or "Control gap"
        coverage_status = (
            gap_item.get("coverage_status") or "UNKNOWN"
        )

        task = ComplianceTask(
            tenant_id=tenant_id,
            process_id=process_id,
            control_id=control_id,
            task_type="REMEDIATION",
            title=f"Remediate {code}: {title}",
            description=(
                "Created from canonical Gap Intelligence. "
                f"Coverage status: {coverage_status}."
            ),
            priority_score=priority_score,
            owner_role=owner_role,
            assignee_user_id=assignee_user_id,
            created_by_user_id=user_id,
            due_date=due_date,
            status="OPEN",
            source_type="CONTROL_GAP",
            source_id=control_id,
        )

        db.add(task)
        db.flush()

        return {
            "created": True,
            "task_id": task.id,
            "status": task.status,
            "action": "VIEW_REMEDIATION",
            "process_id": task.process_id,
        }
