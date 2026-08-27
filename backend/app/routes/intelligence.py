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
from app.models.risk_history import RiskHistory
from app.models.controls import Control
from app.models.process_risk_link import ProcessRiskLink
from app.models.process import Process
from app.models.intelligence_model_config import IntelligenceModelConfig
from app.services.exposure_engine import ExposureEngine
from app.services.control_health_engine import ControlHealthEngine
from app.services.control_health_config_provider import (
    get_active_control_health_weights,
)

from app.schemas.intelligence_schema import (
    IntelligenceExecutiveAlert,
    IntelligenceOverviewResponse,
    IntelligenceSummary,
    IntelligenceTopControl,
    IntelligenceTopRisk,
)

from app.schemas.intelligence_configuration_schema import (
    IntelligenceConfigurationResponse,
    IntelligenceConfigurationDraftRequest,
    IntelligenceConfigurationPreviewRequest,
    IntelligenceConfigurationPreviewResponse,
)


router = APIRouter(
    prefix="/company/intelligence",
    tags=["Company", "Intelligence"],
)

api_router = APIRouter(
    prefix="/api/intelligence",
    tags=["API", "Intelligence"],
)


# =========================================================
# HELPERS
# =========================================================

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
    return (
        float(prob) * 70.0
        + _normalize_expected_delta(expected_delta) * 30.0
    )


def _rows_to_dicts(result) -> List[Dict[str, Any]]:
    return [dict(r) for r in result.mappings().all()]


def _control_ai_priority(
    worst_severity: float,
    avg_exposure: float,
    avg_escalation: float,
    gap_count: int,
) -> float:
    score = (
        float(worst_severity or 0.0) * 0.40
        + float(avg_exposure or 0.0) * 0.30
        + (float(avg_escalation or 0.0) * 100.0) * 0.20
        + int(gap_count or 0) * 0.10
    )

    return round(score, 2)


def _forecast_mode(forecast: RiskForecast) -> str:
    explanation = forecast.explanation or {}

    mode = explanation.get("mode")

    if mode:
        return str(mode)

    version = str(forecast.model_version or "")

    if version.startswith("baseline"):
        return "baseline"

    if version.startswith("v"):
        return "rf"

    return "unknown"


def _forecast_status(forecast: RiskForecast) -> Optional[str]:
    explanation = forecast.explanation or {}

    reason = explanation.get("reason")

    if reason:
        return str(reason)

    train_info = explanation.get("train_info") or {}

    reason = train_info.get("reason")

    if reason:
        return str(reason)

    mode = _forecast_mode(forecast)

    if mode == "rf":
        return "trained"

    return None


# =========================================================
# ENTERPRISE INTELLIGENCE OVERVIEW
# =========================================================

