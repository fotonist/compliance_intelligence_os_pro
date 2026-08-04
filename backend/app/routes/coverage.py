# backend/app/routes/coverage.py
from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, select, func
from sqlalchemy.orm import Session
from datetime import date, timedelta

from app.schemas.audit_plan_schema import AuditPlanResponse, AuditActionItem
from app.core.security import get_current_user
from app.db.session import get_db

from app.models.user import User
from app.models.process import Process
from app.models.process_risk_link import ProcessRiskLink
from app.models.risks import Risk
from app.models.controls import Control
from app.models.requirements import Requirement
from app.models.clauses import Clause
from app.models.standards import Standard
from app.models.risk_forecasts import RiskForecast

from app.schemas.coverage_schema import (
    CoverageResponse,
    GapResponse,
    GapItem,
    GapRiskInfo,
    GapSummary,
)

router = APIRouter(prefix="/company/coverage", tags=["Company"])


def _get_process_or_404(db: Session, tenant_id: int, process_id: int) -> Process:
    p = db.execute(
        select(Process).where(and_(Process.id == process_id, Process.tenant_id == tenant_id))
    ).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Process not found")
    return p


def _normalize_coverage_status(raw: Optional[str]) -> str:
    """
    Normalize free-form/legacy statuses into: covered | partial | uncovered | unknown
    """
    if not raw:
        return "unknown"

    s = (raw or "").strip().lower()

    covered = {"covered", "implemented", "ok", "complete", "done", "yes", "true"}
    partial = {"partial", "in_progress", "in-progress", "progress", "ongoing", "work_in_progress"}
    uncovered = {"uncovered", "missing", "none", "no", "false", "gap", "not_covered", "not-covered"}

    if s in covered:
        return "covered"
    if s in partial:
        return "partial"
    if s in uncovered:
        return "uncovered"
    return "unknown"


def _aggregate_status(statuses: List[str]) -> str:
    """
    Priority: covered > partial > uncovered > unknown
    """
    if not statuses:
        return "unknown"
    if "covered" in statuses:
        return "covered"
    if "partial" in statuses:
        return "partial"
    if "uncovered" in statuses:
        return "uncovered"
    return "unknown"


def _risk_level_rank(level: Optional[str]) -> int:
    """
    Robust ranking for risk_level strings coming from DB.
    You can refine this later to match your exact risk matrix taxonomy.
    """
    if not level:
        return 0
    s = level.strip().lower()

    # normalize common variants
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
    """Clamp & normalize expected score delta to keep priority stable."""
    if x is None:
        return 0.0
    try:
        v = float(x)
    except Exception:
        return 0.0
    if v > 10.0:
        v = 10.0
    if v < -10.0:
        v = -10.0
    return v / 10.0  # [-1, 1]


def _max_risk_level(levels: List[Optional[str]]) -> Optional[str]:
    best_rank = -1
    best_val: Optional[str] = None
    for lv in levels:
        r = _risk_level_rank(lv)
        if r > best_rank:
            best_rank = r
            best_val = lv
    return best_val


