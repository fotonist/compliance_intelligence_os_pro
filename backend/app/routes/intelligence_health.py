from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, select, text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.permission_checker import require_permission
from app.dependencies.scope_checker import require_tenant_scope
from app.models.user import User
from app.models.risks import Risk
from app.models.risk_forecasts import RiskForecast
from app.models.controls import Control
from app.services.exposure_engine import ExposureEngine


router = APIRouter(tags=["Intelligence Health"])

RESOLVED_GAP_STATUSES = {"resolved", "accepted", "closed", "cancelled", "archived"}
PARTIAL_GAP_STATUSES = {"in_progress", "in-progress", "partial", "partially_achieved"}


def _gap_status(value: Any) -> str:
    return str(value or "").strip().lower().replace(" ", "_")


def _is_resolved_gap(value: Any) -> bool:
    return _gap_status(value) in RESOLVED_GAP_STATUSES


def _is_partial_gap(value: Any) -> bool:
    return _gap_status(value) in PARTIAL_GAP_STATUSES


def _coverage_health(evidence_count: int, approved_files: int, total_files: int) -> tuple[float, str]:
    evidence_count = int(evidence_count or 0)
    approved_files = int(approved_files or 0)
    total_files = int(total_files or 0)
    if evidence_count <= 0:
        return 0.0, "No Evidence"
    if total_files > 0 and approved_files >= total_files:
        return 100.0, "Healthy"
    return 50.0, "Partial"


def _risk_level_rank(level: str | None) -> int:
    value = str(level or "").strip().lower()
    if value in {"critical", "very_high", "very high", "extreme"}:
        return 4
    if value in {"high", "major"}:
        return 3
    if value in {"medium", "moderate"}:
        return 2
    if value in {"low", "minor"}:
        return 1
    return 0