@router.get(
    "/overview",
    response_model=IntelligenceOverviewResponse,
)
def get_intelligence_overview(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("executive.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="tenant_id missing",
        )

    # -----------------------------------------------------
    # 1. Risk universe
    # -----------------------------------------------------

    total_risks = int(
        db.execute(
            select(func.count(Risk.id)).where(
                Risk.tenant_id == tenant_id
            )
        ).scalar_one()
        or 0
    )

    open_risks = int(
        db.execute(
            select(func.count(Risk.id)).where(
                Risk.tenant_id == tenant_id,
                func.lower(func.trim(Risk.status)) == "open",
            )
        ).scalar_one()
        or 0
    )

    # -----------------------------------------------------
    # 2. Latest forecast per risk
    # -----------------------------------------------------

    latest_forecast_subq = (
        select(
            RiskForecast.risk_id.label("risk_id"),
            func.max(RiskForecast.created_at).label(
                "max_created_at"
            ),
        )
        .where(
            RiskForecast.tenant_id == tenant_id
        )
        .group_by(
            RiskForecast.risk_id
        )
        .subquery()
    )

    latest_stmt = (
        select(
            RiskForecast,
            Risk,
            Control,
        )
        .join(
            latest_forecast_subq,
            and_(
                RiskForecast.risk_id
                == latest_forecast_subq.c.risk_id,
                RiskForecast.created_at
                == latest_forecast_subq.c.max_created_at,
            ),
        )
        .join(
            Risk,
            and_(
                Risk.id == RiskForecast.risk_id,
                Risk.tenant_id == tenant_id,
            ),
        )
        .outerjoin(
            Control,
            Control.id == Risk.control_id,
        )
        .where(
            RiskForecast.tenant_id == tenant_id
        )
    )

    latest_rows = db.execute(
        latest_stmt
    ).all()

    forecasted_risks = len(latest_rows)

    # -----------------------------------------------------
    # 3. Process map
    # -----------------------------------------------------

    risk_ids = [
        int(risk.id)
        for (_forecast, risk, _control)
        in latest_rows
    ]

    process_map: Dict[int, Dict[str, Any]] = defaultdict(
        lambda: {
            "ids": [],
            "names": [],
        }
    )

    if risk_ids:
        process_stmt = (
            select(
                ProcessRiskLink.risk_id,
                Process.id,
                Process.name,
            )
            .select_from(ProcessRiskLink)
            .join(
                Process,
                Process.id
                == ProcessRiskLink.process_id,
            )
            .where(
                ProcessRiskLink.tenant_id == tenant_id,
                ProcessRiskLink.risk_id.in_(risk_ids),
                Process.tenant_id == tenant_id,
            )
        )

        for rid, pid, pname in db.execute(
            process_stmt
        ).all():
            rid_int = int(rid)

            if int(pid) not in process_map[rid_int]["ids"]:
                process_map[rid_int]["ids"].append(
                    int(pid)
                )

            if (
                pname
                and pname not in process_map[rid_int]["names"]
            ):
                process_map[rid_int]["names"].append(
                    pname
                )

    # -----------------------------------------------------
    # 4. Risk history intelligence
    #
    # Batch query: no N+1.
    # -----------------------------------------------------

    history_map: Dict[int, Dict[str, Any]] = {}

    if risk_ids:
        history_stmt = (
            select(
                RiskHistory.risk_id.label("risk_id"),
                func.count(RiskHistory.id).label(
                    "historical_change_count"
                ),
                func.count(RiskHistory.id)
                .filter(
                    RiskHistory.changed_at
                    >= func.now()
                    - text("interval '90 days'")
                )
                .label("changes_90d"),
                func.coalesce(
                    func.avg(
                        func.coalesce(
                            RiskHistory.score_new,
                            0,
                        )
                        - func.coalesce(
                            RiskHistory.score_old,
                            0,
                        )
                    ).filter(
                        RiskHistory.changed_at
                        >= func.now()
                        - text("interval '90 days'")
                    ),
                    0,
                ).label("avg_delta_90d"),
                func.coalesce(
                    func.max(
                        func.abs(
                            func.coalesce(
                                RiskHistory.score_new,
                                0,
                            )
                            - func.coalesce(
                                RiskHistory.score_old,
                                0,
                            )
                        )
                    ).filter(
                        RiskHistory.changed_at
                        >= func.now()
                        - text("interval '90 days'")
                    ),
                    0,
                ).label("max_delta_90d"),
            )
            .where(
                RiskHistory.tenant_id == tenant_id,
                RiskHistory.risk_id.in_(risk_ids),
            )
            .group_by(
                RiskHistory.risk_id
            )
        )

        for row in db.execute(
            history_stmt
        ).mappings().all():
            history_map[int(row["risk_id"])] = {
                "historical_change_count": int(
                    row["historical_change_count"] or 0
                ),
                "changes_90d": int(
                    row["changes_90d"] or 0
                ),
                "avg_delta_90d": float(
                    row["avg_delta_90d"] or 0.0
                ),
                "max_delta_90d": float(
                    row["max_delta_90d"] or 0.0
                ),
            }

    # -----------------------------------------------------
    # 5. Exposure Engine
    # -----------------------------------------------------

    engine_rows = ExposureEngine(
        db
    ).compute_risk_exposure(
        tenant_id=tenant_id,
        limit=1000000,
    )

    exposure_by_risk_id: Dict[int, Any] = {
        int(row.risk_id): row
        for row in engine_rows
    }

    # -----------------------------------------------------
    # 6. Forecast metrics
    # -----------------------------------------------------

    high_probability_count = 0
    executive_alert_count = 0

    probability_sum = 0.0
    delta_sum = 0.0

    baseline_forecast_count = 0
    ml_forecast_count = 0
    insufficient_history_count = 0

    latest_forecast_at = None

    for forecast, risk, _control in latest_rows:
        probability = float(
            forecast.escalation_probability_30d
            or 0.0
        )

        expected_delta = float(
            forecast.expected_score_delta
            or 0.0
        )

        probability_sum += probability
        delta_sum += expected_delta

        if probability >= 0.70:
            high_probability_count += 1

        mode = _forecast_mode(forecast)
        status = _forecast_status(forecast)

        if mode == "baseline":
            baseline_forecast_count += 1

        elif mode == "rf":
            ml_forecast_count += 1

        if status == "insufficient_training_samples":
            insufficient_history_count += 1

        created_at = forecast.created_at

        if created_at is not None:
            if (
                latest_forecast_at is None
                or created_at > latest_forecast_at
            ):
                latest_forecast_at = created_at

    # -----------------------------------------------------
    # 7. Exposure / evidence metrics
    # -----------------------------------------------------

    # =====================================================
    # CANONICAL RISK EXPOSURE TOTALS
    #
    # ExposureEngine is the sole source of risk-level
    # exposure calculations for Executive Intelligence.
    #
    # Do not recalculate residual/unified exposure here.
    # =====================================================

    total_inherent_exposure = sum(
        float(row.inherent_score or 0.0)
        for row in engine_rows
    )

    total_residual_exposure = sum(
        float(row.residual_exposure or 0.0)
        for row in engine_rows
    )

    total_unified_exposure = sum(
        float(row.unified_score or 0.0)
        for row in engine_rows
    )

    covered_risks = sum(
        1
        for row in engine_rows
        if int(row.approved_evidence_count or 0) > 0
    )

    exposure_delta = (
        total_residual_exposure
        - total_inherent_exposure
    )

    exposure_delta_percent = 0.0

    if total_inherent_exposure > 0:
        exposure_delta_percent = (
            exposure_delta
            / total_inherent_exposure
        ) * 100.0

    coverage_percent = 0.0

    if total_risks > 0:
        coverage_percent = (
            float(covered_risks)
            / float(total_risks)
        ) * 100.0

    forecast_coverage_percent = 0.0

    if total_risks > 0:
        forecast_coverage_percent = (
            float(forecasted_risks)
            / float(total_risks)
        ) * 100.0

    avg_probability = (
        probability_sum / forecasted_risks
        if forecasted_risks
        else 0.0
    )

    avg_expected_delta = (
        delta_sum / forecasted_risks
        if forecasted_risks
        else 0.0
    )

    # -----------------------------------------------------
    # 8. Executive alert determination
    # -----------------------------------------------------

    for forecast, risk, _control in latest_rows:
        probability = float(
            forecast.escalation_probability_30d
            or 0.0
        )

        exposure = exposure_by_risk_id.get(
            int(risk.id)
        )

        unified_score = float(
            exposure.unified_score
            if exposure
            else 0.0
        )

        if (
            probability >= 0.80
            and unified_score > 0.0
            and _risk_level_rank(
                getattr(
                    risk,
                    "risk_level",
                    None,
                )
            ) >= 3
        ):
            executive_alert_count += 1

    # -----------------------------------------------------
    # 9. Summary
    # -----------------------------------------------------

    summary = IntelligenceSummary(
        total_risks=total_risks,
        open_risks=open_risks,
        forecasted_risks=int(
            forecasted_risks
        ),
        high_probability_risks=int(
            high_probability_count
        ),
        executive_alerts=int(
            executive_alert_count
        ),
        avg_escalation_probability=float(
            avg_probability
        ),
        avg_expected_score_delta=float(
            avg_expected_delta
        ),
        forecast_coverage=int(
            forecasted_risks
        ),
        forecast_coverage_percent=float(
            forecast_coverage_percent
        ),
        baseline_forecast_risks=int(
            baseline_forecast_count
        ),
        ml_forecast_risks=int(
            ml_forecast_count
        ),
        insufficient_history_risks=int(
            insufficient_history_count
        ),
        latest_forecast_at=latest_forecast_at,
        total_inherent_exposure=float(
            total_inherent_exposure
        ),
        total_residual_exposure=float(
            total_residual_exposure
        ),
        total_unified_exposure=float(
            total_unified_exposure
        ),
        exposure_delta=float(
            exposure_delta
        ),
        exposure_delta_percent=float(
            exposure_delta_percent
        ),
        covered_risks=int(
            covered_risks
        ),
        uncovered_risks=int(
            max(
                total_risks - covered_risks,
                0,
            )
        ),
        coverage_percent=float(
            coverage_percent
        ),
    )

    # -----------------------------------------------------
    # 10. Top risks
    #
    # Unified score is the actual ranking metric.
    # No probability fallback.
    # -----------------------------------------------------

    scored_rows = []

    for forecast, risk, control in latest_rows:
        risk_id = int(risk.id)

        exposure = exposure_by_risk_id.get(
            risk_id
        )

        if exposure is not None:
            unified_score = float(
                exposure.unified_score or 0.0
            )
            residual_exposure = float(
                exposure.residual_exposure or 0.0
            )
            inherent_exposure = float(
                exposure.inherent_score or 0.0
            )
        else:
            unified_score = 0.0
            residual_exposure = 0.0
            inherent_exposure = float(
                getattr(
                    risk,
                    "score",
                    0,
                )
                or 0.0
            )

        history = history_map.get(
            risk_id,
            {
                "historical_change_count": 0,
                "changes_90d": 0,
                "avg_delta_90d": 0.0,
                "max_delta_90d": 0.0,
            },
        )

        scored_rows.append(
            {
                "unified_score": unified_score,
                "residual_exposure": residual_exposure,
                "inherent_exposure": inherent_exposure,
                "forecast": forecast,
                "risk": risk,
                "control": control,
                "history": history,
                "exposure": exposure,
            }
        )

    scored_rows.sort(
        key=lambda row: (
            float(row["unified_score"]),
            float(row["residual_exposure"]),
            float(
                row["forecast"].escalation_probability_30d
                or 0.0
            ),
        ),
        reverse=True,
    )

    # -----------------------------------------------------
    # 11. Top risks response
    # -----------------------------------------------------

    top_risks: List[IntelligenceTopRisk] = []

    for row in scored_rows[:10]:
        forecast = row["forecast"]
        risk = row["risk"]
        control = row["control"]
        exposure = row["exposure"]
        history = row["history"]

        risk_id = int(risk.id)

        process_meta = process_map.get(
            risk_id,
            {
                "ids": [],
                "names": [],
            },
        )

        top_risks.append(
            IntelligenceTopRisk(
                risk_id=risk_id,
                title=getattr(
                    risk,
                    "title",
                    None,
                ),
                current_score=getattr(
                    risk,
                    "score",
                    None,
                ),
                risk_level=getattr(
                    risk,
                    "risk_level",
                    None,
                ),
                status=getattr(
                    risk,
                    "status",
                    None,
                ),

                escalation_probability_30d=float(
                    forecast.escalation_probability_30d
                    or 0.0
                ),
                expected_score_delta=float(
                    forecast.expected_score_delta
                    or 0.0
                ),

                model_version=getattr(
                    forecast,
                    "model_version",
                    None,
                ),
                forecast_mode=_forecast_mode(
                    forecast
                ),
                forecast_status=_forecast_status(
                    forecast
                ),
                forecast_created_at=getattr(
                    forecast,
                    "created_at",
                    None,
                ),

                inherent_exposure=float(
                    row["inherent_exposure"]
                ),
                residual_exposure=float(
                    row["residual_exposure"]
                ),
                unified_score=float(
                    row["unified_score"]
                ),

                evidence_quality=float(
                    exposure.evidence_quality
                    if exposure
                    else 0.0
                ),
                linked_evidence_count=int(
                    exposure.linked_evidence_count
                    if exposure
                    else 0
                ),
                approved_evidence_count=int(
                    exposure.approved_evidence_count
                    if exposure
                    else 0
                ),

                density_factor=float(
                    exposure.density_factor
                    if exposure
                    else 0.0
                ),
                pressure_factor=float(
                    exposure.pressure_factor
                    if exposure
                    else 1.0
                ),
                velocity_factor=float(
                    exposure.velocity_factor
                    if exposure
                    else 1.0
                ),

                is_covered=bool(
                    exposure.approved_evidence_count > 0
                    if exposure
                    else False
                ),

                historical_change_count=int(
                    history[
                        "historical_change_count"
                    ]
                ),
                changes_90d=int(
                    history["changes_90d"]
                ),
                avg_delta_90d=float(
                    history["avg_delta_90d"]
                ),
                max_delta_90d=float(
                    history["max_delta_90d"]
                ),

                control_id=getattr(
                    risk,
                    "control_id",
                    None,
                ),
                control_code=(
                    getattr(
                        control,
                        "code",
                        None,
                    )
                    if control
                    else None
                ),
                control_title=(
                    getattr(
                        control,
                        "title",
                        None,
                    )
                    if control
                    else None
                ),

                process_ids=list(
                    process_meta["ids"]
                ),
                process_names=list(
                    process_meta["names"]
                ),
            )
        )

    # -----------------------------------------------------
    # 12. Top controls
    # -----------------------------------------------------

    control_agg: Dict[int, Dict[str, Any]] = {}

    for row in scored_rows:
        risk = row["risk"]
        control = row["control"]
        exposure = row["exposure"]

        control_id = getattr(
            risk,
            "control_id",
            None,
        )

        if control_id is None:
            continue

        probability = float(
            row["forecast"].escalation_probability_30d
            or 0.0
        )

        expected_delta = float(
            row["forecast"].expected_score_delta
            or 0.0
        )

        node = control_agg.setdefault(
            int(control_id),
            {
                "control_id": int(control_id),
                "control_code": (
                    getattr(
                        control,
                        "code",
                        None,
                    )
                    if control
                    else None
                ),
                "control_title": (
                    getattr(
                        control,
                        "title",
                        None,
                    )
                    if control
                    else None
                ),
                "risk_count": 0,
                "prob_sum": 0.0,
                "prob_max": 0.0,
                "delta_sum": 0.0,
                "unified_sum": 0.0,
                "covered_risk_count": 0,
                "uncovered_risk_count": 0,
                "unified_scores": [],
            },
        )

        node["risk_count"] += 1
        node["prob_sum"] += probability
        node["prob_max"] = max(
            node["prob_max"],
            probability,
        )
        node["delta_sum"] += expected_delta
        node["unified_sum"] += float(
            row["unified_score"]
        )
        node["unified_scores"].append(
            float(row["unified_score"])
        )

        if (
            exposure
            and int(
                exposure.approved_evidence_count
                or 0
            ) > 0
        ):
            node["covered_risk_count"] += 1
        else:
            node["uncovered_risk_count"] += 1

    top_controls_list = []

    for node in control_agg.values():
        risk_count = int(
            node["risk_count"]
        )

        avg_probability = (
            node["prob_sum"] / risk_count
            if risk_count
            else 0.0
        )

        unified_scores = node[
            "unified_scores"
        ]

        avg_unified = (
            sum(unified_scores)
            / len(unified_scores)
            if unified_scores
            else 0.0
        )

        max_unified = (
            max(unified_scores)
            if unified_scores
            else 0.0
        )

        top_controls_list.append(
            IntelligenceTopControl(
                control_id=int(
                    node["control_id"]
                ),
                control_code=node.get(
                    "control_code"
                ),
                control_title=node.get(
                    "control_title"
                ),
                risk_count=risk_count,
                avg_escalation_probability=float(
                    avg_probability
                ),
                max_escalation_probability=float(
                    node["prob_max"]
                ),
                expected_score_delta_sum=float(
                    node["delta_sum"]
                ),
                ai_priority_score=float(
                    node["unified_sum"]
                ),
                covered_risk_count=int(
                    node["covered_risk_count"]
                ),
                uncovered_risk_count=int(
                    node["uncovered_risk_count"]
                ),
                avg_unified_exposure=float(
                    avg_unified
                ),
                max_unified_exposure=float(
                    max_unified
                ),
            )
        )

    top_controls = sorted(
        top_controls_list,
        key=lambda item: (
            item.ai_priority_score,
            item.max_unified_exposure,
        ),
        reverse=True,
    )[:10]

    # -----------------------------------------------------
    # 13. Executive alerts
    # -----------------------------------------------------

    exec_alerts: List[
        IntelligenceExecutiveAlert
    ] = []

    for row in scored_rows:
        forecast = row["forecast"]
        risk = row["risk"]
        control = row["control"]
        exposure = row["exposure"]

        probability = float(
            forecast.escalation_probability_30d
            or 0.0
        )

        unified_score = float(
            row["unified_score"]
        )

        risk_rank = _risk_level_rank(
            getattr(
                risk,
                "risk_level",
                None,
            )
        )

        if (
            probability < 0.80
            or unified_score <= 0.0
            or risk_rank < 3
        ):
            continue

        risk_id = int(risk.id)

        process_meta = process_map.get(
            risk_id,
            {
                "ids": [],
                "names": [],
            },
        )

        exec_alerts.append(
            IntelligenceExecutiveAlert(
                risk_id=risk_id,
                title=getattr(
                    risk,
                    "title",
                    None,
                ),
                current_score=getattr(
                    risk,
                    "score",
                    None,
                ),
                risk_level=getattr(
                    risk,
                    "risk_level",
                    None,
                ),
                escalation_probability_30d=probability,
                expected_score_delta=float(
                    forecast.expected_score_delta
                    or 0.0
                ),
                residual_exposure=float(
                    row["residual_exposure"]
                ),
                unified_score=unified_score,
                model_version=getattr(
                    forecast,
                    "model_version",
                    None,
                ),
                forecast_mode=_forecast_mode(
                    forecast
                ),
                forecast_status=_forecast_status(
                    forecast
                ),
                forecast_created_at=getattr(
                    forecast,
                    "created_at",
                    None,
                ),
                linked_evidence_count=int(
                    exposure.linked_evidence_count
                    if exposure
                    else 0
                ),
                approved_evidence_count=int(
                    exposure.approved_evidence_count
                    if exposure
                    else 0
                ),
                is_covered=bool(
                    exposure.approved_evidence_count > 0
                    if exposure
                    else False
                ),
                control_id=getattr(
                    risk,
                    "control_id",
                    None,
                ),
                control_code=(
                    getattr(
                        control,
                        "code",
                        None,
                    )
                    if control
                    else None
                ),
                process_names=list(
                    process_meta["names"]
                ),
            )
        )

    exec_alerts = sorted(
        exec_alerts,
        key=lambda item: (
            item.unified_score,
            item.escalation_probability_30d,
        ),
        reverse=True,
    )[:10]

    return IntelligenceOverviewResponse(
        summary=summary,
        top_risks=top_risks,
        top_controls=top_controls,
        executive_alerts=exec_alerts,
    )


# =========================================================
# DASHBOARD
# =========================================================

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


# =========================================================
# EVIDENCE
# =========================================================

@router.get("/evidence")
def get_intelligence_evidence(
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id

    res = db.execute(
        text(
            "SELECT * FROM analytics.v_evidence_intelligence "
            "WHERE tenant_id = :tenant_id LIMIT :limit"
        ),
        {
            "tenant_id": tenant_id,
            "limit": int(limit),
        },
    )

    return _rows_to_dicts(res)


# =========================================================
# RISK EXPOSURE
# =========================================================

@router.get("/risk-exposure")
def get_risk_exposure(
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id

    rows = ExposureEngine(
        db
    ).compute_risk_exposure(
        tenant_id=tenant_id,
        limit=int(limit),
    )

    return [
        {
            "tenant_id": int(r.tenant_id),
            "risk_id": int(r.risk_id),
            "risk_version_id": int(
                r.risk_version_id
            ),
            "risk_score": float(
                r.inherent_score
            ),
            "linked_evidence_count": int(
                r.linked_evidence_count
            ),
            "approved_evidence_count": int(
                r.approved_evidence_count
            ),
            "is_covered": bool(
                r.approved_evidence_count > 0
            ),
            "exposure_score": float(
                r.residual_exposure
            ),
            "evidence_quality": float(
                r.evidence_quality
            ),
            "density_factor": float(
                r.density_factor
            ),
            "pressure_factor": float(
                r.pressure_factor
            ),
            "velocity_factor": float(
                r.velocity_factor
            ),
            "escalation_probability_30d": float(
                r.escalation_probability_30d
            ),
            "expected_score_delta": float(
                r.expected_score_delta
            ),
            "unified_score": float(
                r.unified_score
            ),
            "control_id": r.control_id,
            "risk_level": r.risk_level,
            "title": r.title,
        }
        for r in rows
    ]


# =========================================================
# ESCALATION DISTRIBUTION
# =========================================================

@router.get("/escalation-distribution")
def get_escalation_distribution(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id

    rows = db.execute(
        text(
            "SELECT probability_bucket, risk_count "
            "FROM analytics.v_escalation_distribution "
            "WHERE tenant_id = :tenant_id "
            "ORDER BY probability_bucket"
        ),
        {"tenant_id": tenant_id},
    ).mappings().all()

    return [
        {
            "probability_bucket": row[
                "probability_bucket"
            ],
            "risk_count": row["risk_count"],
        }
        for row in rows
    ]


# =========================================================
# EXPOSURE COVERAGE
# =========================================================

@router.get("/exposure-coverage")
def get_exposure_coverage(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id

    rows = db.execute(
        text(
            "SELECT risk_bucket, coverage_bucket, risk_count "
            "FROM analytics.v_exposure_coverage_matrix "
            "WHERE tenant_id = :tenant_id"
        ),
        {"tenant_id": tenant_id},
    ).mappings().all()

    return [
        {
            "risk_bucket": row[
                "risk_bucket"
            ],
            "coverage_bucket": row[
                "coverage_bucket"
            ],
            "risk_count": row[
                "risk_count"
            ],
        }
        for row in rows
    ]


# =========================================================
# GAPS
# =========================================================

@router.get("/gaps")
def get_gap_intelligence(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id

    rows = db.execute(
        text(
            """
            SELECT
                gi.id,
                gi.risk_id,
                gi.control_id,
                gi.severity_score,
                gi.status,
                co.code AS control_code,
                co.title AS control_title,
                r.title AS risk_title,
                r.risk_level,
                t.id AS task_id,
                t.status AS task_status
            FROM gap_items gi
            LEFT JOIN controls co
                ON co.id = gi.control_id
            LEFT JOIN risks r
                ON r.id = gi.risk_id
            LEFT JOIN compliance_tasks t
                ON t.source_type = 'control_gap_auto'
               AND t.source_id = gi.control_id
               AND t.status IN (
                   'open',
                   'in_progress'
               )
            WHERE gi.tenant_id = :tenant_id
            ORDER BY gi.severity_score DESC NULLS LAST
            """
        ),
        {"tenant_id": tenant_id},
    ).mappings().all()

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

    exposure_rows = ExposureEngine(
        db
    ).compute_risk_exposure(
        tenant_id=tenant_id,
        limit=100000,
    )

    exposure_map = {
        int(row.risk_id): row
        for row in exposure_rows
    }

    control_map: Dict[int, Dict[str, Any]] = {}

    for row in rows:
        cid = row["control_id"]
        rid = row["risk_id"]

        node = control_map.setdefault(
            cid,
            {
                "control_id": cid,
                "control_code": row[
                    "control_code"
                ],
                "control_title": row[
                    "control_title"
                ],
                "gap_count": 0,
                "worst_severity": 0.0,
                "risks": {},
            },
        )

        node["gap_count"] += 1

        severity = float(
            row["severity_score"] or 0.0
        )

        node["worst_severity"] = max(
            node["worst_severity"],
            severity,
        )

        if rid not in node["risks"]:
            exposure = exposure_map.get(
                int(rid)
            )

            node["risks"][rid] = {
                "risk_id": rid,
                "risk_title": row[
                    "risk_title"
                ],
                "risk_level": row[
                    "risk_level"
                ],
                "exposure_score": float(
                    exposure.residual_exposure
                )
                if exposure
                else 0.0,
                "escalation_probability": float(
                    exposure.escalation_probability_30d
                )
                if exposure
                else 0.0,
                "expected_score_delta": float(
                    exposure.expected_score_delta
                )
                if exposure
                else 0.0,
                "gap_count": 0,
                "worst_severity": 0.0,
                "gaps": [],
            }

        risk_node = node["risks"][rid]

        risk_node["gap_count"] += 1

        risk_node["worst_severity"] = max(
            risk_node["worst_severity"],
            severity,
        )

        risk_node["gaps"].append(
            {
                "gap_id": row["id"],
                "severity_score": severity,
                "status": row["status"],
                "task_id": row.get(
                    "task_id"
                ),
                "task_status": row.get(
                    "task_status"
                ),
            }
        )

    controls_out = []

    for control in control_map.values():
        risks_list = list(
            control["risks"].values()
        )

        avg_exposure = (
            sum(
                float(
                    risk.get(
                        "exposure_score",
                        0.0,
                    )
                    or 0.0
                )
                for risk in risks_list
            )
            / len(risks_list)
            if risks_list
            else 0.0
        )

        avg_escalation = (
            sum(
                float(
                    risk.get(
                        "escalation_probability",
                        0.0,
                    )
                    or 0.0
                )
                for risk in risks_list
            )
            / len(risks_list)
            if risks_list
            else 0.0
        )

        controls_out.append(
            {
                "control_id": control[
                    "control_id"
                ],
                "control_code": control[
                    "control_code"
                ],
                "control_title": control[
                    "control_title"
                ],
                "gap_count": control[
                    "gap_count"
                ],
                "worst_severity": control[
                    "worst_severity"
                ],
                "ai_priority_score": _control_ai_priority(
                    control[
                        "worst_severity"
                    ],
                    avg_exposure,
                    avg_escalation,
                    control[
                        "gap_count"
                    ],
                ),
                "risks": risks_list,
            }
        )

    controls_out.sort(
        key=lambda item: float(
            item["ai_priority_score"]
        ),
        reverse=True,
    )

    total = len(rows)

    uncovered = sum(
        1
        for row in rows
        if (
            row.get("status") or ""
        ).lower()
        == "uncovered"
    )

    partial = sum(
        1
        for row in rows
        if (
            row.get("status") or ""
        ).lower()
        == "partial"
    )

    worst = max(
        float(
            row.get(
                "severity_score",
                0.0,
            )
            or 0.0
        )
        for row in rows
    )

    trend_rows = db.execute(
        text(
            """
            SELECT
                date_trunc(
                    'day',
                    created_at
                ) AS day,
                count(*) AS gap_count,
                coalesce(
                    max(severity_score),
                    0
                ) AS worst_severity
            FROM gap_items
            WHERE tenant_id = :tenant_id
            GROUP BY day
            ORDER BY day
            """
        ),
        {"tenant_id": tenant_id},
    ).mappings().all()

    trend = [
        {
            "day": (
                row["day"].isoformat()
                if row["day"]
                else None
            ),
            "gap_count": int(
                row["gap_count"] or 0
            ),
            "worst_severity": float(
                row["worst_severity"] or 0
            ),
        }
        for row in trend_rows
    ]

    return {
        "summary": {
            "gaps_total": total,
            "uncovered": uncovered,
            "partial": partial,
            "worst_severity_score": worst,
        },
        "controls": controls_out,
        "trend": trend,
    }


# =========================================================
# GAP TREND
# =========================================================

@router.get("/gaps/trend")
def get_gap_trend(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id

    rows = db.execute(
        text(
            """
            SELECT
                date_trunc(
                    'day',
                    created_at
                ) AS day,
                count(*) AS gap_count,
                sum(
                    CASE
                        WHEN lower(status)
                            = 'uncovered'
                        THEN 1
                        ELSE 0
                    END
                ) AS uncovered_count,
                avg(severity_score)
                    AS avg_severity
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
            "day": (
                row["day"].isoformat()
                if row["day"]
                else None
            ),
            "gap_count": int(
                row["gap_count"] or 0
            ),
            "uncovered_count": int(
                row["uncovered_count"] or 0
            ),
            "avg_severity": float(
                row["avg_severity"] or 0
            ),
        }
        for row in rows
    ]


# =========================================================
# CONTROL HEALTH
# =========================================================

@router.get("/control-health")
@api_router.get("/control-health")
def get_control_health(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
):
    """
    Canonical Control Health endpoint.

    Calculation is delegated to ControlHealthEngine.
    Model weights are supplied by the active Intelligence
    Configuration for the current tenant.
    """

    tenant_id = user.tenant_id

    weights = get_active_control_health_weights(
        db=db,
        tenant_id=tenant_id,
    )

    engine = ControlHealthEngine(
        weights=weights,
    )

    controls = db.execute(
        text(
            """
            SELECT DISTINCT
                c.id AS control_id
            FROM controls c
            INNER JOIN matrix_instances mi
                ON mi.standard_version_id = c.standard_version_id
            WHERE mi.tenant_id = :tenant_id
            ORDER BY c.id
            """
        ),
        {
            "tenant_id": tenant_id,
        },
    ).mappings().all()

    results = []

    for row in controls:
        try:
            result = engine.calculate(
                db=db,
                tenant_id=tenant_id,
                control_id=int(row["control_id"]),
            )
            results.append(result)
        except ValueError:
            continue

    healthy_controls = sum(
        1
        for result in results
        if result.health_index >= 80.0
    )

    partial_controls = sum(
        1
        for result in results
        if 55.0 <= result.health_index < 80.0
    )

    weak_controls = sum(
        1
        for result in results
        if 0.0 < result.health_index < 55.0
    )

    no_evidence_controls = sum(
        1
        for result in results
        if result.evidence_count == 0
    )

    average_health = (
        sum(
            result.health_index
            for result in results
        )
        / len(results)
        if results
        else 0.0
    )

    control_rows = []

    for result in results:
        if result.health_index >= 80.0:
            status = "Healthy"
        elif result.health_index >= 55.0:
            status = "Partial"
        elif result.evidence_count == 0:
            status = "No Evidence"
        else:
            status = "Weak"

        control_rows.append(
            {
                "control_id": result.control_id,
                "control_code": result.control_code,
                "control_title": result.control_title,
                "health_index": result.health_index,
                "status": status,
                "gap_count": result.gap_count,
                "worst_severity": result.worst_gap_severity,
                "risk_count": result.risk_count,
                "evidence_count": result.evidence_count,
            }
        )

    control_rows.sort(
        key=lambda item: (
            -float(item["health_index"]),
            str(item["control_code"] or ""),
        )
    )

    return {
        "summary": {
            "total_controls": len(results),
            "healthy_controls": healthy_controls,
            "partial_controls": partial_controls,
            "weak_controls": weak_controls,
            "no_evidence_controls": no_evidence_controls,
            "average_health": round(
                average_health,
                2,
            ),
        },
        "controls": control_rows,
    }



# =========================================================
# CONTROL HEALTH DETAIL
# =========================================================

@router.get("/control-health/{control_id}")
@api_router.get("/control-health/{control_id}")
def get_control_health_detail(
    control_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
):
    """
    Canonical Control Health detail endpoint.

    Uses the same ControlHealthEngine and active tenant
    configuration as the Control Health register.
    """

    tenant_id = user.tenant_id

    weights = get_active_control_health_weights(
        db=db,
        tenant_id=tenant_id,
    )

    engine = ControlHealthEngine(
        weights=weights,
    )

    try:
        result = engine.calculate(
            db=db,
            tenant_id=tenant_id,
            control_id=control_id,
        )
    except ValueError:
        raise HTTPException(
            status_code=404,
            detail="Control not found",
        )

    risks = db.execute(
        text(
            """
            SELECT
                r.id,
                r.title,
                r.score,
                r.likelihood,
                r.impact,
                r.risk_level,
                rf.escalation_probability_30d
            FROM risks r
            LEFT JOIN (
                SELECT
                    risk_id,
                    escalation_probability_30d,
                    ROW_NUMBER() OVER (
                        PARTITION BY risk_id
                        ORDER BY created_at DESC, id DESC
                    ) AS rn
                FROM risk_forecasts
                WHERE tenant_id = :tenant_id
            ) rf
                ON rf.risk_id = r.id
               AND rf.rn = 1
            WHERE r.tenant_id = :tenant_id
              AND r.control_id = :control_id
            ORDER BY r.score DESC NULLS LAST, r.id DESC
            """
        ),
        {
            "tenant_id": tenant_id,
            "control_id": control_id,
        },
    ).mappings().all()

    gaps = db.execute(
        text(
            """
            SELECT
                id,
                risk_id,
                severity_score,
                status,
                created_at
            FROM gap_items
            WHERE tenant_id = :tenant_id
              AND control_id = :control_id
            ORDER BY severity_score DESC NULLS LAST, id DESC
            """
        ),
        {
            "tenant_id": tenant_id,
            "control_id": control_id,
        },
    ).mappings().all()

    tasks = db.execute(
        text(
            """
            SELECT
                id,
                title,
                description,
                status,
                owner_role,
                due_date,
                created_at
            FROM compliance_tasks
            WHERE tenant_id = :tenant_id
              AND control_id = :control_id
            ORDER BY
                CASE
                    WHEN LOWER(COALESCE(status, '')) IN ('closed', 'cancelled')
                    THEN 1
                    ELSE 0
                END,
                due_date ASC NULLS LAST,
                id DESC
            """
        ),
        {
            "tenant_id": tenant_id,
            "control_id": control_id,
        },
    ).mappings().all()

    return {
        "control": {
            "control_id": result.control_id,
            "control_code": result.control_code,
            "control_title": result.control_title,
        },
        "health": {
            "health_index": result.health_index,
            "coverage_health": result.coverage_health,
            "evidence_quality": result.evidence_quality,
            "risk_health": result.risk_health,
            "gap_health": result.gap_health,
            "remediation_health": result.remediation_health,
        },
        "metrics": {
            "evidence_count": result.evidence_count,
            "approved_evidence_count": result.approved_evidence_count,
            "risk_count": result.risk_count,
            "gap_count": result.gap_count,
            "open_task_count": result.open_task_count,
            "worst_risk_score": result.worst_risk_score,
            "worst_gap_severity": result.worst_gap_severity,
        },
        "risks": [dict(row) for row in risks],
        "gaps": [dict(row) for row in gaps],
        "tasks": [dict(row) for row in tasks],
    }


# =========================================================
# PROCESS READINESS
# =========================================================

@router.get("/readiness/processes")
def get_process_readiness(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("executive.view")),
    scope=Depends(require_tenant_scope()),
):
    result = db.execute(
        text(
            """
            SELECT
                tenant_id,
                process_id,
                process_name,
                control_count
            FROM analytics.v_process_readiness
            ORDER BY control_count DESC
            """
        )
    ).mappings().all()

    return list(result)


# =========================================================
# GAP -> TASK
# =========================================================

@router.post("/gaps/{gap_id}/create-task")
def create_task_from_gap(
    gap_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    gap = db.execute(
        text(
            """
            SELECT
                tenant_id,
                control_id,
                risk_id
            FROM gap_items
            WHERE id = :gap_id
            LIMIT 1
            """
        ),
        {"gap_id": gap_id},
    ).mappings().first()

    if not gap:
        raise HTTPException(
            status_code=404,
            detail="Gap not found",
        )

    title = (
        payload.get("title")
        or "Remediate control gap"
    )

    description = (
        payload.get("description")
        or "Gap remediation task"
    )

    owner_role = payload.get(
        "owner_role"
    )

    due_date = payload.get(
        "due_date"
    )

    task_id = db.execute(
        text(
            """
            INSERT INTO compliance_tasks(
                tenant_id,
                process_id,
                control_id,
                status,
                created_at,
                updated_at,
                title,
                description,
                owner_role,
                due_date,
                source_type,
                source_id
            )
            VALUES(
                :tenant_id,
                NULL,
                :control_id,
                'OPEN',
                now(),
                now(),
                :title,
                :description,
                :owner_role,
                :due_date,
                'control_gap_auto',
                :gap_id
            )
            RETURNING id
            """
        ),
        {
            "tenant_id": gap["tenant_id"],
            "control_id": gap["control_id"],
            "title": title,
            "description": description,
            "owner_role": owner_role,
            "due_date": due_date,
            "gap_id": gap_id,
        },
    ).scalar()

    db.commit()

    return {
        "success": True,
        "task_id": task_id,
    }


# =========================================================
# INTELLIGENCE MODEL CONFIGURATION
# =========================================================

def _validate_uee_weights(
    risk_weight: float,
    coverage_weight: float,
    maturity_weight: float,
    evidence_weight: float,
    task_pressure_weight: float,
) -> None:
    weights = {
        "risk": float(risk_weight),
        "coverage": float(coverage_weight),
        "maturity": float(maturity_weight),
        "evidence": float(evidence_weight),
        "task_pressure": float(task_pressure_weight),
    }

    for name, value in weights.items():
        if value < 0.0 or value > 1.0:
            raise HTTPException(
                status_code=422,
                detail=f"{name}_weight must be between 0 and 1",
            )

    total = sum(weights.values())

    if abs(total - 1.0) > 0.000001:
        raise HTTPException(
            status_code=422,
            detail={
                "message": "UEE weighting total must equal 1.0",
                "total": round(total, 6),
            },
        )


@router.get(
    "/configuration",
    response_model=IntelligenceConfigurationResponse,
)
def get_intelligence_configuration(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("executive.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id

    config = db.execute(
        select(IntelligenceModelConfig)
        .where(
            IntelligenceModelConfig.tenant_id == tenant_id,
            IntelligenceModelConfig.model_name == "UEE",
            IntelligenceModelConfig.active.is_(True),
        )
        .order_by(
            IntelligenceModelConfig.version.desc()
        )
        .limit(1)
    ).scalar_one_or_none()

    if not config:
        raise HTTPException(
            status_code=404,
            detail="No active UEE configuration found",
        )

    return config


@router.post(
    "/configuration/draft",
    response_model=IntelligenceConfigurationResponse,
)
def create_intelligence_configuration_draft(
    payload: IntelligenceConfigurationDraftRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("executive.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id

    _validate_uee_weights(
        payload.risk_weight,
        payload.coverage_weight,
        payload.maturity_weight,
        payload.evidence_weight,
        payload.task_pressure_weight,
    )

    latest_version = db.execute(
        select(func.max(IntelligenceModelConfig.version))
        .where(
            IntelligenceModelConfig.tenant_id == tenant_id,
            IntelligenceModelConfig.model_name == "UEE",
        )
    ).scalar()

    next_version = int(latest_version or 0) + 1

    config = IntelligenceModelConfig(
        tenant_id=tenant_id,
        model_name="UEE",
        version=next_version,
        status="DRAFT",
        risk_weight=payload.risk_weight,
        coverage_weight=payload.coverage_weight,
        maturity_weight=payload.maturity_weight,
        evidence_weight=payload.evidence_weight,
        task_pressure_weight=payload.task_pressure_weight,
        effective_from=None,
        change_reason=payload.change_reason,
        created_by=user.id,
        active=False,
    )

    db.add(config)
    db.commit()
    db.refresh(config)

    return config
# =========================================================
# INTELLIGENCE MODEL CONFIGURATION - PREVIEW
# =========================================================

@router.post(
    "/configuration/preview",
    response_model=IntelligenceConfigurationPreviewResponse,
)
def preview_intelligence_configuration(
    payload: IntelligenceConfigurationPreviewRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("executive.view")),
    scope=Depends(require_tenant_scope()),
):
    tenant_id = user.tenant_id

    _validate_uee_weights(
        payload.risk_weight,
        payload.coverage_weight,
        payload.maturity_weight,
        payload.evidence_weight,
        payload.task_pressure_weight,
    )

    from app.services.uee_engine import UEEEngine, UEEWeights

    # -----------------------------------------------------
    # Current canonical UEE
    # -----------------------------------------------------

    current_engine = UEEEngine(
        weights_provider=get_active_uee_weights,
    )

    current_state = current_engine.compute_summary(
        db=db,
        tenant_id=tenant_id,
    )

    # -----------------------------------------------------
    # Preview weights
    #
    # IMPORTANT:
    # Do not persist these weights.
    # Do not create a configuration record.
    # Use the exact same canonical UEE engine.
    # -----------------------------------------------------

    preview_weights = UEEWeights(
        risk=float(payload.risk_weight),
        coverage=float(payload.coverage_weight),
        maturity=float(payload.maturity_weight),
        evidence=float(payload.evidence_weight),
        task_pressure=float(payload.task_pressure_weight),
    ).normalized()

    preview_engine = UEEEngine(
        default_weights=preview_weights,
    )

    preview_state = preview_engine.compute_summary(
        db=db,
        tenant_id=tenant_id,
    )

    current_version = db.execute(
        select(func.max(IntelligenceModelConfig.version))
        .where(
            IntelligenceModelConfig.tenant_id == tenant_id,
            IntelligenceModelConfig.model_name == "UEE",
            IntelligenceModelConfig.active.is_(True),
        )
    ).scalar()

    return IntelligenceConfigurationPreviewResponse(
        current_model_version=(
            int(current_version)
            if current_version is not None
            else None
        ),
        current_unified_exposure=float(
            current_state.unified_exposure_score
        ),
        projected_unified_exposure=float(
            preview_state.unified_exposure_score
        ),
        current_compliance_health=float(
            current_state.compliance_health_index
        ),
        projected_compliance_health=float(
            preview_state.compliance_health_index
        ),
        exposure_delta=float(
            preview_state.unified_exposure_score
            - current_state.unified_exposure_score
        ),
        health_delta=float(
            preview_state.compliance_health_index
            - current_state.compliance_health_index
        ),
        effective_weights=dict(
            preview_state.weights
        ),
        warnings=list(
            dict.fromkeys(
                list(current_state.warnings)
                + list(preview_state.warnings)
            )
        ),
    )

