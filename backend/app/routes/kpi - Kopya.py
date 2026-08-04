from __future__ import annotations

from typing import Any, Dict
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.risks import Risk
from app.models.risk_assessment_result import RiskAssessmentResult
from app.models.evidences import Evidence
from app.models.evidence_files import EvidenceFile
from app.services.evidence_service import EvidenceService

# =====================================================
# ROUTER (MUTLAKA EN ÜSTTE)
# =====================================================
router = APIRouter(prefix="/kpi", tags=["KPI"])

# =====================================================
# KPI SUMMARY
# =====================================================
@router.get("/summary")
def kpi_summary(db: Session = Depends(get_db)) -> Dict[str, Any]:
    total_risks = db.query(func.count(Risk.id)).scalar() or 0
    avg_risk_score = db.query(func.avg(RiskAssessmentResult.score)).scalar() or 0

    critical_risks = (
        db.query(func.count(RiskAssessmentResult.id))
        .filter(RiskAssessmentResult.score >= 15)
        .scalar()
        or 0
    )

    completed = in_progress = not_completed = 0
    for (eid,) in db.query(Evidence.id).all():
        status = EvidenceService.calculate_overall_status(
            db=db, evidence_id=eid, fallback="not_completed"
        )
        if status == "completed":
            completed += 1
        elif status == "in_progress":
            in_progress += 1
        else:
            not_completed += 1

    total_evidences = completed + in_progress + not_completed
    compliance_percentage = (
        (completed / total_evidences) * 100 if total_evidences else 0
    )

    total_files = db.query(func.count(EvidenceFile.id)).scalar() or 0
    approved_files = (
        db.query(func.count(EvidenceFile.id))
        .filter(func.lower(EvidenceFile.status) == "approved")
        .scalar()
        or 0
    )
    rejected_files = (
        db.query(func.count(EvidenceFile.id))
        .filter(func.lower(EvidenceFile.status) == "rejected")
        .scalar()
        or 0
    )

    accepted_rate = (approved_files / total_files) * 100 if total_files else 0
    rejected_rate = (rejected_files / total_files) * 100 if total_files else 0

    ever_rejected_sq = (
        db.query(EvidenceFile.evidence_id)
        .filter(func.lower(EvidenceFile.status) == "rejected")
        .group_by(EvidenceFile.evidence_id)
        .subquery()
    )

    ever_rejected = db.query(func.count()).select_from(ever_rejected_sq).scalar() or 0

    recovered = 0
    for (eid,) in db.query(ever_rejected_sq.c.evidence_id).all():
        status = EvidenceService.calculate_overall_status(
            db=db, evidence_id=eid, fallback="not_completed"
        )
        if status == "completed":
            recovered += 1

    recovery_rate = (recovered / ever_rejected) * 100 if ever_rejected else 0

    mttr_rows = db.execute(
        text(
            """
            WITH fr AS (
              SELECT evidence_id, MIN(rejected_at) AS rejected_at
              FROM evidence_files
              WHERE rejected_at IS NOT NULL
              GROUP BY evidence_id
            ),
            fa AS (
              SELECT evidence_id, MIN(approved_at) AS approved_at
              FROM evidence_files
              WHERE approved_at IS NOT NULL
              GROUP BY evidence_id
            )
            SELECT
              EXTRACT(EPOCH FROM (fa.approved_at - fr.rejected_at)) / 3600
                AS recovery_hours
            FROM fr
            JOIN fa ON fa.evidence_id = fr.evidence_id
            """
        )
    ).fetchall()

    avg_mttr_hours = (
        sum(float(r.recovery_hours) for r in mttr_rows) / len(mttr_rows)
        if mttr_rows
        else 0
    )

    return {
        "risk": {
            "total": total_risks,
            "critical": critical_risks,
            "average_score": float(avg_risk_score or 0),
        },
        "evidence": {
            "total": total_evidences,
            "completed": completed,
            "in_progress": in_progress,
            "not_completed": not_completed,
        },
        "file_quality": {
            "total_files": total_files,
            "approved_files": approved_files,
            "rejected_files": rejected_files,
            "accepted_rate": round(accepted_rate, 2),
            "rejected_rate": round(rejected_rate, 2),
        },
        "recovery": {
            "ever_rejected": ever_rejected,
            "recovered": recovered,
            "recovery_rate": round(recovery_rate, 2),
        },
        "compliance_percentage": round(compliance_percentage, 2),
        "mttr": {"avg_hours": round(avg_mttr_hours, 2)},
    }