@router.get("/company/intelligence/gaps")
def get_gap_intelligence_fixed(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id

    stmt = text(
        """
        SELECT gi.id, gi.risk_id, gi.control_id, gi.severity_score, gi.status, gi.created_at,
               co.code AS control_code, co.title AS control_title,
               r.title AS risk_title, r.risk_level, r.score AS risk_score
        FROM gap_items gi
        LEFT JOIN controls co ON co.id = gi.control_id
           AND EXISTS (
               SELECT 1 FROM matrix_rows mr
               WHERE mr.control_id = co.id AND mr.tenant_id = :tenant_id
           )
        LEFT JOIN risks r ON r.id = gi.risk_id AND r.tenant_id = :tenant_id
        WHERE gi.tenant_id = :tenant_id
        ORDER BY gi.severity_score DESC NULLS LAST, gi.id DESC
        """
    )

    rows = db.execute(stmt, {"tenant_id": tenant_id}).mappings().all()

    if not rows:
        return {
            "summary": {
                "gaps_total": 0,
                "uncovered": 0,
                "partial": 0,
                "resolved": 0,
                "active_gaps": 0,
                "worst_severity_score": 0,
                "global_health_index": 100,
            },
            "controls": [],
            "trend": [],
        }

    uncovered = sum(
        1 for r in rows
        if not _is_resolved_gap(r.get("status"))
        and not _is_partial_gap(r.get("status"))
    )
    partial = sum(1 for r in rows if _is_partial_gap(r.get("status")))
    resolved = sum(1 for r in rows if _is_resolved_gap(r.get("status")))
    active_rows = [r for r in rows if not _is_resolved_gap(r.get("status"))]

    active_worst_severity = max(
        (float(r.get("severity_score") or 0.0) for r in active_rows),
        default=0.0,
    )
    global_health_index = round(
        max(0.0, min(100.0, 100.0 - active_worst_severity)),
        1,
    )

    control_map: Dict[int, Dict[str, Any]] = {}
    for row in rows:
        if _is_resolved_gap(row.get("status")):
            continue

        cid = row.get("control_id")
        if cid is None:
            continue

        control = control_map.setdefault(
            int(cid),
            {
                "control_id": int(cid),
                "control_code": row.get("control_code"),
                "control_title": row.get("control_title"),
                "gap_count": 0,
                "worst_severity": 0.0,
                "risks": {},
            },
        )

        severity = float(row.get("severity_score") or 0.0)
        control["gap_count"] += 1
        control["worst_severity"] = max(control["worst_severity"], severity)

        rid = row.get("risk_id")
        if rid is not None:
            risk = control["risks"].setdefault(
                int(rid),
                {
                    "risk_id": int(rid),
                    "risk_title": row.get("risk_title"),
                    "risk_level": row.get("risk_level"),
                    "exposure_score": float(row.get("risk_score") or 0.0),
                    "escalation_probability": 0.0,
                    "gap_count": 0,
                    "worst_severity": 0.0,
                    "gaps": [],
                },
            )
            risk["gap_count"] += 1
            risk["worst_severity"] = max(risk["worst_severity"], severity)
            risk["gaps"].append(
                {
                    "gap_id": int(row["id"]),
                    "severity_score": severity,
                    "status": row.get("status"),
                    "task_id": None,
                    "task_status": None,
                }
            )

    controls = []
    for control in control_map.values():
        risks = list(control["risks"].values())
        avg_exposure = (
            sum(float(r["exposure_score"]) for r in risks) / len(risks)
            if risks else 0.0
        )
        priority = round(
            float(control["worst_severity"]) * 0.55
            + avg_exposure * 0.35
            + float(control["gap_count"]) * 0.10,
            2,
        )
        controls.append(
            {
                "control_id": control["control_id"],
                "control_code": control["control_code"],
                "control_title": control["control_title"],
                "gap_count": control["gap_count"],
                "worst_severity": control["worst_severity"],
                "ai_priority_score": priority,
                "risks": risks,
            }
        )

    controls.sort(key=lambda x: x["ai_priority_score"], reverse=True)

    trend_stmt = text(
        """
        SELECT
            date_trunc('day', created_at) AS day,
            count(*) FILTER (
                WHERE lower(coalesce(status, '')) NOT IN
                ('resolved', 'accepted', 'closed', 'cancelled', 'archived')
            ) AS active_gap_count,
            count(*) FILTER (
                WHERE lower(coalesce(status, '')) IN
                ('in_progress', 'in-progress', 'partial', 'partially_achieved')
            ) AS partial_count,
            coalesce(
                max(severity_score) FILTER (
                    WHERE lower(coalesce(status, '')) NOT IN
                    ('resolved', 'accepted', 'closed', 'cancelled', 'archived')
                ),
                0
            ) AS worst_severity
        FROM gap_items
        WHERE tenant_id = :tenant_id
        GROUP BY day
        ORDER BY day
        """
    )
    trend_rows = db.execute(trend_stmt, {"tenant_id": tenant_id}).mappings().all()

    return {
        "summary": {
            "gaps_total": len(rows),
            "active_gaps": len(active_rows),
            "uncovered": uncovered,
            "partial": partial,
            "resolved": resolved,
            "worst_severity_score": active_worst_severity,
            "global_health_index": global_health_index,
        },
        "controls": controls,
        "trend": [
            {
                "day": r["day"].isoformat() if r.get("day") else None,
                "gap_count": int(r.get("active_gap_count") or 0),
                "partial_count": int(r.get("partial_count") or 0),
                "worst_severity": float(r.get("worst_severity") or 0.0),
                "health_index": round(
                    max(0.0, min(100.0, 100.0 - float(r.get("worst_severity") or 0.0))),
                    1,
                ),
            }
            for r in trend_rows
        ],
    }


@router.get("/company/intelligence/gaps/trend")
def get_gap_trend_fixed(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id
    rows = db.execute(
        text(
            """
            SELECT
                date_trunc('day', created_at) AS day,
                count(*) FILTER (
                    WHERE lower(coalesce(status, '')) NOT IN
                    ('resolved', 'accepted', 'closed', 'cancelled', 'archived')
                ) AS gap_count,
                count(*) FILTER (
                    WHERE lower(coalesce(status, '')) IN
                    ('in_progress', 'in-progress', 'partial', 'partially_achieved')
                ) AS partial_count,
                sum(
                    CASE
                        WHEN lower(coalesce(status, '')) NOT IN
                        ('resolved', 'accepted', 'closed', 'cancelled', 'archived')
                        THEN 1
                        ELSE 0
                    END
                ) AS active_gap_count,
                max(severity_score) FILTER (
                    WHERE lower(coalesce(status, '')) NOT IN
                    ('resolved', 'accepted', 'closed', 'cancelled', 'archived')
                ) AS worst_severity,
                avg(severity_score) FILTER (
                    WHERE lower(coalesce(status, '')) NOT IN
                    ('resolved', 'accepted', 'closed', 'cancelled', 'archived')
                ) AS avg_severity
            FROM gap_items
            WHERE tenant_id = :tenant_id
            GROUP BY day
            ORDER BY day
            """
        ),
        {"tenant_id": tenant_id},
    ).mappings().all()

    return [
        {
            "day": r["day"].isoformat() if r.get("day") else None,
            "gap_count": int(r.get("active_gap_count") or 0),
            "partial_count": int(r.get("partial_count") or 0),
            "uncovered_count": max(
                0,
                int(r.get("active_gap_count") or 0)
                - int(r.get("partial_count") or 0),
            ),
            "avg_severity": float(r.get("avg_severity") or 0.0),
            "health_index": round(
                max(
                    0.0,
                    min(100.0, 100.0 - float(r.get("worst_severity") or 0.0)),
                ),
                1,
            ),
        }
        for r in rows
    ]


@router.get("/api/intelligence/control-health")
@router.get("/company/intelligence/control-health")
def get_control_health_fixed(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id
    stmt = text(
        """
        SELECT
            c.id AS control_id,
            c.code AS control_code,
            c.title AS control_title,
            coalesce(g.gap_count, 0) AS gap_count,
            coalesce(g.worst_severity, 0) AS worst_severity,
            coalesce(r.risk_count, 0) AS risk_count,
            coalesce(e.evidence_count, 0) AS evidence_count,
            coalesce(e.total_files, 0) AS total_files,
            coalesce(e.approved_files, 0) AS approved_files
        FROM controls c
        INNER JOIN (
            SELECT DISTINCT control_id
            FROM matrix_rows
            WHERE tenant_id = :tenant_id AND control_id IS NOT NULL
        ) mc ON mc.control_id = c.id
        LEFT JOIN (
            SELECT
                control_id,
                count(*) FILTER (
                    WHERE lower(coalesce(status, '')) NOT IN
                    ('resolved', 'accepted', 'closed', 'cancelled', 'archived')
                ) AS gap_count,
                coalesce(
                    max(severity_score) FILTER (
                        WHERE lower(coalesce(status, '')) NOT IN
                        ('resolved', 'accepted', 'closed', 'cancelled', 'archived')
                    ),
                    0
                ) AS worst_severity
            FROM gap_items
            WHERE tenant_id = :tenant_id
            GROUP BY control_id
        ) g ON g.control_id = c.id
        LEFT JOIN (
            SELECT control_id, count(*) AS risk_count
            FROM risks
            WHERE tenant_id = :tenant_id AND control_id IS NOT NULL
            GROUP BY control_id
        ) r ON r.control_id = c.id
        LEFT JOIN (
            SELECT
                e.control_id,
                count(DISTINCT e.id) AS evidence_count,
                count(ef.id) AS total_files,
                count(ef.id) FILTER (
                    WHERE lower(coalesce(ef.status, '')) = 'approved'
                ) AS approved_files
            FROM evidences e
            LEFT JOIN evidence_files ef ON ef.evidence_id = e.id
            WHERE e.tenant_id = :tenant_id
              AND coalesce(e.is_deleted, false) = false
              AND e.control_id IS NOT NULL
            GROUP BY e.control_id
        ) e ON e.control_id = c.id
        ORDER BY c.code NULLS LAST, c.id
        """
    )
    rows = db.execute(stmt, {"tenant_id": tenant_id}).mappings().all()
    controls: List[Dict[str, Any]] = []
    counts = {"Healthy": 0, "Partial": 0, "Weak": 0, "No Evidence": 0}

    for row in rows:
        health, status = _coverage_health(
            int(row.get("evidence_count") or 0),
            int(row.get("approved_files") or 0),
            int(row.get("total_files") or 0),
        )
        counts[status] += 1
        controls.append(
            {
                "control_id": int(row["control_id"]),
                "control_code": row.get("control_code"),
                "control_title": row.get("control_title"),
                "health_index": health,
                "status": status,
                "gap_count": int(row.get("gap_count") or 0),
                "worst_severity": float(row.get("worst_severity") or 0.0),
                "risk_count": int(row.get("risk_count") or 0),
                "evidence_count": int(row.get("evidence_count") or 0),
                "total_files": int(row.get("total_files") or 0),
                "approved_files": int(row.get("approved_files") or 0),
            }
        )

    total = len(controls)
    avg_health = (
        round(sum(c["health_index"] for c in controls) / total, 1)
        if total
        else 0.0
    )

    return {
        "summary": {
            "total_controls": total,
            "healthy_controls": counts["Healthy"],
            "partial_controls": counts["Partial"],
            "weak_controls": counts["Weak"],
            "no_evidence_controls": counts["No Evidence"],
            "average_health": avg_health,
        },
        "controls": controls,
    }


@router.get("/company/intelligence/risk-overview")
def get_risk_intelligence_overview(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id

    total_risks = int(
        db.execute(
            select(func.count(Risk.id)).where(Risk.tenant_id == tenant_id)
        ).scalar_one()
        or 0
    )
    open_risks = int(
        db.execute(
            text(
                """
                SELECT count(*) FROM risks
                WHERE tenant_id = :tenant_id
                  AND lower(coalesce(status, '')) NOT IN
                      ('closed', 'resolved', 'cancelled', 'archived')
                """
            ),
            {"tenant_id": tenant_id},
        ).scalar()
        or 0
    )

    subq = (
        select(
            RiskForecast.risk_id.label("risk_id"),
            func.max(RiskForecast.created_at).label("max_created_at"),
        )
        .where(RiskForecast.tenant_id == tenant_id)
        .group_by(RiskForecast.risk_id)
        .subquery()
    )
    stmt = (
        select(RiskForecast, Risk, Control)
        .join(
            subq,
            and_(
                RiskForecast.risk_id == subq.c.risk_id,
                RiskForecast.created_at == subq.c.max_created_at,
            ),
        )
        .join(
            Risk,
            and_(Risk.id == RiskForecast.risk_id, Risk.tenant_id == tenant_id),
        )
        .outerjoin(Control, Control.id == Risk.control_id)
        .where(RiskForecast.tenant_id == tenant_id)
    )
    rows = db.execute(stmt).all()

    exposure_by_risk: Dict[int, float] = {}
    try:
        for item in ExposureEngine(db).compute_risk_exposure(
            tenant_id=tenant_id,
            limit=1000000,
        ):
            exposure_by_risk[int(item.risk_id)] = float(
                item.unified_score or item.residual_exposure or 0.0
            )
    except Exception:
        exposure_by_risk = {}

    scored = []
    prob_sum = 0.0
    delta_sum = 0.0
    high_probability = 0

    for forecast, risk, control in rows:
        prob = float(forecast.escalation_probability_30d or 0.0)
        delta = float(forecast.expected_score_delta or 0.0)
        prob_sum += prob
        delta_sum += delta
        if prob >= 0.70:
            high_probability += 1
        scored.append(
            (
                exposure_by_risk.get(int(risk.id), prob),
                forecast,
                risk,
                control,
            )
        )

    scored.sort(key=lambda x: x[0], reverse=True)

    forecasted = len(rows)
    top_risks = []
    for _, forecast, risk, control in scored[:50]:
        top_risks.append(
            {
                "risk_id": int(risk.id),
                "title": risk.title,
                "current_score": risk.score,
                "risk_level": risk.risk_level,
                "status": risk.status,
                "escalation_probability_30d": float(
                    forecast.escalation_probability_30d or 0.0
                ),
                "expected_score_delta": float(forecast.expected_score_delta or 0.0),
                "control_code": getattr(control, "code", None) if control else None,
                "process_names": [],
            }
        )

    avg_prob = prob_sum / forecasted if forecasted else 0.0
    avg_delta = delta_sum / forecasted if forecasted else 0.0
    executive_alerts = [
        r
        for r in top_risks
        if float(r["escalation_probability_30d"] or 0.0) >= 0.80
        and _risk_level_rank(r.get("risk_level")) >= 3
    ][:10]

    return {
        "summary": {
            "total_risks": total_risks,
            "open_risks": open_risks,
            "forecasted_risks": forecasted,
            "high_probability_risks": high_probability,
            "avg_escalation_probability": avg_prob,
            "avg_expected_score_delta": avg_delta,
        },
        "top_risks": top_risks,
        "executive_alerts": executive_alerts,
    }
