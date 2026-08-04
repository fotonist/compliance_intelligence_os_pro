from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.risks import Risk
from app.models.evidences import Evidence
from app.core.rbac import require_roles, Role

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get(
    "/trends",
    dependencies=[Depends(require_roles(Role.Admin, Role.ComplianceOfficer, Role.Auditor))]
)
def dashboard_trends(days: int = 30, db: Session = Depends(get_db)):
    since = datetime.utcnow() - timedelta(days=days)

    # -----------------------------
    # DAILY EVIDENCE APPROVALS
    # -----------------------------
    approvals = (
        db.query(
            func.date(AuditLog.created_at).label("day"),
            func.count(AuditLog.id).label("count"),
        )
        .filter(
            AuditLog.entity_type == "Evidence",
            AuditLog.action == "STATUS_CHANGE",
            AuditLog.new_value["status"].astext.in_(["Approved", "APPROVED"]),
            AuditLog.created_at >= since,
        )
        .group_by(func.date(AuditLog.created_at))
        .order_by(func.date(AuditLog.created_at))
        .all()
    )

    approvals_series = [
        {"date": str(row.day), "count": row.count} for row in approvals
    ]

    # -----------------------------
    # RISK EXPOSURE SNAPSHOTS
    # (current state sampled daily via AuditLog days)
    # -----------------------------
    days_list = (
        db.query(func.date(AuditLog.created_at))
        .filter(AuditLog.created_at >= since)
        .distinct()
        .order_by(func.date(AuditLog.created_at))
        .all()
    )

    risk_trend = []
    for (day,) in days_list:
        total_score = db.query(func.coalesce(func.sum(Risk.score), 0)).scalar() or 0
        open_score = (
            db.query(func.coalesce(func.sum(Risk.score), 0))
            .filter(Risk.control_coverage_status != "COVERED")
            .scalar()
            or 0
        )
        pct = round((open_score / total_score) * 100, 2) if total_score > 0 else 0
        risk_trend.append({"date": str(day), "risk_exposure_pct": pct})

    # -----------------------------
    # COMPLIANCE READINESS TREND
    # -----------------------------
    total_risks = db.query(func.count(Risk.id)).scalar() or 0
    covered_risks = (
        db.query(func.count(Risk.id))
        .filter(Risk.control_coverage_status == "COVERED")
        .scalar()
        or 0
    )
    readiness_pct = round((covered_risks / total_risks) * 100, 2) if total_risks > 0 else 0

    if readiness_pct >= 80:
        audit_status = "READY"
    elif readiness_pct >= 40:
        audit_status = "PARTIALLY_READY"
    else:
        audit_status = "NOT_READY"

    return {
        "period_days": days,
        "evidence_approvals_daily": approvals_series,
        "risk_exposure_trend": risk_trend,
        "current": {
            "compliance_readiness_pct": readiness_pct,
            "audit_preparation_status": audit_status,
        },
    }
