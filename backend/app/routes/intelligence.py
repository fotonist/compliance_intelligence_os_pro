from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query, HTTPException, Body
from sqlalchemy import and_, func, select, text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.dependencies.permission_checker import require_permission
from app.dependencies.scope_checker import require_tenant_scope
from app.models.risks import Risk
from app.models.risk_forecasts import RiskForecast
from app.models.controls import Control
from app.models.process_risk_link import ProcessRiskLink
from app.models.process import Process
from app.services.exposure_engine import ExposureEngine
from app.schemas.intelligence_schema import (
    IntelligenceExecutiveAlert,
    IntelligenceOverviewResponse,
    IntelligenceSummary,
    IntelligenceTopControl,
    IntelligenceTopRisk,
)

router = APIRouter(prefix="/company/intelligence", tags=["Company", "Intelligence"])
api_router = APIRouter(prefix="/api/intelligence", tags=["API", "Intelligence"])


def _risk_level_rank(level: Optional[str]) -> int:
    if not level:
        return 0
    s = level.strip().lower()
    if s in {"critical", "very_high", "very high", "extreme"}:
        return 4
    if s in {"high", "major"}:
        return 3
    if s in {"medium", "moderate"}:
        return 2
    if s in {"low", "minor"}:
        return 1
    return 0


def _normalize_expected_delta(x: Optional[float]) -> float:
    if x is None:
        return 0.0
    try:
        v = float(x)
    except Exception:
        return 0.0
    return max(-10.0, min(10.0, v)) / 10.0


def _risk_ai_priority(prob: float, expected_delta: float) -> float:
    return (float(prob) * 70.0) + (_normalize_expected_delta(expected_delta) * 30.0)


def _rows_to_dicts(result) -> List[Dict[str, Any]]:
    return [dict(r) for r in result.mappings().all()]


def _control_ai_priority(worst_severity: float, avg_exposure: float, avg_escalation: float, gap_count: int) -> float:
    score = (
        (float(worst_severity or 0.0) * 0.40)
        + (float(avg_exposure or 0.0) * 0.30)
        + ((float(avg_escalation or 0.0) * 100.0) * 0.20)
        + (int(gap_count or 0) * 0.10)
    )
    return round(score, 2)


