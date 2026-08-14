from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.permission_checker import require_permission
from app.dependencies.scope_checker import require_tenant_scope
from app.models.user import User


router = APIRouter(tags=["Intelligence Health"])


def _severity_health(severity: float, gaps: int, risks: int, evidence: int) -> float:
    score = 100.0
    score -= min(float(severity) * 1.5, 60.0)
    score -= min(float(gaps) * 8.0, 25.0)
    score -= min(float(risks) * 3.0, 15.0)
    if evidence <= 0:
        score -= 20.0
    return round(max(0.0, min(100.0, score)), 1)


def _health_status(health: float, evidence: int) -> str:
    if evidence == 0:
        return "No Evidence"
    if health >= 80:
        return "Healthy"
    if health >= 55:
        return "Partial"
    return "Weak"


@router.get("/company/intelligence/gaps")
def get_gap_intelligence_fixed(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id

    # Keep the GAP read path schema-safe.  GAP Intelligence must not depend on
    # optional task source-tracking columns just to render the dashboard.
    stmt = text(
        """
        SELECT
            gi.id,
            gi.risk_id,
            gi.control_id,
            gi.severity_score,
            gi.status,
            gi.created_at,
            co.code AS control_code,
            co.title AS control_title,
            r.title AS risk_title,
            r.risk_level,
            r.score AS risk_score
        FROM gap_items gi
        LEFT JOIN controls co
            ON co.id = gi.control_id
           AND co.tenant_id = :tenant_id
        LEFT JOIN risks r
            ON r.id = gi.risk_id
           AND r.tenant_id = :tenant_id
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
                "worst_severity_score": 0,
            },
            "controls": [],
            "trend": [],
        }

    control_map: Dict[int, Dict[str, Any]] = {}

    for row in rows:
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

    total = len(rows)
    uncovered = sum(1 for r in rows if str(r.get("status") or "").lower() == "open")
    partial = sum(1 for r in rows if str(r.get("status") or "").lower() == "in_progress")
    worst = max(float(r.get("severity_score") or 0.0) for r in rows)

    trend_stmt = text(
        """
        SELECT
            date_trunc('day', created_at) AS day,
            count(*) AS gap_count,
            coalesce(max(severity_score), 0) AS worst_severity
        FROM gap_items
        WHERE tenant_id = :tenant_id
        GROUP BY day
        ORDER BY day
        """
    )
    trend_rows = db.execute(trend_stmt, {"tenant_id": tenant_id}).mappings().all()
    trend = []
    for row in trend_rows:
        gap_count = int(row.get("gap_count") or 0)
        worst_severity = float(row.get("worst_severity") or 0.0)
        trend.append(
            {
                "day": row["day"].isoformat() if row.get("day") else None,
                "gap_count": gap_count,
                "worst_severity": worst_severity,
                "health_index": round(max(0.0, 100.0 - gap_count * 2.0 - worst_severity * 0.5), 1),
            }
        )

    return {
        "summary": {
            "gaps_total": total,
            "uncovered": uncovered,
            "partial": partial,
            "worst_severity_score": worst,
        },
        "controls": controls,
        "trend": trend,
    }


@router.get("/company/intelligence/gaps/trend")
def get_gap_trend_fixed(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id
    stmt = text(
        """
        SELECT
            date_trunc('day', created_at) AS day,
            count(*) AS gap_count,
            sum(CASE WHEN lower(status) = 'open' THEN 1 ELSE 0 END) AS uncovered_count,
            avg(severity_score) AS avg_severity
        FROM gap_items
        WHERE tenant_id = :tenant_id
        GROUP BY day
        ORDER BY day
        """
    )
    rows = db.execute(stmt, {"tenant_id": tenant_id}).mappings().all()
    return [
        {
            "day": r["day"].isoformat() if r.get("day") else None,
            "gap_count": int(r.get("gap_count") or 0),
            "uncovered_count": int(r.get("uncovered_count") or 0),
            "avg_severity": float(r.get("avg_severity") or 0.0),
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
            coalesce(e.evidence_count, 0) AS evidence_count
        FROM controls c
        LEFT JOIN (
            SELECT control_id, count(*) AS gap_count, max(severity_score) AS worst_severity
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
            SELECT control_id, count(*) AS evidence_count
            FROM evidences
            WHERE tenant_id = :tenant_id
              AND coalesce(is_deleted, false) = false
              AND control_id IS NOT NULL
            GROUP BY control_id
        ) e ON e.control_id = c.id
        WHERE c.tenant_id = :tenant_id
        ORDER BY c.code NULLS LAST, c.id
        """
    )

    rows = db.execute(stmt, {"tenant_id": tenant_id}).mappings().all()

    controls: List[Dict[str, Any]] = []
    counts = {"Healthy": 0, "Partial": 0, "Weak": 0, "No Evidence": 0}

    for row in rows:
        health = _severity_health(
            float(row.get("worst_severity") or 0.0),
            int(row.get("gap_count") or 0),
            int(row.get("risk_count") or 0),
            int(row.get("evidence_count") or 0),
        )
        status = _health_status(health, int(row.get("evidence_count") or 0))
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
            }
        )

    total = len(controls)
    avg_health = round(sum(c["health_index"] for c in controls) / total, 1) if total else 0.0

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
