from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.risks import Risk
from app.models.risk_forecasts import RiskForecast


@dataclass(frozen=True)
class DecisionRuleSet:
    """
    Production defaults. Later make tenant-configurable from DB.
    """
    high_prob_threshold: float = 0.70
    exec_alert_threshold: float = 0.80
    delta_threshold_task: float = 3.0
    delta_threshold_gap: float = 5.0

    max_exec_alerts: int = 10
    max_watchlist: int = 25


@dataclass(frozen=True)
class DecisionAction:
    action_type: str  # "audit_item" | "gap_item" | "compliance_task" | "watchlist"
    priority: str     # "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

    title: str
    description: str

    risk_id: int
    control_id: Optional[int]
    process_id: Optional[int]

    forecast_id: int
    model_version: Optional[str]

    escalation_probability_30d: float
    expected_score_delta: float

    payload: Dict[str, Any]


class RiskDecisionEngine:
    """
    Reads latest forecasts (tenant-scoped), generates execution actions.

    This is PURE decision logic.
    Persistence is handled by adapters/routes.
    """

    def __init__(self, rules: Optional[DecisionRuleSet] = None):
        self.rules = rules or DecisionRuleSet()

    def _utcnow(self) -> datetime:
        return datetime.now(timezone.utc)

    def _priority(self, prob: float, delta: float, risk_level: Optional[str]) -> str:
        rl = (risk_level or "").upper().strip()
        if rl == "CRITICAL" and prob >= 0.60:
            return "CRITICAL"
        if prob >= self.rules.exec_alert_threshold or delta >= self.rules.delta_threshold_gap:
            return "HIGH"
        if prob >= self.rules.high_prob_threshold or delta >= self.rules.delta_threshold_task:
            return "MEDIUM"
        return "LOW"

    def _safe_reason(self, explanation: Any) -> str:
        try:
            if isinstance(explanation, dict):
                mode = explanation.get("mode")
                if mode == "rf":
                    fi = explanation.get("feature_importance") or {}
                    top = sorted(fi.items(), key=lambda x: float(x[1]), reverse=True)[:3]
                    if top:
                        top_s = ", ".join([f"{k}({round(float(v), 3)})" for k, v in top])
                        return f"AI factors: {top_s}"
                if mode == "baseline":
                    return f"AI baseline: {explanation.get('reason') or 'not_trained'}"
        except Exception:
            pass
        return "AI factors: unavailable"

    def _pick_process_id(self, risk: Risk) -> Optional[int]:
        """
        ComplianceTask requires process_id (NOT NULL).
        We pick the first linked process if available.
        """
        try:
            links = getattr(risk, "process_links", None) or []
            for link in links:
                pid = getattr(link, "process_id", None)
                if pid is not None:
                    return int(pid)
        except Exception:
            return None
        return None

    def _latest_forecasts_query(self, db: Session, tenant_id: int):
        """
        Latest forecast per risk (tenant safe).
        Assumes RiskForecast.created_at exists.
        """
        sub = (
            db.query(
                RiskForecast.risk_id.label("risk_id"),
                func.max(RiskForecast.created_at).label("max_created_at"),
            )
            .filter(RiskForecast.tenant_id == tenant_id)
            .group_by(RiskForecast.risk_id)
            .subquery()
        )

        q = (
            db.query(RiskForecast)
            .join(
                sub,
                (RiskForecast.risk_id == sub.c.risk_id)
                & (RiskForecast.created_at == sub.c.max_created_at),
            )
            .filter(RiskForecast.tenant_id == tenant_id)
        )
        return q

    def generate_actions(self, db: Session, tenant_id: int) -> Dict[str, Any]:
        forecasts = (
            self._latest_forecasts_query(db, tenant_id)
            .order_by(RiskForecast.escalation_probability_30d.desc())
            .all()
        )

        risk_ids = [f.risk_id for f in forecasts]
        risks = (
            db.query(Risk)
            .filter(Risk.tenant_id == tenant_id, Risk.id.in_(risk_ids))
            .all()
        )
        risk_map = {r.id: r for r in risks}

        exec_alerts: List[DecisionAction] = []
        watchlist: List[DecisionAction] = []
        gaps: List[DecisionAction] = []
        tasks: List[DecisionAction] = []

        for f in forecasts:
            r = risk_map.get(f.risk_id)
            if not r:
                continue

            prob = float(f.escalation_probability_30d or 0.0)
            delta = float(f.expected_score_delta or 0.0)

            priority = self._priority(prob, delta, getattr(r, "risk_level", None))
            reason = self._safe_reason(getattr(f, "explanation", None))

            process_id = self._pick_process_id(r)
            control_id = getattr(r, "control_id", None)

            base_payload = {
                "tenant_id": tenant_id,
                "risk_id": r.id,
                "forecast_id": f.id,
                "model_version": getattr(f, "model_version", None),
                "prob_30d": prob,
                "expected_delta": delta,
                "reason": reason,
                "process_id": process_id,
                "control_id": control_id,
            }

            # Watchlist (top risks)
            if prob >= self.rules.high_prob_threshold and len(watchlist) < self.rules.max_watchlist:
                watchlist.append(
                    DecisionAction(
                        action_type="watchlist",
                        priority=priority,
                        title=f"Escalation watch: {r.title}",
                        description=f"{reason} | prob={round(prob,3)} delta={round(delta,2)}",
                        risk_id=r.id,
                        control_id=control_id,
                        process_id=process_id,
                        forecast_id=f.id,
                        model_version=getattr(f, "model_version", None),
                        escalation_probability_30d=prob,
                        expected_score_delta=delta,
                        payload=base_payload,
                    )
                )

            # Executive alerts
            if prob >= self.rules.exec_alert_threshold and len(exec_alerts) < self.rules.max_exec_alerts:
                exec_alerts.append(
                    DecisionAction(
                        action_type="audit_item",
                        priority="CRITICAL" if priority == "CRITICAL" else "HIGH",
                        title=f"Executive escalation alert: {r.title}",
                        description=f"{reason} | prob={round(prob,3)} delta={round(delta,2)}",
                        risk_id=r.id,
                        control_id=control_id,
                        process_id=process_id,
                        forecast_id=f.id,
                        model_version=getattr(f, "model_version", None),
                        escalation_probability_30d=prob,
                        expected_score_delta=delta,
                        payload={**base_payload, "recommended_scope": "EXEC_AUDIT"},
                    )
                )

            # Gap candidates (for future adapter)
            if delta >= self.rules.delta_threshold_gap:
                gaps.append(
                    DecisionAction(
                        action_type="gap_item",
                        priority=priority,
                        title=f"Predictive gap: {r.title}",
                        description=f"{reason} | expected_delta={round(delta,2)}",
                        risk_id=r.id,
                        control_id=control_id,
                        process_id=process_id,
                        forecast_id=f.id,
                        model_version=getattr(f, "model_version", None),
                        escalation_probability_30d=prob,
                        expected_score_delta=delta,
                        payload={**base_payload, "gap_type": "predictive"},
                    )
                )

            # Compliance task candidates
            if prob >= self.rules.high_prob_threshold and delta >= self.rules.delta_threshold_task:
                tasks.append(
                    DecisionAction(
                        action_type="compliance_task",
                        priority=priority,
                        title=f"Mitigation task: {r.title}",
                        description=f"{reason} | prob={round(prob,3)} delta={round(delta,2)}",
                        risk_id=r.id,
                        control_id=control_id,
                        process_id=process_id,
                        forecast_id=f.id,
                        model_version=getattr(f, "model_version", None),
                        escalation_probability_30d=prob,
                        expected_score_delta=delta,
                        payload={**base_payload, "task_type": "predictive_mitigation", "due_days": 14},
                    )
                )

        return {
            "tenant_id": tenant_id,
            "generated_at": self._utcnow().isoformat(),
            "counts": {
                "forecasts": len(forecasts),
                "exec_alerts": len(exec_alerts),
                "watchlist": len(watchlist),
                "gaps": len(gaps),
                "tasks": len(tasks),
            },
            "exec_alerts": [a.__dict__ for a in exec_alerts],
            "watchlist": [a.__dict__ for a in watchlist],
            "gaps": [a.__dict__ for a in gaps],
            "tasks": [a.__dict__ for a in tasks],
        }