@router.get("/overview", response_model=IntelligenceOverviewResponse)
def get_intelligence_overview(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("executive.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id

    # Latest forecast per risk. Risks without a forecast remain part of the risk universe
    # and are still counted as open when their current status is OPEN.
    subq = (
        select(
            RiskForecast.risk_id.label("risk_id"),
            func.max(RiskForecast.created_at).label("max_created_at"),
        )
        .where(RiskForecast.tenant_id == tenant_id)
        .group_by(RiskForecast.risk_id)
        .subquery()
    )

    latest_stmt = (
        select(RiskForecast, Risk, Control)
        .join(
            subq,
            and_(
                RiskForecast.risk_id == subq.c.risk_id,
                RiskForecast.created_at == subq.c.max_created_at,
            ),
        )
        .join(Risk, and_(Risk.id == RiskForecast.risk_id, Risk.tenant_id == tenant_id))
        .outerjoin(Control, Control.id == Risk.control_id)
        .where(RiskForecast.tenant_id == tenant_id)
    )
    latest_rows = db.execute(latest_stmt).all()

    # Process map: risk -> tenant-scoped process links.
    risk_ids = [int(risk.id) for (_f, risk, _c) in latest_rows]
    process_map: Dict[int, Dict[str, Any]] = defaultdict(lambda: {"ids": [], "names": []})

    if risk_ids:
        pr_stmt = (
            select(ProcessRiskLink.risk_id, Process.id, Process.name)
            .select_from(ProcessRiskLink)
            .join(Process, Process.id == ProcessRiskLink.process_id)
            .where(
                ProcessRiskLink.tenant_id == tenant_id,
                ProcessRiskLink.risk_id.in_(risk_ids),
                Process.tenant_id == tenant_id,
            )
        )
        for rid, pid, pname in db.execute(pr_stmt).all():
            rid_int = int(rid)
            if int(pid) not in process_map[rid_int]["ids"]:
                process_map[rid_int]["ids"].append(int(pid))
            if pname and pname not in process_map[rid_int]["names"]:
                process_map[rid_int]["names"].append(pname)

    # Phase-2 Exposure Engine.
    exposure_by_risk_id: Dict[int, float] = {}
    unified_by_risk_id: Dict[int, float] = {}
    try:
        engine_rows = ExposureEngine(db).compute_risk_exposure(tenant_id=tenant_id, limit=1000000)
        for row in engine_rows:
            exposure_by_risk_id[int(row.risk_id)] = float(row.residual_exposure or 0.0)
            unified_by_risk_id[int(row.risk_id)] = float(row.unified_score or 0.0)
    except Exception:
        exposure_by_risk_id = {}
        unified_by_risk_id = {}

    # Risk universe and open-risk metrics must be calculated independently of forecast
    # availability. This prevents forecast sparsity from making Open Risks appear as 0.
    total_risks = int(
        db.execute(select(func.count(Risk.id)).where(Risk.tenant_id == tenant_id)).scalar_one() or 0
    )
    open_risks = int(
        db.execute(
            select(func.count(Risk.id)).where(
                Risk.tenant_id == tenant_id,
                func.lower(func.trim(Risk.status)) == "open",
            )
        ).scalar_one() or 0
    )

    forecasted_risks = len(latest_rows)
    high_prob_cnt = 0
    exec_alert_cnt = 0
    prob_sum = 0.0
    delta_sum = 0.0

    for f, r, _c in latest_rows:
        p = float(f.escalation_probability_30d or 0.0)
        d = float(f.expected_score_delta or 0.0)
        prob_sum += p
        delta_sum += d
        if p >= 0.70:
            high_prob_cnt += 1
        exposure = float(exposure_by_risk_id.get(int(r.id), 0.0))
        if p >= 0.80 and exposure > 0.0 and _risk_level_rank(getattr(r, "risk_level", None)) >= 3:
            exec_alert_cnt += 1

    avg_prob = prob_sum / forecasted_risks if forecasted_risks else 0.0
    avg_delta = delta_sum / forecasted_risks if forecasted_risks else 0.0

    summary = IntelligenceSummary(
        total_risks=total_risks,
        open_risks=open_risks,
        forecasted_risks=int(forecasted_risks),
        high_probability_risks=int(high_prob_cnt),
        executive_alerts=int(exec_alert_cnt),
        avg_escalation_probability=float(avg_prob),
        avg_expected_score_delta=float(avg_delta),
    )

    scored_rows = []
    for f, r, c in latest_rows:
        rid = int(r.id)
        prob = float(f.escalation_probability_30d or 0.0)
        unified = float(unified_by_risk_id.get(rid, 0.0)) or prob
        exposure = float(exposure_by_risk_id.get(rid, 0.0))
        scored_rows.append((unified, exposure, f, r, c))
    scored_rows.sort(key=lambda t: float(t[0]), reverse=True)

    top_risks: List[IntelligenceTopRisk] = []
    for _unified, _exposure, f, r, c in scored_rows:
        rid = int(r.id)
        pm = process_map.get(rid, {"ids": [], "names": []})
        top_risks.append(
            IntelligenceTopRisk(
                risk_id=rid,
                title=getattr(r, "title", None),
                current_score=getattr(r, "score", None),
                risk_level=getattr(r, "risk_level", None),
                status=getattr(r, "status", None),
                escalation_probability_30d=float(f.escalation_probability_30d or 0.0),
                expected_score_delta=float(f.expected_score_delta or 0.0),
                model_version=getattr(f, "model_version", None),
                forecast_created_at=getattr(f, "created_at", None),
                control_id=getattr(r, "control_id", None),
                control_code=getattr(c, "code", None) if c else None,
                control_title=getattr(c, "title", None) if c else None,
                process_ids=list(pm["ids"]),
                process_names=list(pm["names"]),
            )
        )

    control_agg: Dict[int, Dict[str, Any]] = {}
    for unified, _exposure, f, r, c in scored_rows:
        cid = getattr(r, "control_id", None)
        if cid is None:
            continue
        prob = float(f.escalation_probability_30d or 0.0)
        delta = float(f.expected_score_delta or 0.0)
        node = control_agg.setdefault(
            int(cid),
            {
                "control_id": int(cid),
                "control_code": getattr(c, "code", None) if c else None,
                "control_title": getattr(c, "title", None) if c else None,
                "risk_count": 0,
                "prob_sum": 0.0,
                "prob_max": 0.0,
                "delta_sum": 0.0,
                "unified_sum": 0.0,
            },
        )
        node["risk_count"] += 1
        node["prob_sum"] += prob
        node["prob_max"] = max(node["prob_max"], prob)
        node["delta_sum"] += delta
        node["unified_sum"] += float(unified)

    top_controls_list = []
    for node in control_agg.values():
        rc = int(node["risk_count"])
        avg_p = node["prob_sum"] / rc if rc else 0.0
        top_controls_list.append(
            IntelligenceTopControl(
                control_id=int(node["control_id"]),
                control_code=node.get("control_code"),
                control_title=node.get("control_title"),
                risk_count=rc,
                avg_escalation_probability=float(avg_p),
                max_escalation_probability=float(node["prob_max"]),
                expected_score_delta_sum=float(node["delta_sum"]),
                ai_priority_score=float(node["unified_sum"]),
            )
        )
    top_controls = sorted(top_controls_list, key=lambda x: x.ai_priority_score, reverse=True)[:10]

    exec_alerts: List[IntelligenceExecutiveAlert] = []
    for unified, exposure, f, r, c in scored_rows:
        prob = float(f.escalation_probability_30d or 0.0)
        if exposure <= 0:
            if prob < 0.80 or _risk_level_rank(getattr(r, "risk_level", None)) < 3:
                continue
        elif prob < 0.75 or exposure < 15:
            continue
        rid = int(r.id)
        pm = process_map.get(rid, {"ids": [], "names": []})
        exec_alerts.append(
            IntelligenceExecutiveAlert(
                risk_id=rid,
                title=getattr(r, "title", None),
                current_score=getattr(r, "score", None),
                risk_level=getattr(r, "risk_level", None),
                escalation_probability_30d=prob,
                expected_score_delta=float(f.expected_score_delta or 0.0),
                control_id=getattr(r, "control_id", None),
                control_code=getattr(c, "code", None) if c else None,
                process_names=list(pm["names"]),
            )
        )
    exec_alerts = sorted(exec_alerts, key=lambda x: x.escalation_probability_30d, reverse=True)[:10]

    return IntelligenceOverviewResponse(
        summary=summary,
        top_risks=top_risks,
        top_controls=top_controls,
        executive_alerts=exec_alerts,
    )


@router.get("/dashboard")
def get_intelligence_dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("executive.dashboard")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id
    row = db.execute(
        text(
            "SELECT * FROM analytics.v_dashboard_summary "
            "WHERE tenant_id = :tenant_id LIMIT 1"
        ),
        {"tenant_id": tenant_id},
    ).mappings().first()

    return dict(row) if row else {}


@router.get("/evidence")
def get_intelligence_evidence(
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id
    res = db.execute(text("SELECT * FROM analytics.v_evidence_intelligence WHERE tenant_id = :tenant_id LIMIT :limit"), {"tenant_id": tenant_id, "limit": int(limit)})
    return _rows_to_dicts(res)


@router.get("/risk-exposure")
def get_risk_exposure(
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id
    rows = ExposureEngine(db).compute_risk_exposure(tenant_id=tenant_id, limit=int(limit))
    return [
        {
            "tenant_id": int(r.tenant_id),
            "risk_id": int(r.risk_id),
            "risk_version_id": int(r.risk_version_id),
            "risk_score": float(r.inherent_score),
            "linked_evidence_count": int(r.linked_evidence_count),
            "approved_evidence_count": int(r.approved_evidence_count),
            "is_covered": bool(r.approved_evidence_count > 0),
            "exposure_score": float(r.residual_exposure),
            "evidence_quality": float(r.evidence_quality),
            "density_factor": float(r.density_factor),
            "pressure_factor": float(r.pressure_factor),
            "velocity_factor": float(r.velocity_factor),
            "escalation_probability_30d": float(r.escalation_probability_30d),
            "expected_score_delta": float(r.expected_score_delta),
            "unified_score": float(r.unified_score),
            "control_id": r.control_id,
            "risk_level": r.risk_level,
            "title": r.title,
        }
        for r in rows
    ]


@router.get("/escalation-distribution")
def get_escalation_distribution(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id
    rows = db.execute(text("SELECT probability_bucket, risk_count FROM analytics.v_escalation_distribution WHERE tenant_id = :tenant_id ORDER BY probability_bucket"), {"tenant_id": tenant_id}).mappings().all()
    return [{"probability_bucket": r["probability_bucket"], "risk_count": r["risk_count"]} for r in rows]


@router.get("/exposure-coverage")
def get_exposure_coverage(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id
    rows = db.execute(text("SELECT risk_bucket, coverage_bucket, risk_count FROM analytics.v_exposure_coverage_matrix WHERE tenant_id = :tenant_id"), {"tenant_id": tenant_id}).mappings().all()
    return [{"risk_bucket": r["risk_bucket"], "coverage_bucket": r["coverage_bucket"], "risk_count": r["risk_count"]} for r in rows]


@router.get("/gaps")
def get_gap_intelligence(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id
    rows = db.execute(text("""
        SELECT gi.id, gi.risk_id, gi.control_id, gi.severity_score, gi.status,
               co.code AS control_code, co.title AS control_title,
               r.title AS risk_title, r.risk_level,
               t.id AS task_id, t.status AS task_status
        FROM gap_items gi
        LEFT JOIN controls co ON co.id = gi.control_id
        LEFT JOIN risks r ON r.id = gi.risk_id
        LEFT JOIN compliance_tasks t ON t.source_type = 'control_gap_auto'
           AND t.source_id = gi.control_id
           AND t.status IN ('open', 'in_progress')
        WHERE gi.tenant_id = :tenant_id
        ORDER BY gi.severity_score DESC NULLS LAST
    """), {"tenant_id": tenant_id}).mappings().all()
    if not rows:
        return {"summary": {"gaps_total": 0, "uncovered": 0, "partial": 0, "worst_severity_score": 0}, "controls": [], "trend": []}
    exposure_rows = ExposureEngine(db).compute_risk_exposure(tenant_id=tenant_id, limit=100000)
    exposure_map = {int(r.risk_id): r for r in exposure_rows}
    control_map: Dict[int, Dict[str, Any]] = {}
    for row in rows:
        cid, rid = row["control_id"], row["risk_id"]
        node = control_map.setdefault(cid, {"control_id": cid, "control_code": row["control_code"], "control_title": row["control_title"], "gap_count": 0, "worst_severity": 0.0, "risks": {}})
        node["gap_count"] += 1
        sev = float(row["severity_score"] or 0.0)
        node["worst_severity"] = max(node["worst_severity"], sev)
        if rid not in node["risks"]:
            exposure = exposure_map.get(int(rid))
            node["risks"][rid] = {"risk_id": rid, "risk_title": row["risk_title"], "risk_level": row["risk_level"], "exposure_score": float(exposure.residual_exposure) if exposure else 0.0, "escalation_probability": float(exposure.escalation_probability_30d) if exposure else 0.0, "expected_score_delta": float(exposure.expected_score_delta) if exposure else 0.0, "gap_count": 0, "worst_severity": 0.0, "gaps": []}
        risk_node = node["risks"][rid]
        risk_node["gap_count"] += 1
        risk_node["worst_severity"] = max(risk_node["worst_severity"], sev)
        risk_node["gaps"].append({"gap_id": row["id"], "severity_score": sev, "status": row["status"], "task_id": row.get("task_id"), "task_status": row.get("task_status")})
    controls_out = []
    for control in control_map.values():
        risks_list = list(control["risks"].values())
        avg_exposure = sum(float(r.get("exposure_score", 0.0) or 0.0) for r in risks_list) / len(risks_list) if risks_list else 0.0
        avg_escalation = sum(float(r.get("escalation_probability", 0.0) or 0.0) for r in risks_list) / len(risks_list) if risks_list else 0.0
        controls_out.append({"control_id": control["control_id"], "control_code": control["control_code"], "control_title": control["control_title"], "gap_count": control["gap_count"], "worst_severity": control["worst_severity"], "ai_priority_score": _control_ai_priority(control["worst_severity"], avg_exposure, avg_escalation, control["gap_count"]), "risks": risks_list})
    controls_out.sort(key=lambda x: float(x["ai_priority_score"]), reverse=True)
    total = len(rows)
    uncovered = sum(1 for x in rows if (x.get("status") or "").lower() == "uncovered")
    partial = sum(1 for x in rows if (x.get("status") or "").lower() == "partial")
    worst = max(float(x.get("severity_score") or 0.0) for x in rows)
    trend_rows = db.execute(text("SELECT date_trunc('day', created_at) AS day, count(*) AS gap_count, coalesce(max(severity_score), 0) AS worst_severity FROM gap_items WHERE tenant_id = :tenant_id GROUP BY day ORDER BY day"), {"tenant_id": tenant_id}).mappings().all()
    trend = [{"day": row["day"].isoformat() if row["day"] else None, "gap_count": int(row["gap_count"] or 0), "worst_severity": float(row["worst_severity"] or 0)} for row in trend_rows]
    return {"summary": {"gaps_total": total, "uncovered": uncovered, "partial": partial, "worst_severity_score": worst}, "controls": controls_out, "trend": trend}


@router.get("/gaps/trend")
def get_gap_trend(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id
    rows = db.execute(text("""
        SELECT date_trunc('day', created_at) AS day, count(*) AS gap_count,
               sum(CASE WHEN lower(status) = 'uncovered' THEN 1 ELSE 0 END) AS uncovered_count,
               avg(severity_score) AS avg_severity
        FROM gap_items WHERE tenant_id = :tenant_id GROUP BY day ORDER BY day
    """), {"tenant_id": tenant_id}).mappings().all()
    return [{"day": row["day"].isoformat() if row["day"] else None, "gap_count": int(row["gap_count"] or 0), "uncovered_count": int(row["uncovered_count"] or 0), "avg_severity": float(row["avg_severity"] or 0)} for row in rows]


@router.get("/control-health")
@api_router.get("/control-health")
def get_control_health(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id
    linked_risks = db.query(func.count(Risk.id)).filter(Risk.tenant_id == tenant_id).scalar() or 0
    high_risks = db.query(func.count(Risk.id)).filter(Risk.tenant_id == tenant_id, func.lower(Risk.risk_level) == "high").scalar() or 0
    critical_risks = db.query(func.count(Risk.id)).filter(Risk.tenant_id == tenant_id, func.lower(Risk.risk_level) == "critical").scalar() or 0
    avg_escalation_probability = 0.0
    try:
        subq = select(RiskForecast.risk_id.label("risk_id"), func.max(RiskForecast.created_at).label("max_created_at")).where(RiskForecast.tenant_id == tenant_id).group_by(RiskForecast.risk_id).subquery()
        avg_stmt = select(func.avg(RiskForecast.escalation_probability_30d)).join(subq, and_(RiskForecast.risk_id == subq.c.risk_id, RiskForecast.created_at == subq.c.max_created_at)).where(RiskForecast.tenant_id == tenant_id)
        avg_escalation_probability = float(db.execute(avg_stmt).scalar() or 0.0)
    except Exception:
        avg_escalation_probability = 0.0
    gap_summary = db.execute(text("SELECT count(*) AS gap_count, coalesce(max(severity_score), 0) AS worst_severity FROM gap_items WHERE tenant_id = :tenant_id"), {"tenant_id": tenant_id}).mappings().first()
    gap_count = int((gap_summary or {}).get("gap_count", 0) or 0)
    worst_severity = float((gap_summary or {}).get("worst_severity", 0) or 0.0)
    task_row = db.execute(text("SELECT count(*) AS open_tasks FROM compliance_tasks WHERE tenant_id = :tenant_id AND lower(coalesce(status, '')) != 'closed'"), {"tenant_id": tenant_id}).mappings().first()
    open_tasks = int((task_row or {}).get("open_tasks", 0) or 0)
    evidence_count = 0
    try:
        dashboard_row = db.execute(text("SELECT total_evidences FROM analytics.v_dashboard_summary WHERE tenant_id = :tenant_id LIMIT 1"), {"tenant_id": tenant_id}).mappings().first()
        evidence_count = int((dashboard_row or {}).get("total_evidences", 0) or 0)
    except Exception:
        evidence_count = 0
    health_index = max(0.0, round(100.0 - (float(gap_count) * 2.0 + float(critical_risks) * 5.0 + float(high_risks) * 2.0 + float(avg_escalation_probability) * 20.0), 2))
    trend_rows = db.execute(text("SELECT date_trunc('day', created_at) AS day, count(*) AS gap_count, coalesce(max(severity_score), 0) AS worst_severity FROM gap_items WHERE tenant_id = :tenant_id GROUP BY day ORDER BY day"), {"tenant_id": tenant_id}).mappings().all()
    trend = []
    for row in trend_rows:
        day_gap_count = int(row.get("gap_count", 0) or 0)
        day_worst_severity = float(row.get("worst_severity", 0) or 0.0)
        trend.append({"day": row["day"].isoformat() if row.get("day") else None, "gap_count": day_gap_count, "worst_severity": day_worst_severity, "health_index": max(0.0, round(100.0 - (float(day_gap_count) * 2.0 + day_worst_severity * 0.5), 2))})
    return {"linked_risks": int(linked_risks), "high_risks": int(high_risks), "critical_risks": int(critical_risks), "avg_escalation_probability": float(avg_escalation_probability), "gap_count": int(gap_count), "worst_severity": float(worst_severity), "open_tasks": int(open_tasks), "evidence_count": int(evidence_count), "health_index": float(health_index), "trend": trend}


@router.get("/readiness/processes")
def get_process_readiness(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("executive.view")),
    scope=Depends(require_tenant_scope()),
):
    result = db.execute(text("SELECT tenant_id, process_id, process_name, control_count FROM analytics.v_process_readiness ORDER BY control_count DESC")).mappings().all()
    return list(result)


@router.post("/gaps/{gap_id}/create-task")
def create_task_from_gap(gap_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    gap = db.execute(text("SELECT tenant_id, control_id, risk_id FROM gap_items WHERE id = :gap_id LIMIT 1"), {"gap_id": gap_id}).mappings().first()
    if not gap:
        raise HTTPException(status_code=404, detail="Gap not found")
    title = payload.get("title") or "Remediate control gap"
    description = payload.get("description") or "Gap remediation task"
    owner_role = payload.get("owner_role")
    due_date = payload.get("due_date")
    task_id = db.execute(text("""
        INSERT INTO compliance_tasks(tenant_id, process_id, control_id, status, created_at, updated_at, title, description, owner_role, due_date, source_type, source_id)
        VALUES(:tenant_id, NULL, :control_id, 'OPEN', now(), now(), :title, :description, :owner_role, :due_date, 'control_gap_auto', :gap_id)
        RETURNING id
    """), {"tenant_id": gap["tenant_id"], "control_id": gap["control_id"], "title": title, "description": description, "owner_role": owner_role, "due_date": due_date, "gap_id": gap_id}).scalar()
    db.commit()
    return {"success": True, "task_id": task_id}