# =====================================================
# REJECTED EVIDENCE TREND
# =====================================================
@router.get("/evidences/rejected-trend")
def rejected_evidence_trend(
    range: int = Query(30), db: Session = Depends(get_db)
):
    rows = db.execute(
        text(
            """
            SELECT
              DATE(h.status_at) AS date,
              COUNT(DISTINCT ef.evidence_id) AS rejected_count
            FROM evidence_file_status_history h
            JOIN evidence_files ef ON ef.id = h.evidence_file_id
            WHERE lower(h.status) = 'rejected'
              AND h.status_at >= NOW() - (:range || ' days')::interval
            GROUP BY DATE(h.status_at)
            ORDER BY DATE(h.status_at)
            """
        ),
        {"range": range},
    ).mappings().all()

    return [{"date": str(r["date"]), "rejected_count": r["rejected_count"]} for r in rows]

# =====================================================
# MTTR TREND
# =====================================================
@router.get("/evidences/mttr-trend")
def mttr_trend(
    range: int = Query(30), db: Session = Depends(get_db)
):
    rows = db.execute(
        text(
            """
            WITH fr AS (
              SELECT evidence_id, MIN(rejected_at) AS rejected_at
              FROM evidence_files
              WHERE rejected_at IS NOT NULL
              GROUP BY evidence_id
            ),
            fa AS (
              SELECT evidence_id, MIN(approved_at) AS approved_at
              FROM evidence_files
              WHERE approved_at IS NOT NULL
              GROUP BY evidence_id
            )
            SELECT
              DATE(fa.approved_at) AS date,
              AVG(EXTRACT(EPOCH FROM (fa.approved_at - fr.rejected_at)) / 3600)
                AS avg_hours
            FROM fr
            JOIN fa ON fa.evidence_id = fr.evidence_id
            WHERE fa.approved_at >= NOW() - (:range || ' days')::interval
            GROUP BY DATE(fa.approved_at)
            ORDER BY DATE(fa.approved_at)
            """
        ),
        {"range": range},
    ).mappings().all()

    return [
        {"date": str(r["date"]), "avg_hours": round(r["avg_hours"], 2)}
        for r in rows
        if r["avg_hours"] is not None
    ]

# =====================================================
# MTTR DETAIL TABLE
# =====================================================
@router.get("/evidences/mttr-details")
def mttr_details(db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            """
            WITH fr AS (
              SELECT evidence_id, MIN(rejected_at) AS rejected_at
              FROM evidence_files
              WHERE rejected_at IS NOT NULL
              GROUP BY evidence_id
            ),
            fa AS (
              SELECT evidence_id, MIN(approved_at) AS approved_at
              FROM evidence_files
              WHERE approved_at IS NOT NULL
              GROUP BY evidence_id
            )
            SELECT
              fr.evidence_id,
              fr.rejected_at AS first_rejected_at,
              fa.approved_at AS first_approved_at,
              EXTRACT(EPOCH FROM (fa.approved_at - fr.rejected_at)) / 3600
                AS recovery_hours
            FROM fr
            JOIN fa ON fa.evidence_id = fr.evidence_id
            ORDER BY recovery_hours DESC
            """
        )
    ).mappings().all()

    return [
        {
            "evidence_id": r["evidence_id"],
            "first_rejected_at": r["first_rejected_at"],
            "first_approved_at": r["first_approved_at"],
            "recovery_hours": round(r["recovery_hours"], 2),
        }
        for r in rows
    ]