# -----------------------------------------------------------------------------
# Phase B: Coverage tree endpoint
# -----------------------------------------------------------------------------
@router.get("/processes/{process_id}", response_model=CoverageResponse)
def get_process_coverage(
    process_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Coverage graph (tenant-safe):
    Process -> ProcessRiskLink -> Risk -> Control -> Requirement -> Clause -> Standard

    Coverage status source:
      - Risk.control_coverage_status (string)
      - aggregated per Control (covered/partial/uncovered/unknown)
    """
    tenant_id = user.tenant_id
    p = _get_process_or_404(db, tenant_id, process_id)

    stmt = (
        select(
            Standard,
            Clause,
            Requirement,
            Control,
            Risk.id,
            Risk.control_coverage_status,
        )
        .select_from(ProcessRiskLink)
        .join(Risk, Risk.id == ProcessRiskLink.risk_id)
        .join(Control, Control.id == Risk.control_id)
        .join(Requirement, Requirement.id == Control.requirement_id)
        .join(Clause, Clause.id == Requirement.clause_id)
        .join(Standard, Standard.id == Clause.standard_id)
        .where(
            and_(
                ProcessRiskLink.tenant_id == tenant_id,
                ProcessRiskLink.process_id == process_id,
                Risk.tenant_id == tenant_id,
            )
        )
        .order_by(Standard.id, Clause.id, Requirement.id, Control.id, Risk.id)
    )

    rows = db.execute(stmt).all()

    control_statuses: Dict[int, List[str]] = defaultdict(list)
    control_risk_ids: Dict[int, List[int]] = defaultdict(list)

    standards_map: Dict[int, Dict[str, Any]] = {}
    clauses_map: Dict[Tuple[int, int], Dict[str, Any]] = {}
    reqs_map: Dict[Tuple[int, int, int], Dict[str, Any]] = {}
    controls_map: Dict[Tuple[int, int, int, int], Dict[str, Any]] = {}

    for std, cl, req, ctrl, risk_id, cov_raw in rows:
        cov = _normalize_coverage_status(cov_raw)

        control_statuses[ctrl.id].append(cov)
        control_risk_ids[ctrl.id].append(risk_id)

        std_node = standards_map.get(std.id)
        if not std_node:
            std_node = {
                "id": std.id,
                "code": getattr(std, "code", None),
                "title": getattr(std, "title", None),
                "clauses": [],
            }
            standards_map[std.id] = std_node

        cl_key = (std.id, cl.id)
        cl_node = clauses_map.get(cl_key)
        if not cl_node:
            cl_node = {
                "id": cl.id,
                "code": getattr(cl, "code", None),
                "title": getattr(cl, "title", None),
                "requirements": [],
            }
            clauses_map[cl_key] = cl_node
            std_node["clauses"].append(cl_node)

        req_key = (std.id, cl.id, req.id)
        req_node = reqs_map.get(req_key)
        if not req_node:
            req_node = {
                "id": req.id,
                "code": getattr(req, "code", None),
                "title": getattr(req, "title", None),
                "controls": [],
            }
            reqs_map[req_key] = req_node
            cl_node["requirements"].append(req_node)

        ctrl_key = (std.id, cl.id, req.id, ctrl.id)
        ctrl_node = controls_map.get(ctrl_key)
        if not ctrl_node:
            ctrl_node = {
                "id": ctrl.id,
                "code": getattr(ctrl, "code", None),
                "title": getattr(ctrl, "title", None),
                "status": "unknown",
                "risk_ids": [],
            }
            controls_map[ctrl_key] = ctrl_node
            req_node["controls"].append(ctrl_node)

        if risk_id not in ctrl_node["risk_ids"]:
            ctrl_node["risk_ids"].append(risk_id)

    covered_controls = 0
    partial_controls = 0
    uncovered_controls = 0
    unknown_controls = 0

    for ctrl_node in controls_map.values():
        cid = ctrl_node["id"]
        agg = _aggregate_status(control_statuses.get(cid, []))
        ctrl_node["status"] = agg

        if agg == "covered":
            covered_controls += 1
        elif agg == "partial":
            partial_controls += 1
        elif agg == "uncovered":
            uncovered_controls += 1
        else:
            unknown_controls += 1

    def rollup_controls(node_controls: List[Dict[str, Any]]) -> str:
        return _aggregate_status([c.get("status", "unknown") for c in node_controls])

    for req_node in reqs_map.values():
        req_node["status"] = rollup_controls(req_node["controls"])

    for cl_node in clauses_map.values():
        cl_node["status"] = _aggregate_status([r.get("status", "unknown") for r in cl_node["requirements"]])

    for std_node in standards_map.values():
        std_node["status"] = _aggregate_status([c.get("status", "unknown") for c in std_node["clauses"]])

    risk_ids_all = set()
    for ids in control_risk_ids.values():
        risk_ids_all.update(ids)

    return {
        "process": {
            "id": p.id,
            "code": getattr(p, "code", None),
            "name": getattr(p, "name", None),
        },
        "summary": {
            "risks_total": len(risk_ids_all),
            "controls_total": len(control_statuses),
            "covered_controls": covered_controls,
            "partial_controls": partial_controls,
            "uncovered_controls": uncovered_controls,
            "unknown_controls": unknown_controls,
        },
        "standards": list(standards_map.values()),
    }


# -----------------------------------------------------------------------------
# Phase C (D): Full audit intelligence gap endpoint
# -----------------------------------------------------------------------------
@router.get("/processes/{process_id}/gaps", response_model=GapResponse)
def get_process_gaps(
    process_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Returns non-covered controls (partial/uncovered/unknown) enriched with audit intelligence:
      - risk_count
      - max_risk_score (from Risk.score)
      - highest_risk_level (from Risk.risk_level, ranked)
      - risk list: (id, title, score, level)
    Sorted by (HARD AI):
      - ai_priority_score desc
      - status severity (uncovered first, then partial, then unknown)
      - max_risk_score desc
      - highest_risk_level rank desc
      - risk_count desc
    """
    tenant_id = user.tenant_id
    p = _get_process_or_404(db, tenant_id, process_id)

    stmt = (
        select(
            Standard,
            Clause,
            Requirement,
            Control,
            Risk.id,
            Risk.title,
            Risk.score,
            Risk.risk_level,
            Risk.control_coverage_status,
        )
        .select_from(ProcessRiskLink)
        .join(Risk, Risk.id == ProcessRiskLink.risk_id)
        .join(Control, Control.id == Risk.control_id)
        .join(Requirement, Requirement.id == Control.requirement_id)
        .join(Clause, Clause.id == Requirement.clause_id)
        .join(Standard, Standard.id == Clause.standard_id)
        .where(
            and_(
                ProcessRiskLink.tenant_id == tenant_id,
                ProcessRiskLink.process_id == process_id,
                Risk.tenant_id == tenant_id,
            )
        )
        .order_by(Standard.id, Clause.id, Requirement.id, Control.id, Risk.id)
    )

    rows = db.execute(stmt).all()

    # ------------------------------------------------------------------
    # HARD AI INTEGRATION:
    # Pull latest forecast per risk (tenant-safe) in ONE query (no N+1).
    # If a risk has no forecast yet, prob/delta are treated as 0.
    # ------------------------------------------------------------------
    risk_ids = sorted({int(row[4]) for row in rows} if rows else [])
    forecast_by_risk_id: Dict[int, Dict[str, Any]] = {}
    if risk_ids:
        subq = (
            select(
                RiskForecast.risk_id.label("risk_id"),
                func.max(RiskForecast.created_at).label("max_created_at"),
            )
            .where(
                and_(
                    RiskForecast.tenant_id == tenant_id,
                    RiskForecast.risk_id.in_(risk_ids),
                )
            )
            .group_by(RiskForecast.risk_id)
            .subquery()
        )

        latest = db.execute(
            select(RiskForecast)
            .join(
                subq,
                and_(
                    RiskForecast.risk_id == subq.c.risk_id,
                    RiskForecast.created_at == subq.c.max_created_at,
                ),
            )
            .where(RiskForecast.tenant_id == tenant_id)
        ).scalars().all()

        for f in latest:
            forecast_by_risk_id[int(f.risk_id)] = {
                "prob": float(f.escalation_probability_30d or 0.0),
                "delta": float(f.expected_score_delta or 0.0),
                "version": getattr(f, "model_version", None),
            }

    # Aggregate per control (unique key across chain)
    # key: (standard_id, clause_id, requirement_id, control_id)
    agg: Dict[Tuple[int, int, int, int], Dict[str, Any]] = {}

    for std, cl, req, ctrl, rid, rtitle, rscore, rlevel, cov_raw in rows:
        key = (std.id, cl.id, req.id, ctrl.id)
        node = agg.get(key)
        if not node:
            node = {
                "standard_id": std.id,
                "standard_code": getattr(std, "code", None),
                "standard_title": getattr(std, "title", None),

                "clause_id": cl.id,
                "clause_code": getattr(cl, "code", None),
                "clause_title": getattr(cl, "title", None),

                "requirement_id": req.id,
                "requirement_code": getattr(req, "code", None),
                "requirement_title": getattr(req, "title", None),

                "control_id": ctrl.id,
                "control_code": getattr(ctrl, "code", None),
                "control_title": getattr(ctrl, "title", None),

                "statuses": [],
                "risks": [],
                "scores": [],
                "levels": [],
                "ai_probs": [],
                "ai_deltas": [],
                "forecast_versions": [],
            }
            agg[key] = node

        cov = _normalize_coverage_status(cov_raw)
        node["statuses"].append(cov)

        f0 = forecast_by_risk_id.get(int(rid))
        node["risks"].append(
            {
                "id": int(rid),
                "title": rtitle,
                "score": int(rscore) if rscore is not None else None,
                "level": rlevel,
                "escalation_probability": float(f0["prob"]) if f0 else 0.0,
                "expected_score_delta": float(f0["delta"]) if f0 else 0.0,
            }
        )

        if rscore is not None:
            node["scores"].append(int(rscore))
        node["levels"].append(rlevel)

        f = forecast_by_risk_id.get(int(rid))
        if f:
            node["ai_probs"].append(float(f["prob"]))
            node["ai_deltas"].append(float(f["delta"]))
            if f.get("version"):
                node["forecast_versions"].append(f.get("version"))
        else:
            node["ai_probs"].append(0.0)
            node["ai_deltas"].append(0.0)

    gaps: List[GapItem] = []
    uncovered_cnt = 0
    partial_cnt = 0
    unknown_cnt = 0

    worst_score: Optional[int] = None
    worst_level: Optional[str] = None
    worst_level_rank = -1

    for node in agg.values():
        status = _aggregate_status(node["statuses"])

        # only non-covered are gaps
        if status == "covered":
            continue

        if status == "uncovered":
            uncovered_cnt += 1
        elif status == "partial":
            partial_cnt += 1
        else:
            unknown_cnt += 1

        max_score = max(node["scores"]) if node["scores"] else None
        highest_level = _max_risk_level(node["levels"])
        highest_rank = _risk_level_rank(highest_level)

        if max_score is not None:
            if worst_score is None or max_score > worst_score:
                worst_score = max_score
        if highest_rank > worst_level_rank:
            worst_level_rank = highest_rank
            worst_level = highest_level

        ai_probs = node.get("ai_probs") or []
        ai_deltas = node.get("ai_deltas") or []

        avg_prob = (sum(ai_probs) / len(ai_probs)) if ai_probs else 0.0
        max_prob = max(ai_probs) if ai_probs else 0.0
        delta_sum = sum(ai_deltas) if ai_deltas else 0.0

        # HARD: AI drives priority
        ai_priority = (avg_prob * 70.0) + (_normalize_expected_delta(delta_sum) * 30.0)

        # choose a representative forecast version (latest available among linked risks)
        forecast_version = None
        if node.get("forecast_versions"):
            forecast_version = node["forecast_versions"][-1]

        gaps.append(
            GapItem(
                standard_id=node["standard_id"],
                standard_code=node["standard_code"],
                standard_title=node["standard_title"],

                clause_id=node["clause_id"],
                clause_code=node["clause_code"],
                clause_title=node["clause_title"],

                requirement_id=node["requirement_id"],
                requirement_code=node["requirement_code"],
                requirement_title=node["requirement_title"],

                control_id=node["control_id"],
                control_code=node["control_code"],
                control_title=node["control_title"],

                status=status,  # type: ignore[arg-type]
                risk_count=len(node["risks"]),
                max_risk_score=max_score,
                highest_risk_level=highest_level,

                ai_priority_score=float(ai_priority),
                max_escalation_probability=float(max_prob),
                avg_escalation_probability=float(avg_prob),
                expected_score_delta_sum=float(delta_sum),
                forecast_version=forecast_version,

                risks=[GapRiskInfo(**r) for r in node["risks"]],
            )
        )

    def status_rank(s: str) -> int:
        # uncovered first
        if s == "uncovered":
            return 3
        if s == "partial":
            return 2
        if s == "unknown":
            return 1
        return 0

    gaps.sort(
        key=lambda g: (
            -g.ai_priority_score,
            -status_rank(g.status),
            -(g.max_risk_score or 0),
            -_risk_level_rank(g.highest_risk_level),
            -g.risk_count,
            g.standard_id,
            g.clause_id,
            g.requirement_id,
            g.control_id,
        )
    )

    summary = GapSummary(
        gaps_total=len(gaps),
        uncovered=uncovered_cnt,
        partial=partial_cnt,
        unknown=unknown_cnt,
        worst_max_risk_score=worst_score,
        worst_highest_risk_level=worst_level,
    )

    return GapResponse(
        process={
            "id": p.id,
            "code": getattr(p, "code", None),
            "name": getattr(p, "name", None),
        },
        summary=summary,
        gaps=gaps,
    )


# --------------------------------------------------------------
# AUDIT PLAN
# -------------------------------------------------------------
@router.get("/processes/{process_id}/audit-plan", response_model=AuditPlanResponse)
def generate_audit_plan(
    process_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    gap_response = get_process_gaps(process_id, db, user)

    actions = []
    critical_count = 0

    for gap in gap_response.gaps:
        risk_rank = _risk_level_rank(gap.highest_risk_level)

        # HARD: AI drives priority
        priority_score = int(round(gap.ai_priority_score))

        # HARD: AI drives due date
        if gap.avg_escalation_probability >= 0.80:
            due = date.today() + timedelta(days=5)
            critical_count += 1
        elif gap.avg_escalation_probability >= 0.65:
            due = date.today() + timedelta(days=10)
        elif gap.avg_escalation_probability >= 0.50:
            due = date.today() + timedelta(days=20)
        else:
            due = date.today() + timedelta(days=30)

        # owner suggestion rule engine (keep existing clause heuristic)
        clause = (gap.clause_code or "").upper()
        if clause.startswith("A.6"):
            owner = "HR Manager"
        elif clause.startswith("A.5"):
            owner = "IT Manager"
        elif clause.startswith("A.8"):
            owner = "Security Officer"
        else:
            owner = "Process Owner"

        # HARD: executive escalation when forecast is very high
        if gap.avg_escalation_probability >= 0.80 and risk_rank >= 3:
            owner = "Executive Risk Committee"

        evidence_types = [
            "Policy Document",
            "Procedure Record",
            "Access Log",
            "Training Record",
        ]

        actions.append(
            AuditActionItem(
                priority_score=priority_score,
                standard_code=gap.standard_code,
                clause_code=gap.clause_code,
                requirement_code=gap.requirement_code,
                control_code=gap.control_code,
                control_id=gap.control_id,
                status=gap.status,
                risk_count=gap.risk_count,
                max_risk_score=gap.max_risk_score,
                highest_risk_level=gap.highest_risk_level,

                escalation_probability=float(gap.avg_escalation_probability),
                expected_score_delta=float(gap.expected_score_delta_sum),
                ai_priority_score=float(gap.ai_priority_score),
                forecast_version=gap.forecast_version,

                suggested_owner_role=owner,
                suggested_due_date=due,
                suggested_evidence_types=evidence_types,
            )
        )

    actions.sort(key=lambda x: -x.priority_score)

    return AuditPlanResponse(
        process_id=process_id,
        total_actions=len(actions),
        critical_actions=critical_count,
        actions=actions,
    )