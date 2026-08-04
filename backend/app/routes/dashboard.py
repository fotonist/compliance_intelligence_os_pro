from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import datetime, timedelta

from app.db.session import get_db
from app.models.risk_assessment import RiskAssessment
from app.models.risk_history import RiskHistory
from app.models.evidence import Evidence

router = APIRouter(
    prefix="/dashboard",
    tags=["Dashboard"],
)

# =====================================================
# KPI SUMMARY
# =====================================================

@router.get("/kpi-summary")
def get_kpi_summary(db: Session = Depends(get_db)):
    total_risks = db.query(func.count(RiskAssessment.id)).scalar()
    open_risks = db.query(func.count(RiskAssessment.id)).filter(
        RiskAssessment.status != "closed"
    ).scalar()

    critical_risks = db.query(func.count(RiskAssessment.id)).filter(
        RiskAssessment.score >= 15
    ).scalar()

    avg_risk_score = db.query(func.avg(RiskAssessment.score)).scalar()

    total_evidences = db.query(func.count(Evidence.id)).scalar()

    approved_evidences = db.query(func.count(Evidence.id)).filter(
        Evidence.status == "approved"
    ).scalar()

    pending_evidences = db.query(func.count(Evidence.id)).filter(
        Evidence.status.in_(["pending", "waiting_approval", "uploaded"])
    ).scalar()

    rejected_evidences = db.query(func.count(Evidence.id)).filter(
        Evidence.status == "rejected"
    ).scalar()

    compliance_percentage = (
        (approved_evidences / total_evidences) * 100
        if total_evidences > 0
        else 0
    )

    return {
        "risk": {
            "total": total_risks,
            "open": open_risks,
            "critical": critical_risks,
            "average_score": round(avg_risk_score or 0, 2),
        },
        "evidence": {
            "total": total_evidences,
            "approved": approved_evidences,
            "pending": pending_evidences,
            "rejected": rejected_evidences,
        },
        "compliance_percentage": round(compliance_percentage, 2),
    }


# =====================================================
# RISK STATUS DISTRIBUTION
# =====================================================

@router.get("/risk-status-distribution")
def get_risk_status_distribution(db: Session = Depends(get_db)):
    rows = (
        db.query(
            RiskAssessment.status,
            func.count(RiskAssessment.id),
        )
        .group_by(RiskAssessment.status)
        .all()
    )

    return {status: count for status, count in rows}


# =====================================================
# EVIDENCE STATUS DISTRIBUTION
# =====================================================

@router.get("/evidence-status-distribution")
def get_evidence_status_distribution(db: Session = Depends(get_db)):
    rows = (
        db.query(
            Evidence.status,
            func.count(Evidence.id),
        )
        .group_by(Evidence.status)
        .all()
    )

    return {status: count for status, count in rows}


# =====================================================
# RISK SCORE TREND (LAST 30 DAYS)
# =====================================================

@router.get("/risk-score-trend")
def get_risk_score_trend(db: Session = Depends(get_db)):
    since = datetime.utcnow() - timedelta(days=30)

    rows = (
        db.query(
            func.date(RiskHistory.created_at).label("date"),
            func.avg(RiskHistory.score_new).label("avg_score"),
        )
        .filter(RiskHistory.created_at >= since)
        .group_by(func.date(RiskHistory.created_at))
        .order_by(func.date(RiskHistory.created_at))
        .all()
    )

    return [
        {
            "date": date.isoformat(),
            "average_score": round(avg_score or 0, 2),
        }
        for date, avg_score in rows
    ]


# =====================================================
# HEATMAP DATA (IMPACT x LIKELIHOOD)
# =====================================================

@router.get("/risk-heatmap")
def get_risk_heatmap(db: Session = Depends(get_db)):
    rows = (
        db.query(
            RiskAssessment.impact,
            RiskAssessment.likelihood,
            func.count(RiskAssessment.id),
        )
        .group_by(
            RiskAssessment.impact,
            RiskAssessment.likelihood,
        )
        .all()
    )

    heatmap = {}

    for impact, likelihood, count in rows:
        key = f"{impact}x{likelihood}"
        heatmap[key] = count

    return heatmap