# =====================================================
# STEP-2C — REOPENED EVIDENCE SUMMARY
# =====================================================
@router.get("/evidences/reopened-summary")
def reopened_evidence_summary(db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            """
            WITH events AS (
              SELECT ef.evidence_id, h.status, h.status_at
              FROM evidence_file_status_history h
              JOIN evidence_files ef ON ef.id = h.evidence_file_id
            ),
            rejected AS (
              SELECT evidence_id, MIN(status_at) AS first_rejected_at
              FROM events
              WHERE lower(status) = 'rejected'
              GROUP BY evidence_id
            ),
            uploaded_after_reject AS (
              SELECT DISTINCT e.evidence_id
              FROM events e
              JOIN rejected r ON r.evidence_id = e.evidence_id
              WHERE lower(e.status) = 'uploaded'
                AND e.status_at > r.first_rejected_at
            ),
            last_status AS (
              SELECT DISTINCT ON (evidence_id)
                evidence_id,
                lower(status) AS status
              FROM events
              ORDER BY evidence_id, status_at DESC
            )
            SELECT
              COUNT(*) FILTER (
                WHERE evidence_id IN (SELECT evidence_id FROM uploaded_after_reject)
                  AND status = 'approved'
              ) AS reuploaded_approved,
              COUNT(*) FILTER (
                WHERE evidence_id IN (SELECT evidence_id FROM uploaded_after_reject)
                  AND status IN ('uploaded','waiting_approval','pending')
              ) AS reuploaded_pending,
              COUNT(*) FILTER (
                WHERE evidence_id NOT IN (SELECT evidence_id FROM uploaded_after_reject)
                  AND evidence_id IN (SELECT evidence_id FROM rejected)
              ) AS rejected_abandoned
            FROM last_status;
            """
        )
    ).mappings().first()

    return {
        "reuploaded_approved": int(rows["reuploaded_approved"] or 0),
        "reuploaded_pending": int(rows["reuploaded_pending"] or 0),
        "rejected_abandoned": int(rows["rejected_abandoned"] or 0),
    }
# =====================================================
# SUMMARY STATUS (Dashboard banner)
# =====================================================
@router.get("/summary/status")
def kpi_summary_status(db: Session = Depends(get_db)):

    # compliance %
    completed = in_progress = not_completed = 0

    for (eid,) in db.query(Evidence.id).all():
        status = EvidenceService.calculate_overall_status(
            db=db, evidence_id=eid, fallback="not_completed"
        )

        if status == "completed":
            completed += 1
        elif status == "in_progress":
            in_progress += 1
        else:
            not_completed += 1

    total = completed + in_progress + not_completed
    compliance_percentage = (completed / total) * 100 if total else 0

    # mttr
    mttr_rows = db.execute(
        text(
            """
            WITH fr AS (
              SELECT evidence_id, MIN(rejected_at) AS rejected_at
              FROM evidence_files
              WHERE rejected_at IS NOT NULL
              GROUP BY evidence_id
            ),
            fa AS (
              SELECT evidence_id, MIN(approved_at) AS approved_at
              FROM evidence_files
              WHERE approved_at IS NOT NULL
              GROUP BY evidence_id
            )
            SELECT
              EXTRACT(EPOCH FROM (fa.approved_at - fr.rejected_at)) / 3600 AS recovery_hours
            FROM fr
            JOIN fa
              ON fa.evidence_id = fr.evidence_id
             AND fa.approved_at > fr.rejected_at
            """
        )
    ).mappings().all()

    avg_mttr = (
        sum(float(r["recovery_hours"]) for r in mttr_rows) / len(mttr_rows)
        if mttr_rows
        else 0
    )

    def classify_high_good(value: float, ok: float, warn: float):
        if value >= ok:
            return "ok"
        if value >= warn:
            return "warning"
        return "critical"

    def classify_low_good(value: float, ok: float, warn: float):
        if value <= ok:
            return "ok"
        if value <= warn:
            return "warning"
        return "critical"

    return {
        "meta": {
            "compliance_status": classify_high_good(
                compliance_percentage,
                ok=85,
                warn=70,
            ),
            "mttr_status": classify_low_good(
                avg_mttr,
                ok=24,
                warn=48,
            ),
        }
    }
# =====================================================
# PENDING AGING (SLA)
# =====================================================
@router.get("/evidences/pending-aging")
def pending_aging(db: Session = Depends(get_db)):
    row = db.execute(
        text(
            """
            WITH pending AS (
              SELECT
                DATE_PART('day', now() - created_at) AS age_days
              FROM evidences
              WHERE status IN ('pending', 'uploaded', 'under_review')
            )
            SELECT
              AVG(age_days)::numeric(10,1)                      AS avg_days,
              MAX(age_days)::int                                AS oldest_days,
              COUNT(*) FILTER (WHERE age_days <= 7)             AS bucket_0_7,
              COUNT(*) FILTER (WHERE age_days BETWEEN 8 AND 30) AS bucket_8_30,
              COUNT(*) FILTER (WHERE age_days > 30)             AS bucket_30_plus
            FROM pending;
            """
        )
    ).mappings().first()

    return {
        "avg_days": float(row["avg_days"] or 0),
        "oldest_days": int(row["oldest_days"] or 0),
        "buckets": {
            "0_7": int(row["bucket_0_7"] or 0),
            "8_30": int(row["bucket_8_30"] or 0),
            "30_plus": int(row["bucket_30_plus"] or 0),
        },
    }
