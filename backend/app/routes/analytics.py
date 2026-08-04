from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db
from app.dependencies.auth import get_current_user

from app.models.process import Process
from app.models.risks import Risk
from app.models.risk_versions import RiskVersion
from app.models.risk_evidence_link import RiskEvidenceLink
from app.models.evidence_files import EvidenceFile
from app.models.process_risk_link import ProcessRiskLink
from app.models.controls import Control
from app.models.controls_coverage import ControlsCoverage
from app.models.compliance_tasks import ComplianceTask

router = APIRouter(prefix="/analytics", tags=["Analytics"])


# ==========================================================
# CONTROL DETAIL
# ==========================================================

@router.get("/control-health/{control_id}")
def get_control_detail(
    control_id: int,
    db: Session = Depends(get_db),
):
    c = db.query(Control).filter(Control.id == control_id).first()

    if not c:
        raise HTTPException(status_code=404, detail="Control not found")

    risks = db.query(Risk).filter(Risk.control_id == c.id).all()
    risk_scores = [r.score for r in risks if r.score is not None]

    coverage_row = (
        db.query(ControlsCoverage)
        .filter(ControlsCoverage.control_id == c.id)
        .first()
    )

    coverage_map = {
        "NOT_ACHIEVED": 0,
        "PARTIALLY_ACHIEVED": 50,
        "ACHIEVED": 100,
    }

    coverage_percentage = (
        coverage_map.get(coverage_row.coverage_status, 0)
        if coverage_row
        else 0
    )

    return {
        "control_id": c.id,
        "control_code": c.code,
        "control_title": c.title,
        "linked_risk_count": len(risks),
        "worst_risk_score": max(risk_scores) if risk_scores else None,
        "avg_risk_score": (
            sum(risk_scores) / len(risk_scores)
            if risk_scores else None
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
    risks = db.query(Risk).filter(Risk.control_id == control_id).all()

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
def debug_coverage(db: Session = Depends(get_db)):
    rows = db.query(ControlsCoverage).all()

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

from datetime import datetime, timedelta

@router.post("/control-health/{control_id}/create-task")
def create_task_from_control(
    control_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):

    c = db.query(Control).filter(Control.id == control_id).first()

    if not c:
        raise HTTPException(status_code=404, detail="Control not found")

    existing = (
        db.query(ComplianceTask)
        .filter(
            ComplianceTask.control_id == control_id,
            ComplianceTask.status == "open"
        )
        .first()
    )

    if existing:
        return {
            "task_id": existing.id,
            "message": "Task already exists"
        }

    coverage_row = (
        db.query(ControlsCoverage)
        .filter(ControlsCoverage.control_id == control_id)
        .first()
    )

    coverage_status = coverage_row.coverage_status if coverage_row else "UNKNOWN"

    priority_score = 80 if coverage_status != "ACHIEVED" else 20

    task = ComplianceTask(
        tenant_id=current_user.tenant_id,
        process_id=1,
        control_id=c.id,
        priority_score=priority_score,
        owner_role="process_owner",
        due_date=datetime.utcnow() + timedelta(days=30),
        status="open",
        source_type="CONTROL_GAP",
        source_id=c.id,
        title=f"Remediate Control {c.code}",
        description=f"Control {c.code} coverage status is {coverage_status}. Action required."
    )

    db.add(task)
    db.commit()
    db.refresh(task)

    return {
        "task_id": task.id,
        "control_id": c.id,
        "priority_score": task.priority_score,
        "status": task.status
    }


# ==========================================================
# PROCESS READINESS (WITH STANDARD FILTER)
# ==========================================================

@router.get("/process_readiness")
def get_process_readiness(
    standard_id: int | None = Query(default=None),
    db: Session = Depends(get_db)
):

    if standard_id:

        query = text("""
            SELECT
                p.id AS process_id,
                p.name AS process_name,
                COUNT(c.id) AS control_count
            FROM processes p
            LEFT JOIN process_standard_links psl
                ON psl.process_id = p.id
            LEFT JOIN clauses cl
                ON cl.standard_id = psl.standard_id
            LEFT JOIN requirements r
                ON r.clause_id = cl.id
            LEFT JOIN controls c
                ON c.requirement_id = r.id
            WHERE psl.standard_id = :standard_id
            GROUP BY p.id, p.name
            ORDER BY control_count DESC
        """)

        rows = db.execute(query, {"standard_id": standard_id}).mappings().all()

    else:

        query = text("""
            SELECT
                tenant_id,
                process_id,
                process_name,
                control_count
            FROM analytics.v_process_readiness
            ORDER BY control_count DESC
        """)

        rows = db.execute(query).mappings().all()

    results = []

    for r in rows:

        coverage = min(100, r["control_count"])

        results.append({
            "process_id": r["process_id"],
            "process_name": r["process_name"],
            "readiness_score": coverage,
            "coverage_percentage": coverage,
            "critical_risks": 0,
            "escalation_probability": 0,
            "trend_30d": 0,
        })

    return results