from fastapi import APIRouter, Depends, Query
from sqlalchemy import text, func
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.process import Process
from app.models.compliance_tasks import ComplianceTask
from app.models.controls_coverage import ControlsCoverage
from app.models.evidences import Evidence

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/process_readiness")
def get_process_readiness(
    standard_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tenant_id = current_user.tenant_id

    processes = (
        db.query(Process)
        .filter(
            Process.tenant_id == tenant_id,
            ~func.lower(func.coalesce(Process.status, "draft")).in_([
                "archived",
                "deleted",
                "inactive",
            ]),
        )
        .order_by(Process.code.asc())
        .all()
    )

    standard_control_ids = None
    if standard_id is not None:
        rows = db.execute(
            text("""
                SELECT DISTINCT control_id
                FROM matrix_rows
                WHERE tenant_id = :tenant_id
                  AND standard_id = :standard_id
                  AND control_id IS NOT NULL
            """),
            {"tenant_id": tenant_id, "standard_id": standard_id},
        ).mappings().all()
        standard_control_ids = {int(r["control_id"]) for r in rows if r["control_id"] is not None}

    results = []

    for process in processes:
        task_rows = (
            db.query(ComplianceTask.control_id)
            .filter(
                ComplianceTask.tenant_id == tenant_id,
                ComplianceTask.process_id == process.id,
                ComplianceTask.control_id.isnot(None),
            )
            .distinct()
            .all()
        )
        control_ids = {int(r.control_id) for r in task_rows if r.control_id is not None}

        if standard_control_ids is not None:
            control_ids &= standard_control_ids

        total_controls = len(control_ids)

        if total_controls:
            coverage_rows = (
                db.query(ControlsCoverage)
                .filter(ControlsCoverage.control_id.in_(control_ids))
                .all()
            )
            coverage_map = {
                "NOT_ACHIEVED": 0,
                "PARTIALLY_ACHIEVED": 50,
                "ACHIEVED": 100,
            }
            coverage_by_control = {
                r.control_id: coverage_map.get(str(r.coverage_status).upper(), 0)
                for r in coverage_rows
            }
            coverage_percentage = round(
                sum(coverage_by_control.get(cid, 0) for cid in control_ids) / total_controls,
                1,
            )

            evidence_rows = (
                db.query(
                    Evidence.control_id,
                    func.count(Evidence.id).label("total"),
                    func.count(Evidence.id)
                    .filter(func.upper(func.coalesce(Evidence.approval_status, "")).in_(["APPROVED", "APPROVED_REVIEW"]))
                    .label("approved"),
                )
                .filter(
                    Evidence.tenant_id == tenant_id,
                    Evidence.control_id.in_(control_ids),
                    Evidence.is_deleted.is_(False),
                )
                .group_by(Evidence.control_id)
                .all()
            )
            evidence_map = {r.control_id: (100 if r.approved else 50 if r.total else 0) for r in evidence_rows}
            evidence_percentage = round(sum(evidence_map.get(cid, 0) for cid in control_ids) / total_controls, 1)
        else:
            coverage_percentage = 0
            evidence_percentage = 0

        risk_rows = db.execute(
            text("""
                SELECT r.score, r.risk_level
                FROM risks r
                INNER JOIN process_risk_links prl ON prl.risk_id = r.id
                WHERE prl.process_id = :process_id
                  AND prl.tenant_id = :tenant_id
                  AND r.tenant_id = :tenant_id
            """),
            {"process_id": process.id, "tenant_id": tenant_id},
        ).mappings().all()

        critical = 0
        high = 0
        for r in risk_rows:
            level = str(r["risk_level"] or "").upper()
            score = r["score"]
            if level == "CRITICAL" or (score is not None and score >= 17):
                critical += 1
            elif level == "HIGH" or (score is not None and score >= 10):
                high += 1

        open_tasks = (
            db.query(func.count(ComplianceTask.id))
            .filter(
                ComplianceTask.tenant_id == tenant_id,
                ComplianceTask.process_id == process.id,
                ComplianceTask.status.notin_(["completed", "closed", "done"]),
            )
            .scalar()
            or 0
        )

        total_risks = len(risk_rows)
        risk_score = 100 if total_risks == 0 else max(0, 100 - ((critical + high * 0.5) / total_risks * 100))
        task_score = max(0, 100 - min(100, open_tasks * 10))

        readiness_score = round(
            coverage_percentage * 0.40
            + evidence_percentage * 0.25
            + risk_score * 0.20
            + task_score * 0.15,
            1,
        ) if total_controls else 0

        escalation = min(
            100,
            critical * 60
            + high * 20
            + (15 if coverage_percentage < 50 else 0)
            + (10 if open_tasks >= 3 else 5 if open_tasks > 0 else 0),
        )

        results.append({
            "process_id": process.id,
            "process_code": process.code,
            "process_name": process.name,
            "readiness_score": readiness_score,
            "coverage_percentage": coverage_percentage,
            "critical_risk_count": critical,
            "critical_risks": critical,
            "escalation_probability": escalation,
            "trend_delta": 0,
            "trend_30d": 0,
        })

    results.sort(key=lambda x: (-x["escalation_probability"], x["readiness_score"]))
    return results
