from collections import defaultdict
from datetime import datetime, timedelta
from statistics import mean
from typing import Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session

from app.dependencies.permission_checker import require_permission
from app.dependencies.scope_checker import require_tenant_scope
from app.db.session import get_db
from app.models.user import User

from app.models.controls import Control
from app.models.risks import Risk
from app.models.risk_forecasts import RiskForecast
from app.models.risk_history import RiskHistory
from app.models.process_risk_link import ProcessRiskLink
from app.models.process import Process

router = APIRouter(prefix="/company/intelligence", tags=["Company", "Intelligence"])


def _risk_level_rank(level: str | None) -> int:
    if not level:
        return 0
    s = level.lower()
    if s in ["critical", "extreme"]:
        return 4
    if s in ["high"]:
        return 3
    if s in ["medium"]:
        return 2
    if s in ["low"]:
        return 1
    return 0


@router.get("/control/{control_id}")
def get_control_health(
    control_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id
    control = db.execute(
        select(Control).where(
            Control.id == control_id,
            Control.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if not control:
        raise HTTPException(
            status_code=404,
            detail="Control not found",
        )

    # -----------------------------
    # Risks linked to this control
    # -----------------------------
    risks = (
        db.execute(
            select(Risk)
            .where(
                and_(
                    Risk.control_id == control_id,
                    Risk.tenant_id == tenant_id,
                )
            )
        )
        .scalars()
        .all()
    )

    if not risks:
        return {
            "control_id": control.id,
            "control_code": control.code,
            "summary": {},
            "top_risks": [],
            "trend": [],
            "process_distribution": [],
        }

    risk_ids = [r.id for r in risks]

    # -----------------------------
    # Latest forecast per risk
    # -----------------------------
    subq = (
        select(
            RiskForecast.risk_id,
            func.max(RiskForecast.created_at).label("max_created"),
        )
        .where(RiskForecast.tenant_id == tenant_id)
        .group_by(RiskForecast.risk_id)
        .subquery()
    )

    forecast_rows = (
        db.execute(
            select(RiskForecast)
            .join(
                subq,
                and_(
                    RiskForecast.risk_id == subq.c.risk_id,
                    RiskForecast.created_at == subq.c.max_created,
                ),
            )
            .where(
                and_(
                    RiskForecast.tenant_id == tenant_id,
                    RiskForecast.risk_id.in_(risk_ids),
                )
            )
        )
        .scalars()
        .all()
    )

    forecast_map = {f.risk_id: f for f in forecast_rows}

    # -----------------------------
    # Aggregates
    # -----------------------------
    linked_count = len(risks)
    high_count = 0
    critical_count = 0

    prob_list = []
    delta_sum = 0.0

    top_risks = []

    for r in risks:
        level_rank = _risk_level_rank(r.risk_level)
        if level_rank == 3:
            high_count += 1
        if level_rank == 4:
            critical_count += 1

        f = forecast_map.get(r.id)
        if not f:
            continue

        prob = float(f.escalation_probability_30d or 0.0)
        delta = float(f.expected_score_delta or 0.0)

        prob_list.append(prob)
        delta_sum += delta

        top_risks.append(
            {
                "risk_id": r.id,
                "title": r.title,
                "score": r.score,
                "level": r.risk_level,
                "status": r.status,
                "escalation_probability": prob,
                "expected_delta": delta,
            }
        )

    avg_prob = mean(prob_list) if prob_list else 0.0
    max_prob = max(prob_list) if prob_list else 0.0

    risk_pressure = avg_prob * linked_count

    # -----------------------------
    # Trend (90 days)
    # -----------------------------
    window_start = datetime.utcnow() - timedelta(days=90)

    history_rows = (
        db.execute(
            select(RiskHistory)
            .where(
                and_(
                    RiskHistory.tenant_id == tenant_id,
                    RiskHistory.risk_id.in_(risk_ids),
                    RiskHistory.changed_at >= window_start,
                )
            )
        )
        .scalars()
        .all()
    )

    daily_map: Dict[str, List[int]] = defaultdict(list)

    for h in history_rows:
        date_key = h.changed_at.date().isoformat()
        if h.score_new is not None:
            daily_map[date_key].append(h.score_new)

    trend = [
        {"date": d, "avg_score": mean(scores)}
        for d, scores in sorted(daily_map.items())
    ]

    # -----------------------------
    # Process Distribution
    # -----------------------------
    process_rows = (
        db.execute(
            select(ProcessRiskLink.risk_id, Process.id, Process.name)
            .join(Process, Process.id == ProcessRiskLink.process_id)
            .where(
                and_(
                    ProcessRiskLink.tenant_id == tenant_id,
                    ProcessRiskLink.risk_id.in_(risk_ids),
                )
            )
        )
        .all()
    )

    process_counter: Dict[str, int] = defaultdict(int)

    for _rid, _pid, pname in process_rows:
        process_counter[pname] += 1

    process_distribution = [
        {"process": name, "risk_count": count}
        for name, count in process_counter.items()
    ]

    return {
        "control_id": control.id,
        "control_code": control.code,
        "control_title": control.title,
        "summary": {
            "linked_risk_count": linked_count,
            "high_risk_count": high_count,
            "critical_risk_count": critical_count,
            "avg_escalation_probability": avg_prob,
            "max_escalation_probability": max_prob,
            "expected_score_delta_sum": delta_sum,
            "risk_pressure_index": risk_pressure,
        },
        "top_risks": sorted(
            top_risks,
            key=lambda x: x["escalation_probability"],
            reverse=True,
        ),
        "trend": trend,
        "process_distribution": process_distribution,
    }