# backend/app/services/task_engine.py

from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from app.services.checklist_engine import ChecklistEngine
from app.models.compliance_task import ComplianceTask
from app.models.process import Process
from app.models.user import User
from app.services.audit_plan_engine import AuditPlanEngine


class TaskEngine:

    @staticmethod
    def create_tasks_from_process_gaps(
        process_id: int,
        db: Session,
        user: User,
    ):
        """
        Idempotent task creation.
        Converts current gaps into executable remediation tasks.

        Guarantees:
        - No duplicate active task per control
        - Checklist auto-generated
        - Atomic transaction
        """

        # Ensure process exists and belongs to tenant
        process = db.execute(
            select(Process).where(
                and_(
                    Process.id == process_id,
                    Process.tenant_id == user.tenant_id,
                )
            )
        ).scalar_one_or_none()

        if not process:
            return {
                "process_id": process_id,
                "created": 0,
                "skipped_existing": 0,
                "total_evaluated": 0,
                "error": "Process not found or not authorized",
            }

        audit_plan = AuditPlanEngine.generate(process_id, db, user)

        if not audit_plan.actions:
            return {
                "process_id": process_id,
                "created": 0,
                "skipped_existing": 0,
                "total_evaluated": 0,
            }

        created = 0
        skipped = 0

        for action in audit_plan.actions:

            # Duplicate protection
            existing = db.execute(
                select(ComplianceTask).where(
                    and_(
                        ComplianceTask.tenant_id == user.tenant_id,
                        ComplianceTask.process_id == process_id,
                        ComplianceTask.control_id == action.control_id,
                        ComplianceTask.created_from_gap == True,
                        ComplianceTask.status != "cancelled",
                    )
                )
            ).scalar_one_or_none()

            if existing:
                skipped += 1
                continue

            task = ComplianceTask(
                tenant_id=user.tenant_id,
                process_id=process_id,
                control_id=action.control_id,
                priority_score=action.priority_score,
                owner_role=action.suggested_owner_role,
                due_date=action.suggested_due_date,
                status="open",
                created_from_gap=True,
                title=f"{action.control_code} - Remediation Required",
                description=(
                    f"Standard: {action.standard_code} | "
                    f"Clause: {action.clause_code} | "
                    f"Requirement: {action.requirement_code}"
                ),
                created_at=datetime.utcnow(),
            )

            db.add(task)
            db.flush()  # IMPORTANT: ensures task.id is available

            # Generate evidence checklist automatically
            ChecklistEngine.generate_for_task(db, task)

            created += 1

        db.commit()

        return {
            "process_id": process_id,
            "created": created,
            "skipped_existing": skipped,
            "total_evaluated": len(audit_plan.actions),
        }