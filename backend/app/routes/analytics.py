from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text, func, distinct
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user

from app.models.process import Process
from app.models.risks import Risk
from app.models.controls import Control
from app.models.controls_coverage import ControlsCoverage
from app.models.compliance_tasks import ComplianceTask


router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"],
)


# ==========================================================
# CONTROL DETAIL
# ==========================================================

@router.get("/control-health/{control_id}")
def get_control_detail(
    control_id: int,
    db: Session = Depends(get_db),
):
    c = (
        db.query(Control)
        .filter(Control.id == control_id)
        .first()
    )

    if not c:
        raise HTTPException(
            status_code=404,
            detail="Control not found",
        )

    risks = (
        db.query(Risk)
        .filter(Risk.control_id == c.id)
        .all()
    )

    risk_scores = [
        r.score
        for r in risks
        if r.score is not None
    ]

    coverage_row = (
        db.query(ControlsCoverage)
        .filter(
            ControlsCoverage.control_id == c.id
        )
        .first()
    )

    coverage_map = {
        "NOT_ACHIEVED": 0,
        "PARTIALLY_ACHIEVED": 50,
        "ACHIEVED": 100,
    }

    coverage_percentage = (
        coverage_map.get(
            coverage_row.coverage_status,
            0,
        )
        if coverage_row
        else 0
    )

    return {
        "control_id": c.id,
        "control_code": c.code,
        "control_title": c.title,
        "linked_risk_count": len(risks),
        "worst_risk_score": (
            max(risk_scores)
            if risk_scores
            else None
        ),
        "avg_risk_score": (
            sum(risk_scores) / len(risk_scores)
            if risk_scores
            else None
        ),
        "coverage_score": coverage_percentage,
    }


# ==========================================================
# LINKED RISKS
# ==========================================================

@router.get("/control-health/{control_id}/risks")
def get_control_linked_risks(
    control_id: int,
    db: Session = Depends(get_db),
):
    risks = (
        db.query(Risk)
        .filter(Risk.control_id == control_id)
        .all()
    )

    return [
        {
            "id": r.id,
            "title": r.title,
            "score": r.score,
            "likelihood": r.likelihood,
            "impact": r.impact,
            "risk_level": r.risk_level,
            "escalation_probability": None,
            "exposure_score": None,
        }
        for r in risks
    ]


# ==========================================================
# DEBUG COVERAGE
# ==========================================================

@router.get("/debug-coverage")
def debug_coverage(
    db: Session = Depends(get_db),
):
    rows = (
        db.query(ControlsCoverage)
        .all()
    )

    return [
        {
            "control_id": r.control_id,
            "coverage_status": r.coverage_status,
        }
        for r in rows
    ]


# ==========================================================
# CREATE TASK FROM CONTROL GAP
# ==========================================================

