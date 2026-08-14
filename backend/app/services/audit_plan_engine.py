from __future__ import annotations

from datetime import date, timedelta
from typing import Dict, List, Optional

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.models.controls import Control
from app.models.controls_coverage import ControlsCoverage
from app.models.process import Process
from app.models.process_risk_link import ProcessRiskLink
from app.models.risk_forecasts import RiskForecast
from app.models.risks import Risk
from app.models.user import User
from app.schemas.audit_plan_schema import AuditActionItem, AuditPlanResponse


class AuditPlanEngine:
    """
    Generates a risk-based internal audit plan for a process.

    Priority is derived from four signals already available in the platform:
      - current risk score
      - control coverage weakness
      - 30-day escalation probability
      - expected risk-score delta

    The engine is tenant-safe and only considers risks explicitly linked to
    the requested process.
    """

    @staticmethod
    def _coverage_status(
        coverage: Optional[ControlsCoverage],
    ) -> str:
        if not coverage or not coverage.coverage_status:
            return "uncovered"

        status = str(coverage.coverage_status).strip().lower()

        if status in {"covered", "achieved", "fully_achieved"}:
            return "covered"

        if status in {
            "partial",
            "partially_achieved",
            "partially-covered",
            "partially_covered",
        }:
            return "partial"

        return "uncovered"

    @staticmethod
    def _coverage_priority(status: str) -> float:
        return {
            "covered": 0.0,
            "partial": 15.0,
            "uncovered": 25.0,
        }.get(status, 25.0)

    @staticmethod
    def _risk_level(score: Optional[int], existing_level: Optional[str]) -> str:
        if existing_level:
            return str(existing_level).upper()

        value = int(score or 0)
        if value >= 17:
            return "CRITICAL"
        if value >= 10:
            return "HIGH"
        if value >= 5:
            return "MEDIUM"
        return "LOW"

    @staticmethod
    def _priority_label(score: float) -> str:
        if score >= 75:
            return "CRITICAL"
        if score >= 55:
            return "HIGH"
        if score >= 35:
            return "MEDIUM"
        return "LOW"

    @staticmethod
    def _due_date(priority: str) -> date:
        days = {
            "CRITICAL": 7,
            "HIGH": 14,
            "MEDIUM": 30,
            "LOW": 60,
        }
        return date.today() + timedelta(days=days[priority])

    @staticmethod
    def _latest_forecasts(
        forecasts: List[RiskForecast],
    ) -> Dict[int, RiskForecast]:
        latest: Dict[int, RiskForecast] = {}

        for forecast in forecasts:
            current = latest.get(forecast.risk_id)
            if current is None or (
                forecast.created_at is not None
                and (
                    current.created_at is None
                    or forecast.created_at > current.created_at
                )
            ):
                latest[forecast.risk_id] = forecast

        return latest

    @staticmethod
    def _priority_score(
        max_risk_score: int,
        coverage_status: str,
        escalation_probability: float,
        expected_score_delta: float,
    ) -> float:
        """
        100-point audit priority model:

        Risk severity              35%
        Coverage weakness          25%
        30-day escalation           25%
        Expected score delta        15%
        """
        risk_component = min(max(max_risk_score, 0), 25) / 25 * 35
        coverage_component = AuditPlanEngine._coverage_priority(coverage_status)
        escalation_component = min(max(escalation_probability, 0.0), 1.0) * 25
        delta_component = min(max(expected_score_delta, 0.0), 10.0) / 10 * 15

        return round(
            min(
                100.0,
                risk_component
                + coverage_component
                + escalation_component
                + delta_component,
            ),
            2,
        )

    @staticmethod
    def generate(
        process_id: int,
        db: Session,
        user: User,
    ) -> AuditPlanResponse:
        """Generate a tenant-safe, risk-based audit plan for a process."""

        process = db.execute(
            select(Process).where(
                and_(
                    Process.id == process_id,
                    Process.tenant_id == user.tenant_id,
                )
            )
        ).scalar_one_or_none()

        if not process:
            raise ValueError("Process not found")

        # Only risks explicitly assigned to this process are eligible.
        risk_links = db.execute(
            select(ProcessRiskLink).where(
                and_(
                    ProcessRiskLink.process_id == process_id,
                    ProcessRiskLink.tenant_id == user.tenant_id,
                )
            )
        ).scalars().all()

        # A process-risk link should be unique, but tolerate legacy duplicate
        # link rows so one risk cannot inflate an audit action's risk_count or
        # distort its priority.
        risk_ids = {int(link.risk_id) for link in risk_links if link.risk_id is not None}
        if not risk_ids:
            return AuditPlanResponse(
                process_id=process_id,
                total_actions=0,
                critical_actions=0,
                actions=[],
            )

        risks = db.execute(
            select(Risk).where(
                and_(
                    Risk.id.in_(risk_ids),
                    Risk.tenant_id == user.tenant_id,
                )
            )
        ).scalars().all()

        # A control is the auditable unit. Aggregate all distinct process risks
        # that point to the same control into one prioritized audit action.
        risk_by_control: Dict[int, Dict[int, Risk]] = {}
        for risk in risks:
            if risk.control_id is not None:
                risk_by_control.setdefault(int(risk.control_id), {})[int(risk.id)] = risk

        if not risk_by_control:
            return AuditPlanResponse(
                process_id=process_id,
                total_actions=0,
                critical_actions=0,
                actions=[],
            )

        control_ids = list(risk_by_control.keys())

        controls = db.execute(
            select(Control).where(
                and_(
                    Control.id.in_(control_ids),
                )
            )
        ).scalars().all()
        controls_by_id = {control.id: control for control in controls}

        # ControlsCoverage is a global per-control table (control_id is unique),
        # so there is no tenant predicate on this model. The process/risk/control
        # scope above remains tenant-safe.
        coverage_rows = db.execute(
            select(ControlsCoverage).where(
                ControlsCoverage.control_id.in_(control_ids)
            )
        ).scalars().all()
        coverage_by_control = {row.control_id: row for row in coverage_rows}

        forecasts = db.execute(
            select(RiskForecast).where(
                and_(
                    RiskForecast.tenant_id == user.tenant_id,
                    RiskForecast.risk_id.in_(list(risk_ids)),
                )
            )
        ).scalars().all()
        latest_forecast_by_risk = AuditPlanEngine._latest_forecasts(forecasts)

        actions: List[AuditActionItem] = []

        for control_id, risk_map in risk_by_control.items():
            control_risks = list(risk_map.values())
            control = controls_by_id.get(control_id)
            if not control:
                continue

            coverage = coverage_by_control.get(control_id)
            coverage_status = AuditPlanEngine._coverage_status(coverage)

            max_risk_score = max(int(r.score or 0) for r in control_risks)
            highest_risk = max(
                control_risks,
                key=lambda r: int(r.score or 0),
            )
            highest_risk_level = AuditPlanEngine._risk_level(
                highest_risk.score,
                highest_risk.risk_level,
            )

            relevant_forecasts = [
                latest_forecast_by_risk[risk.id]
                for risk in control_risks
                if risk.id in latest_forecast_by_risk
            ]

            escalation_probability = max(
                (
                    float(f.escalation_probability_30d or 0.0)
                    for f in relevant_forecasts
                ),
                default=0.0,
            )
            expected_score_delta = max(
                (
                    float(f.expected_score_delta or 0.0)
                    for f in relevant_forecasts
                ),
                default=0.0,
            )

            latest_forecast = max(
                relevant_forecasts,
                key=lambda f: f.created_at,
                default=None,
            )

            ai_priority_score = AuditPlanEngine._priority_score(
                max_risk_score=max_risk_score,
                coverage_status=coverage_status,
                escalation_probability=escalation_probability,
                expected_score_delta=expected_score_delta,
            )
            priority = AuditPlanEngine._priority_label(ai_priority_score)

            requirement = control.requirement
            clause = requirement.clause if requirement else None
            standard_version = control.standard_version
            standard = standard_version.standard if standard_version else None

            actions.append(
                AuditActionItem(
                    priority_score=int(round(ai_priority_score)),
                    standard_code=standard.code if standard else None,
                    clause_code=clause.code if clause else None,
                    requirement_code=requirement.code if requirement else None,
                    control_code=control.code,
                    control_id=control.id,
                    status="planned",
                    risk_count=len(control_risks),
                    max_risk_score=max_risk_score,
                    highest_risk_level=highest_risk_level,
                    escalation_probability=round(escalation_probability, 4),
                    expected_score_delta=round(expected_score_delta, 2),
                    ai_priority_score=ai_priority_score,
                    forecast_version=(
                        latest_forecast.model_version
                        if latest_forecast
                        else None
                    ),
                    suggested_owner_role="process_owner",
                    suggested_due_date=AuditPlanEngine._due_date(priority),
                    suggested_evidence_types=[
                        "policy",
                        "procedure",
                        "operational_record",
                    ],
                )
            )

        actions.sort(
            key=lambda item: (
                -item.ai_priority_score,
                item.control_code or "",
                item.control_id,
            )
        )

        critical_actions = sum(
            1 for action in actions if action.ai_priority_score >= 75
        )

        return AuditPlanResponse(
            process_id=process_id,
            total_actions=len(actions),
            critical_actions=critical_actions,
            actions=actions,
        )
