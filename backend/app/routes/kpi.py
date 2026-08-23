from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Dict, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text, func, cast, String
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.services.uee_engine import UEEEngine
from app.models.audit_log import AuditLog
from app.models.risks import Risk


router = APIRouter(prefix="/kpi", tags=["KPI"])


def _get_uee_state(db: Session, tenant_id: int):
    engine = UEEEngine()
    return engine.compute_summary(db=db, tenant_id=tenant_id)


# =====================================================
# STRATEGIC KPI Ã¢â‚¬â€œ TENANT SAFE UEE
# =====================================================

@router.get("/summary")
def kpi_summary(
    tenant_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Canonical strategic KPI endpoint.

    The authenticated user's tenant is always the source of truth.
    A tenant_id query parameter is accepted only for backward compatibility
    and is never allowed to override the authenticated tenant.

    The UEE engine stores component indices as exposure/pressure values
    (higher is worse). The public KPI `indices` contract is health-oriented
    because Company Home and executive dashboards display these as health,
    coverage and strength percentages. Raw exposure values remain available
    under `exposure_indices` and `components`.
    """
    authenticated_tenant_id = getattr(user, "tenant_id", None)
    if not authenticated_tenant_id:
        raise ValueError("Authenticated user has no tenant_id")

    state = _get_uee_state(db, authenticated_tenant_id)

    exposure_indices = {
        "risk": state.risk_index,
        "coverage": state.coverage_index,
        "maturity": state.maturity_index,
        "evidence": state.evidence_index,
        "task_pressure": state.task_pressure_index,
    }

    health_indices = {
        name: max(0.0, min(100.0, 100.0 - value))
        for name, value in exposure_indices.items()
    }

    return {
        "tenant_id": state.tenant_id,
        "computed_at": state.computed_at.isoformat(),
        "indices": health_indices,
        "exposure_indices": exposure_indices,
        "unified_exposure_score": state.unified_exposure_score,
        "compliance_health_index": state.compliance_health_index,
        "weights": state.weights,
        "components": state.components,
        "source_stats": state.source_stats,
        "warnings": list(state.warnings),
    }


@router.get("/summary/status")
def kpi_summary_status(
    tenant_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    authenticated_tenant_id = getattr(user, "tenant_id", None)
    if not authenticated_tenant_id:
        raise ValueError("Authenticated user has no tenant_id")

    state = _get_uee_state(db, authenticated_tenant_id)

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
            "exposure_status": classify_low_good(
                state.unified_exposure_score,
                ok=25,
                warn=50,
            ),
            "health_status": classify_high_good(
                state.compliance_health_index,
                ok=75,
                warn=50,
            ),
        }
    }


# =====================================================
# COMPANY HOME TREND Ã¢â‚¬â€œ TENANT SAFE
# =====================================================

@router.get("/trends")
def kpi_trends(
    days: int = Query(180, ge=1, le=3650),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Return tenant-scoped strategic trend data used by Company Home."""
    tenant_id = getattr(user, "tenant_id", None)
    if not tenant_id:
        raise ValueError("Authenticated user has no tenant_id")

    since = datetime.now(timezone.utc) - timedelta(days=days)

    approvals = (
        db.query(
            func.date(AuditLog.created_at).label("day"),
            func.count(AuditLog.id).label("count"),
        )
        .filter(
            AuditLog.entity_type == "Evidence",
            AuditLog.action == "STATUS_CHANGE",
            cast(AuditLog.new_value["status"], String).in_(["Approved", "APPROVED"]),
            AuditLog.created_at >= since,
        )
        .group_by(func.date(AuditLog.created_at))
        .order_by(func.date(AuditLog.created_at))
        .all()
    )

    state = _get_uee_state(db, tenant_id)
    risk_exposure = round(float(state.risk_index), 2)

    approval_days = [
        {"date": str(row.day), "count": int(row.count)}
        for row in approvals
    ]

    # There is no legitimate historical risk series unless historical risk
    # snapshots exist. Do not manufacture one. Expose the current tenant-scoped
    # UEE risk exposure as today's point instead.
    today = datetime.now(timezone.utc).date().isoformat()
    risk_trend = [{"date": today, "risk_exposure_pct": risk_exposure}]

    return {
        "period_days": days,
        "evidence_approvals_daily": approval_days,
        "risk_exposure_trend": risk_trend,
        "current": {
            "risk_exposure_pct": risk_exposure,
            "total_risks": state.source_stats.get("risk", {}).get("row_count", 0),
        },
    }


# =====================================================
# OPERATIONAL KPI Ã¢â‚¬â€œ MTTR
# =====================================================

@router.get("/operations/mttr-trend")
def mttr_trend(
    range: int = Query(30),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text("""
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
        SELECT DATE(fa.approved_at) AS date,
               AVG(EXTRACT(EPOCH FROM (fa.approved_at - fr.rejected_at)) / 3600) AS avg_hours
        FROM fr
        JOIN fa ON fa.evidence_id = fr.evidence_id
        WHERE fa.approved_at >= NOW() - (:range || ' days')::interval
        GROUP BY DATE(fa.approved_at)
        ORDER BY DATE(fa.approved_at)
        """),
        {"range": range},
    ).mappings().all()
    return rows


# =====================================================
# OPERATIONAL KPI Ã¢â‚¬â€œ MTTR DETAILS
# =====================================================

@router.get("/operations/mttr-details")
def mttr_details(db: Session = Depends(get_db)):
    rows = db.execute(
        text("""
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
        SELECT fr.evidence_id,
               fr.rejected_at,
               fa.approved_at,
               EXTRACT(EPOCH FROM (fa.approved_at - fr.rejected_at)) / 3600 AS recovery_hours
        FROM fr
        JOIN fa ON fa.evidence_id = fr.evidence_id
        ORDER BY recovery_hours DESC
        """)
    ).mappings().all()
    return rows


# =====================================================
# OPERATIONAL KPI Ã¢â‚¬â€œ REJECTED TREND
# =====================================================

@router.get("/operations/rejected-trend")
def rejected_trend(
    range: int = Query(30),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text("""
        SELECT DATE(rejected_at) AS date,
               COUNT(*) AS rejected_count
        FROM evidence_files
        WHERE rejected_at >= NOW() - (:range || ' days')::interval
        GROUP BY DATE(rejected_at)
        ORDER BY DATE(rejected_at)
        """),
        {"range": range},
    ).mappings().all()
    return rows


# =====================================================
# OPERATIONAL KPI Ã¢â‚¬â€œ PENDING AGING
# =====================================================

@router.get("/operations/pending-aging")
def pending_aging(db: Session = Depends(get_db)):
    row = db.execute(
        text("""
        SELECT
          AVG(DATE_PART('day', NOW() - created_at)) AS avg_days,
          MAX(DATE_PART('day', NOW() - created_at)) AS oldest_days
        FROM evidences
        WHERE status IN ('pending','uploaded','under_review')
        """)
    ).mappings().first()

    return {
        "avg_days": float(row["avg_days"] or 0),
        "oldest_days": int(row["oldest_days"] or 0),
    }