@router.post("/control-health/{control_id}/create-task")
def create_task_from_control(
    control_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    c = (
        db.query(Control)
        .filter(Control.id == control_id)
        .first()
    )

    if not c:
        raise HTTPException(
            status_code=404,
            detail="Control not found",
        )

    existing = (
        db.query(ComplianceTask)
        .filter(
            ComplianceTask.control_id == control_id,
            ComplianceTask.status == "open",
            ComplianceTask.tenant_id
            == current_user.tenant_id,
        )
        .first()
    )

    if existing:
        return {
            "task_id": existing.id,
            "message": "Task already exists",
        }

    coverage_row = (
        db.query(ControlsCoverage)
        .filter(
            ControlsCoverage.control_id == control_id
        )
        .first()
    )

    coverage_status = (
        coverage_row.coverage_status
        if coverage_row
        else "UNKNOWN"
    )

    priority_score = (
        80
        if coverage_status != "ACHIEVED"
        else 20
    )

    task = ComplianceTask(
        tenant_id=current_user.tenant_id,
        process_id=1,
        control_id=c.id,
        priority_score=priority_score,
        owner_role="process_owner",
        due_date=datetime.utcnow()
        + timedelta(days=30),
        status="open",
        source_type="CONTROL_GAP",
        source_id=c.id,
        title=f"Remediate Control {c.code}",
        description=(
            f"Control {c.code} coverage status "
            f"is {coverage_status}. Action required."
        ),
    )

    db.add(task)
    db.commit()
    db.refresh(task)

    return {
        "task_id": task.id,
        "control_id": c.id,
        "priority_score": task.priority_score,
        "status": task.status,
    }


# ==========================================================
# PROCESS READINESS
# ==========================================================
#
# Process ↔ Control relationship:
#
# processes
#     ↓
# compliance_tasks.process_id
#     ↓
# compliance_tasks.control_id
#     ↓
# controls
#
# Process ↔ Risk:
#
# processes
#     ↓
# process_risk_links
#     ↓
# risks
#
# Standard scope:
#
# matrix_rows.standard_id
#     ↓
# matrix_rows.control_id
#
# ==========================================================

@router.get("/process_readiness")
def get_process_readiness(
    standard_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_id = current_user.tenant_id

    # ------------------------------------------------------
    # 1. Load active tenant processes
    # ------------------------------------------------------

    processes = (
        db.query(Process)
        .filter(
            Process.tenant_id == tenant_id,
            Process.status.ilike("active"),
        )
        .order_by(Process.code.asc())
        .all()
    )

    # ------------------------------------------------------
    # 2. Build standard-scoped control set
    # ------------------------------------------------------

    standard_control_ids = None

    if standard_id is not None:
        rows = db.execute(
            text(
                """
                SELECT DISTINCT control_id
                FROM matrix_rows
                WHERE tenant_id = :tenant_id
                  AND standard_id = :standard_id
                  AND control_id IS NOT NULL
                """
            ),
            {
                "tenant_id": tenant_id,
                "standard_id": standard_id,
            },
        ).mappings().all()

        standard_control_ids = {
            int(row["control_id"])
            for row in rows
            if row["control_id"] is not None
        }

    # ------------------------------------------------------
    # 3. Process readiness
    # ------------------------------------------------------

    results = []

    for process in processes:

        # --------------------------------------------------
        # Controls assigned to process
        #
        # A task carries both:
        # process_id
        # control_id
        #
        # We use DISTINCT control IDs so multiple tasks
        # for the same control do not inflate the metrics.
        # --------------------------------------------------

        task_rows = (
            db.query(
                ComplianceTask.control_id
            )
            .filter(
                ComplianceTask.tenant_id
                == tenant_id,
                ComplianceTask.process_id
                == process.id,
                ComplianceTask.control_id
                .isnot(None),
            )
            .distinct()
            .all()
        )

        process_control_ids = {
            int(row.control_id)
            for row in task_rows
            if row.control_id is not None
        }

        # --------------------------------------------------
        # Apply standard scope
        # --------------------------------------------------

        if standard_control_ids is not None:
            process_control_ids = (
                process_control_ids
                & standard_control_ids
            )

        total_controls = len(
            process_control_ids
        )

        # --------------------------------------------------
        # No controls
        # --------------------------------------------------

        if total_controls == 0:

            # Risks are still process-level.
            risk_query = (
                db.query(Risk)
                .join(
                    text(
                        "process_risk_links"
                    ),
                    text(
                        "process_risk_links.risk_id = risks.id"
                    ),
                )
                .filter(
                    text(
                        "process_risk_links.process_id = :process_id"
                    ),
                    Risk.tenant_id == tenant_id,
                )
            )

            risk_query = risk_query.params(
                process_id=process.id
            )

            risks = risk_query.all()

            critical_risks = sum(
                1
                for risk in risks
                if (
                    str(risk.risk_level)
                    .upper()
                    == "CRITICAL"
                )
            )

            open_tasks = (
                db.query(
                    func.count(
                        ComplianceTask.id
                    )
                )
                .filter(
                    ComplianceTask.tenant_id
                    == tenant_id,
                    ComplianceTask.process_id
                    == process.id,
                    ComplianceTask.status
                    .notin_(
                        [
                            "completed",
                            "closed",
                            "done",
                        ]
                    ),
                )
                .scalar()
                or 0
            )

            results.append(
                {
                    "process_id": process.id,
                    "process_code": process.code,
                    "process_name": process.name,
                    "readiness_score": 0,
                    "coverage_percentage": 0,
                    "critical_risk_count": critical_risks,
                    "critical_risks": critical_risks,
                    "escalation_probability": (
                        100
                        if critical_risks > 0
                        else 0
                    ),
                    "trend_delta": 0,
                    "trend_30d": 0,
                }
            )

            continue

        # --------------------------------------------------
        # Coverage
        # --------------------------------------------------

        coverage_rows = (
            db.query(ControlsCoverage)
            .filter(
                ControlsCoverage.control_id.in_(
                    process_control_ids
                )
            )
            .all()
        )

        coverage_map = {
            "NOT_ACHIEVED": 0,
            "PARTIALLY_ACHIEVED": 50,
            "ACHIEVED": 100,
        }

        coverage_values = []

        for control_id in process_control_ids:

            coverage_row = next(
                (
                    row
                    for row in coverage_rows
                    if row.control_id
                    == control_id
                ),
                None,
            )

            coverage_values.append(
                coverage_map.get(
                    (
                        coverage_row.coverage_status
                        if coverage_row
                        else "NOT_ACHIEVED"
                    ),
                    0,
                )
            )

        coverage_percentage = (
            sum(coverage_values)
            / len(coverage_values)
        )

        # --------------------------------------------------
        # Evidence coverage
        # --------------------------------------------------
        #
        # Evidence is considered available when at least
        # one evidence record exists for the control.
        #
        # Approved evidence is preferred.
        # --------------------------------------------------

        evidence_rows = db.execute(
            text(
                """
                SELECT
                    e.control_id,
                    COUNT(*) AS total,
                    COUNT(*) FILTER (
                        WHERE UPPER(
                            COALESCE(
                                e.approval_status,
                                ''
                            )
                        ) IN (
                            'APPROVED',
                            'APPROVED_REVIEW'
                        )
                    ) AS approved
                FROM evidences e
                WHERE e.tenant_id = :tenant_id
                  AND e.control_id = ANY(
                      :control_ids
                  )
                  AND COALESCE(
                      e.is_deleted,
                      false
                  ) = false
                GROUP BY e.control_id
                """
            ),
            {
                "tenant_id": tenant_id,
                "control_ids": list(
                    process_control_ids
                ),
            },
        ).mappings().all()

        evidence_by_control = {
            int(row["control_id"]): {
                "total": int(
                    row["total"] or 0
                ),
                "approved": int(
                    row["approved"] or 0
                ),
            }
            for row in evidence_rows
        }

        evidence_scores = []

        for control_id in process_control_ids:

            evidence = (
                evidence_by_control.get(
                    control_id,
                    {
                        "total": 0,
                        "approved": 0,
                    },
                )
            )

            if evidence["approved"] > 0:
                evidence_scores.append(100)
            elif evidence["total"] > 0:
                evidence_scores.append(50)
            else:
                evidence_scores.append(0)

        evidence_percentage = (
            sum(evidence_scores)
            / len(evidence_scores)
        )

        # --------------------------------------------------
        # Process risks
        # --------------------------------------------------

        risk_rows = db.execute(
            text(
                """
                SELECT
                    r.id,
                    r.score,
                    r.risk_level,
                    r.status
                FROM risks r
                INNER JOIN process_risk_links prl
                    ON prl.risk_id = r.id
                WHERE prl.process_id = :process_id
                  AND prl.tenant_id = :tenant_id
                  AND r.tenant_id = :tenant_id
                """
            ),
            {
                "process_id": process.id,
                "tenant_id": tenant_id,
            },
        ).mappings().all()

        critical_risks = 0
        high_risks = 0

        for risk in risk_rows:

            level = str(
                risk["risk_level"] or ""
            ).upper()

            score = risk["score"]

            if (
                level == "CRITICAL"
                or (
                    score is not None
                    and score >= 17
                )
            ):
                critical_risks += 1

            elif (
                level == "HIGH"
                or (
                    score is not None
                    and score >= 10
                )
            ):
                high_risks += 1

        total_risks = len(risk_rows)

        # --------------------------------------------------
        # Risk posture
        # --------------------------------------------------

        if total_risks == 0:
            risk_score = 100
        else:
            risk_pressure = (
                (
                    critical_risks * 1.0
                    + high_risks * 0.5
                )
                / total_risks
            )

            risk_score = max(
                0,
                100
                - (
                    risk_pressure
                    * 100
                ),
            )

        # --------------------------------------------------
        # Open task pressure
        # --------------------------------------------------

        open_task_count = (
            db.query(
                func.count(
                    ComplianceTask.id
                )
            )
            .filter(
                ComplianceTask.tenant_id
                == tenant_id,
                ComplianceTask.process_id
                == process.id,
                ComplianceTask.status
                .notin_(
                    [
                        "completed",
                        "closed",
                        "done",
                    ]
                ),
            )
            .scalar()
            or 0
        )

        if open_task_count == 0:
            task_score = 100
        else:
            # Controlled pressure curve.
            task_score = max(
                0,
                100
                - min(
                    100,
                    open_task_count * 10,
                ),
            )

        # --------------------------------------------------
        # Readiness score
        # --------------------------------------------------
        #
        # Coverage      40%
        # Evidence      25%
        # Risk posture  20%
        # Task pressure 15%
        #
        # Higher = better readiness.
        # --------------------------------------------------

        readiness_score = (
            coverage_percentage * 0.40
            + evidence_percentage * 0.25
            + risk_score * 0.20
            + task_score * 0.15
        )

        readiness_score = round(
            max(
                0,
                min(
                    100,
                    readiness_score,
                ),
            ),
            1,
        )

        # --------------------------------------------------
        # Escalation probability
        # --------------------------------------------------

        escalation_probability = 0

        if critical_risks > 0:
            escalation_probability += 60

        if high_risks > 0:
            escalation_probability += 20

        if coverage_percentage < 50:
            escalation_probability += 15

        if open_task_count >= 3:
            escalation_probability += 10
        elif open_task_count > 0:
            escalation_probability += 5

        escalation_probability = min(
            100,
            escalation_probability,
        )

        # --------------------------------------------------
        # Trend
        #
        # No historical process-readiness snapshot exists
        # in the current schema.
        #
        # Therefore we do NOT invent historical data.
        # --------------------------------------------------

        trend_delta = 0

        results.append(
            {
                "process_id": process.id,
                "process_code": process.code,
                "process_name": process.name,
                "readiness_score": readiness_score,
                "coverage_percentage": round(
                    coverage_percentage,
                    1,
                ),
                "critical_risk_count": critical_risks,
                "critical_risks": critical_risks,
                "escalation_probability": escalation_probability,
                "trend_delta": trend_delta,
                "trend_30d": trend_delta,
            }
        )

    # ------------------------------------------------------
    # Sort by readiness
    # ------------------------------------------------------

    results.sort(
        key=lambda x: (
            -x["escalation_probability"],
            x["readiness_score"],
        )
    )

    return results
