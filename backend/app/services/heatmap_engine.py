from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from app.models.compliance_tasks import ComplianceTask
from app.models.task_checklist_item import TaskChecklistItem
from app.services.clause_weight_engine import ClauseWeightEngine
from app.services.audit_plan_engine import AuditPlanEngine


class HeatmapEngine:

    @staticmethod
    def compute_for_process(process_id: int, db: Session, user):
        weights_data = ClauseWeightEngine.compute_for_process(
            process_id=process_id,
            db=db,
            user=user,
        )

        audit_plan = AuditPlanEngine.generate(process_id, db, user)

        # Aggregate by (standard, clause)
        agg = defaultdict(lambda: {
            "gap_count": 0,
            "max_risk_score": 0,
            "open_tasks": 0,
            "total_tasks": 0,
            "checklist_total": 0,
            "checklist_completed": 0,
        })

        # Map tasks
        tasks = db.execute(
            select(ComplianceTask).where(
                and_(
                    ComplianceTask.process_id == process_id,
                    ComplianceTask.tenant_id == user.tenant_id,
                )
            )
        ).scalars().all()

        task_by_control = {t.control_id: t for t in tasks}

        # Process audit plan
        for action in audit_plan.actions:
            key = (action.standard_code, action.clause_code)
            row = agg[key]

            row["gap_count"] += 1

            if action.max_risk_score:
                row["max_risk_score"] = max(
                    row["max_risk_score"],
                    action.max_risk_score
                )

            # task info
            task = task_by_control.get(action.control_id)
            if task:
                row["total_tasks"] += 1
                if task.status != "done":
                    row["open_tasks"] += 1

                # checklist
                items = db.execute(
                    select(TaskChecklistItem).where(
                        TaskChecklistItem.task_id == task.id
                    )
                ).scalars().all()

                row["checklist_total"] += len(items)
                row["checklist_completed"] += len(
                    [i for i in items if i.completed]
                )

        heatmap = []

        for std_code, clauses in weights_data["weights"].items():
            for clause_code, clause_data in clauses.items():

                weight_pct = clause_data["normalized_pct"].get(clause_code, 0)

                row = agg.get((std_code, clause_code), None)
                if not row:
                    continue

                # risk component (0-40)
                risk_component = (row["max_risk_score"] / 100) * 40

                # gap component (0-25)
                gap_component = min(row["gap_count"] * 5, 25)

                # task component (0-20)
                if row["total_tasks"] > 0:
                    open_ratio = row["open_tasks"] / row["total_tasks"]
                else:
                    open_ratio = 0

                task_component = open_ratio * 20

                # checklist penalty (0-15)
                if row["checklist_total"] > 0:
                    incomplete_ratio = (
                        1 - (row["checklist_completed"] / row["checklist_total"])
                    )
                else:
                    incomplete_ratio = 0

                checklist_penalty = incomplete_ratio * 15

                base_exposure = (
                    risk_component +
                    gap_component +
                    task_component +
                    checklist_penalty
                )

                exposure = round((weight_pct / 100) * base_exposure, 2)

                heatmap.append({
                    "standard_code": std_code,
                    "clause_code": clause_code,
                    "weight_pct": round(weight_pct, 2),
                    "gap_count": row["gap_count"],
                    "max_risk_score": row["max_risk_score"],
                    "open_tasks": row["open_tasks"],
                    "exposure_score": exposure,
                })

        heatmap.sort(key=lambda x: -x["exposure_score"])

        return {
            "process_id": process_id,
            "heatmap": heatmap,
        }