# backend/app/routes/readiness.py

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.compliance_tasks import ComplianceTask
from app.models.task_checklist_item import TaskChecklistItem
from app.services.coverage_engine import CoverageEngine


router = APIRouter(prefix="/company/readiness", tags=["Executive"])


@router.get("/processes/{process_id}")
def executive_readiness_score(
    process_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Returns executive-level readiness score (0-100).
    """

    # ---------------------------
    # Coverage
    # ---------------------------
    coverage = CoverageEngine.get_process_coverage(process_id, db, user)

    total_controls = coverage["summary"]["controls_total"] or 1
    covered = coverage["summary"]["covered_controls"]

    coverage_ratio = covered / total_controls
    coverage_score = coverage_ratio * 40

    # ---------------------------
    # Risk
    # ---------------------------
    gaps = CoverageEngine.get_process_gaps(process_id, db, user)

    worst_score = gaps.summary.worst_max_risk_score or 0
    max_possible_score = 100

    risk_penalty_ratio = min(worst_score / max_possible_score, 1)
    risk_score = (1 - risk_penalty_ratio) * 25

    # ---------------------------
    # Tasks
    # ---------------------------
    tasks = db.execute(
        select(ComplianceTask).where(
            and_(
                ComplianceTask.process_id == process_id,
                ComplianceTask.tenant_id == user.tenant_id,
                ComplianceTask.created_from_gap == True,
            )
        )
    ).scalars().all()

    total_tasks = len(tasks) or 1
    open_tasks = len([t for t in tasks if t.status != "done"])

    open_ratio = open_tasks / total_tasks
    task_score = (1 - open_ratio) * 20

    # ---------------------------
    # Checklist
    # ---------------------------
    task_ids = [t.id for t in tasks]

    if task_ids:
        items = db.execute(
            select(TaskChecklistItem).where(
                TaskChecklistItem.task_id.in_(task_ids)
            )
        ).scalars().all()

        total_items = len(items) or 1
        completed = len([i for i in items if i.completed])

        completion_ratio = completed / total_items
        checklist_score = completion_ratio * 15
    else:
        checklist_score = 15

    final_score = round(
        coverage_score +
        risk_score +
        task_score +
        checklist_score,
        2
    )

    return {
        "process_id": process_id,
        "readiness_score": final_score,
        "breakdown": {
            "coverage_score": round(coverage_score, 2),
            "risk_score": round(risk_score, 2),
            "task_score": round(task_score, 2),
            "checklist_score": round(checklist_score, 2),
        }
    }