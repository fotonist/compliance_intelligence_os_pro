from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.ai_audit_log import AIAuditLog

# 🔐 AUTH / ACCESS LAYER
from app.dependencies.permission_checker import require_permission
from app.dependencies.scope_checker import require_tenant_scope
from app.dependencies.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/ai", tags=["AI"])


@router.post("/dashboard/insights")
def ai_dashboard_insights(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("executive.view")),
    scope=Depends(require_tenant_scope()),
):
    """
    Deterministic AI-like dashboard insights based on KPI values.
    Enterprise protected:
        - Permission: executive.view
        - Scope: tenant-wide only
    """

    kpis = payload.get("kpis", {})
    meta = payload.get("meta", {})

    # ---- Extract KPI values ----
    compliance = float(kpis.get("compliance_percentage", 0))
    mttr = float(kpis.get("mttr", {}).get("avg_hours", 0))

    evidence = kpis.get("evidence", {})
    not_completed = int(evidence.get("not_completed", 0))
    completed = int(evidence.get("completed", 0))
    total_evidence = int(evidence.get("total", 0))

    recovery = kpis.get("recovery", {})
    ever_rejected = int(recovery.get("ever_rejected", 0))
    recovered = int(recovery.get("recovered", 0))

    summary_parts: List[str] = []
    root_causes: List[str] = []
    warnings: List[str] = []
    actions: List[str] = []

    # ---- Compliance analysis ----
    if compliance < 50:
        summary_parts.append(
            "Overall compliance level is critically low and poses a significant audit risk."
        )
        warnings.append(f"Compliance rate is {compliance:.1f}%.")
        actions.append("Immediately prioritize completion of mandatory evidences.")
    elif compliance < 70:
        summary_parts.append(
            "Compliance level is below recommended thresholds and requires attention."
        )
        warnings.append(f"Compliance rate is {compliance:.1f}%.")
        actions.append("Accelerate evidence completion activities.")

    # ---- Evidence completion ----
    if not_completed > 0:
        root_causes.append(
            f"{not_completed} out of {total_evidence} evidences are not completed."
        )

    if completed == 0 and total_evidence > 0:
        warnings.append("No evidences have been completed yet.")
        actions.append("Review evidence ownership and accountability.")

    # ---- MTTR analysis ----
    if mttr > 72:
        summary_parts.append(
            "Mean Time To Recovery significantly exceeds defined SLA limits."
        )
        warnings.append(f"Average MTTR is {mttr:.1f} hours.")
        actions.append("Investigate delays in evidence approval and recovery workflow.")
    elif mttr > 48:
        warnings.append(f"MTTR is above target threshold ({mttr:.1f} hours).")
        actions.append("Optimize evidence remediation process to reduce MTTR.")

    # ---- Recovery effectiveness ----
    if ever_rejected > 0 and recovered == 0:
        root_causes.append("Rejected evidences have not been recovered.")
        warnings.append("No rejected evidences have been successfully recovered.")
        actions.append("Review rejection reasons and enforce corrective action tracking.")

    # ---- Fallback ----
    if not summary_parts:
        summary_parts.append(
            "All key compliance indicators are within acceptable operational thresholds."
        )

    result = {
        "summary": " ".join(summary_parts),
        "root_causes": root_causes,
        "warnings": warnings,
        "actions": actions,
    }

    # ---- AUDIT LOG WRITE ----
    log = AIAuditLog(
        scope="dashboard",
        summary=result["summary"],
        root_causes=result["root_causes"],
        warnings=result["warnings"],
        actions=result["actions"],
        kpi_snapshot={
            "kpis": kpis,
            "meta": meta,
        },
        user_id=user.id,
    )
    db.add(log)
    db.commit()

    return result


@router.get("/audit-logs")
def list_ai_audit_logs(
    scope: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("forecast.view")),
    tenant_scope=Depends(require_tenant_scope()),
):
    """
    List AI audit logs.
    Restricted:
        - Permission: forecast.view (Board only)
        - Scope: tenant-wide
    """

    q = db.query(AIAuditLog)

    if scope:
        q = q.filter(AIAuditLog.scope == scope)

    total = q.count()

    rows = (
        q.order_by(AIAuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "items": [
            {
                "id": r.id,
                "scope": r.scope,
                "summary": r.summary,
                "root_causes": r.root_causes,
                "warnings": r.warnings,
                "actions": r.actions,
                "kpi_snapshot": r.kpi_snapshot,
                "user_id": r.user_id,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.get("/audit-logs/{log_id}")
def get_ai_audit_log_detail(
    log_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("forecast.view")),
    tenant_scope=Depends(require_tenant_scope()),
):
    log = (
        db.query(AIAuditLog)
        .filter(AIAuditLog.id == log_id)
        .first()
    )

    if not log:
        raise HTTPException(
            status_code=404,
            detail="AI audit log not found"
        )

    return {
        "id": log.id,
        "scope": log.scope,
        "summary": log.summary,
        "root_causes": log.root_causes,
        "warnings": log.warnings,
        "actions": log.actions,
        "kpi_snapshot": log.kpi_snapshot,
        "user_id": log.user_id,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }