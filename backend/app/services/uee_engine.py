from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class UEEWeights:
    risk: float = 0.35
    coverage: float = 0.25
    maturity: float = 0.15
    evidence: float = 0.10
    task_pressure: float = 0.15

    def normalized(self) -> "UEEWeights":
        total = self.risk + self.coverage + self.maturity + self.evidence + self.task_pressure
        if total <= 0:
            return UEEWeights()
        return UEEWeights(
            risk=self.risk / total,
            coverage=self.coverage / total,
            maturity=self.maturity / total,
            evidence=self.evidence / total,
            task_pressure=self.task_pressure / total,
        )


@dataclass(frozen=True)
class UEEState:
    tenant_id: int
    computed_at: datetime
    risk_index: float
    coverage_index: float
    maturity_index: float
    evidence_index: float
    task_pressure_index: float
    unified_exposure_score: float
    compliance_health_index: float
    weights: Dict[str, float]
    components: Dict[str, float]
    source_stats: Dict[str, Any]
    warnings: Tuple[str, ...] = ()


class UEEEngine:
    """Deterministic tenant-scoped compliance exposure and health engine.

    All component indices are exposure/pressure values: higher is worse.
    Missing data is never treated as a neutral 50.
    """

    def __init__(
        self,
        *,
        default_weights: Optional[UEEWeights] = None,
        weights_provider: Optional[callable] = None,
        snapshot_persister: Optional[callable] = None,
    ) -> None:
        self._default_weights = (default_weights or UEEWeights()).normalized()
        self._weights_provider = weights_provider
        self._snapshot_persister = snapshot_persister

    def compute_summary(self, db: Session, tenant_id: int) -> UEEState:
        computed_at = datetime.now(timezone.utc)
        warnings: list[str] = []
        weights = self._get_weights(db, tenant_id).normalized()

        risk_index, risk_stats, w1 = self._compute_risk_index(db, tenant_id)
        evidence_index, evidence_stats, w2 = self._compute_evidence_index(db, tenant_id)
        maturity_index, maturity_stats, w3, maturity_available = self._compute_maturity_index(db, tenant_id)
        coverage_index, coverage_stats, w4 = self._compute_coverage_index(db, tenant_id)
        task_index, task_stats, w5, task_available = self._compute_task_pressure_index(db, tenant_id)
        warnings.extend(w1 + w2 + w3 + w4 + w5)

        # Compliance Health has a hard control-coverage gate. If controls are not
        # implemented, the organization cannot report a positive compliance health.
        control_health = self._clamp_0_100(100.0 - coverage_index)

        # Exposure components. Maturity/task are excluded from the composite when
        # their source does not exist; their weights are redistributed deterministically.
        active_weights: Dict[str, float] = {
            "risk": weights.risk,
            "coverage": weights.coverage,
            "evidence": weights.evidence,
        }
        if maturity_available:
            active_weights["maturity"] = weights.maturity
        if task_available:
            active_weights["task_pressure"] = weights.task_pressure

        active_total = sum(active_weights.values()) or 1.0
        active_weights = {k: v / active_total for k, v in active_weights.items()}

        components = {
            "risk": risk_index,
            "coverage": coverage_index,
            "maturity": maturity_index,
            "evidence": evidence_index,
            "task_pressure": task_index,
        }

        unified_exposure_score = self._clamp_0_100(
            sum(components[name] * weight for name, weight in active_weights.items())
        )

        # The composite exposure describes the enterprise pressure, while the
        # control-health gate prevents missing/unimplemented controls from being
        # masked by zero risk or zero task counts.
        composite_health = self._clamp_0_100(100.0 - unified_exposure_score)
        compliance_health_index = self._clamp_0_100(
            composite_health * (control_health / 100.0)
        )

        state = UEEState(
            tenant_id=tenant_id,
            computed_at=computed_at,
            risk_index=risk_index,
            coverage_index=coverage_index,
            maturity_index=maturity_index,
            evidence_index=evidence_index,
            task_pressure_index=task_index,
            unified_exposure_score=unified_exposure_score,
            compliance_health_index=compliance_health_index,
            weights=active_weights,
            components=components,
            source_stats={
                "risk": risk_stats,
                "coverage": coverage_stats,
                "evidence": evidence_stats,
                "maturity": maturity_stats,
                "task_pressure": task_stats,
                "control_health": control_health,
            },
            warnings=tuple(dict.fromkeys(warnings)),
        )

        if self._snapshot_persister is not None:
            try:
                with db.begin_nested():
                    self._snapshot_persister(db=db, state=state)
            except Exception as exc:
                warnings = tuple(state.warnings + (f"snapshot_persist_failed:{type(exc).__name__}",))
                state = UEEState(**{**state.__dict__, "warnings": warnings})

        return state

    def _get_weights(self, db: Session, tenant_id: int) -> UEEWeights:
        if self._weights_provider is None:
            return self._default_weights
        try:
            value = self._weights_provider(db=db, tenant_id=tenant_id)
            if isinstance(value, UEEWeights):
                return value
            if isinstance(value, dict):
                return UEEWeights(
                    risk=float(value.get("risk", self._default_weights.risk)),
                    coverage=float(value.get("coverage", self._default_weights.coverage)),
                    maturity=float(value.get("maturity", self._default_weights.maturity)),
                    evidence=float(value.get("evidence", self._default_weights.evidence)),
                    task_pressure=float(value.get("task_pressure", self._default_weights.task_pressure)),
                )
        except Exception:
            pass
        return self._default_weights

    def _compute_risk_index(self, db: Session, tenant_id: int) -> Tuple[float, Dict[str, Any], list[str]]:
        warnings: list[str] = []
        stats: Dict[str, Any] = {}
        try:
            row = db.execute(
                text(
                    """
                    SELECT COUNT(*)::bigint AS n,
                           AVG(score)::numeric AS avg_score,
                           SUM(CASE WHEN LOWER(COALESCE(status, '')) = 'open' THEN 1 ELSE 0 END)::bigint AS open_n
                    FROM risks
                    WHERE tenant_id = :tenant_id
                    """
                ),
                {"tenant_id": tenant_id},
            ).mappings().first()
            n = int(row["n"] or 0)
            open_n = int(row["open_n"] or 0)
            stats.update({"row_count": n, "open_count": open_n})
            if n == 0:
                warnings.append("risk:no_rows")
                return 0.0, stats, warnings
            avg_score = row["avg_score"]
            if avg_score is None:
                warnings.append("risk:missing_scores")
                return 0.0, stats, warnings
            # Current project risk scoring uses a 1..25 score for normalization.
            risk_pressure = self._clamp_0_100(float(avg_score) * 4.0)
            stats["avg_score"] = float(avg_score)
            return risk_pressure, stats, warnings
        except Exception as exc:
            warnings.append(f"risk:query_failed:{type(exc).__name__}")
            return 0.0, stats, warnings

    def _compute_coverage_index(self, db: Session, tenant_id: int) -> Tuple[float, Dict[str, Any], list[str]]:
        warnings: list[str] = []
        stats: Dict[str, Any] = {}
        try:
            row = db.execute(
                text(
                    """
                    SELECT COUNT(*)::bigint AS total_controls,
                           SUM(CASE WHEN coverage_status = 'covered' THEN 1 ELSE 0 END)::bigint AS covered_controls,
                           SUM(CASE WHEN coverage_status = 'partial' THEN 1 ELSE 0 END)::bigint AS partial_controls,
                           SUM(CASE WHEN coverage_status = 'uncovered' OR coverage_status IS NULL THEN 1 ELSE 0 END)::bigint AS uncovered_controls
                    FROM analytics.v_control_coverage_uee
                    WHERE tenant_id = :tenant_id
                    """
                ),
                {"tenant_id": tenant_id},
            ).mappings().first()
            total = int(row["total_controls"] or 0)
            covered = int(row["covered_controls"] or 0)
            partial = int(row["partial_controls"] or 0)
            uncovered = int(row["uncovered_controls"] or 0)
            stats.update({
                "total_controls": total,
                "covered_controls": covered,
                "partial_controls": partial,
                "uncovered_controls": uncovered,
            })
            if total == 0:
                warnings.append("coverage:no_controls")
                return 100.0, stats, warnings
            coverage_score = ((covered * 100.0) + (partial * 50.0)) / total
            stats["coverage_score"] = coverage_score
            return self._clamp_0_100(100.0 - coverage_score), stats, warnings
        except Exception as exc:
            warnings.append(f"coverage:query_failed:{type(exc).__name__}")
            return 100.0, stats, warnings

    def _compute_evidence_index(self, db: Session, tenant_id: int) -> Tuple[float, Dict[str, Any], list[str]]:
        warnings: list[str] = []
        stats: Dict[str, Any] = {}
        try:
            row = db.execute(
                text(
                    """
                    SELECT COUNT(*)::bigint AS total_files,
                           SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END)::bigint AS approved_files,
                           SUM(CASE WHEN status = 'waiting_approval' THEN 1 ELSE 0 END)::bigint AS pending_files,
                           SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END)::bigint AS rejected_files
                    FROM evidence_files
                    WHERE tenant_id = :tenant_id
                    """
                ),
                {"tenant_id": tenant_id},
            ).mappings().first()
            total = int(row["total_files"] or 0)
            approved = int(row["approved_files"] or 0)
            pending = int(row["pending_files"] or 0)
            rejected = int(row["rejected_files"] or 0)
            stats.update({"total_files": total, "approved_files": approved, "pending_files": pending, "rejected_files": rejected})
            if total == 0:
                warnings.append("evidence:no_files")
                return 100.0, stats, warnings
            strength = approved / float(total) * 100.0
            stats["strength_score"] = strength
            return self._clamp_0_100(100.0 - strength), stats, warnings
        except Exception as exc:
            warnings.append(f"evidence:query_failed:{type(exc).__name__}")
            return 100.0, stats, warnings

    def _compute_maturity_index(self, db: Session, tenant_id: int) -> Tuple[float, Dict[str, Any], list[str], bool]:
        warnings: list[str] = []
        stats: Dict[str, Any] = {}
        try:
            row = db.execute(
                text(
                    """
                    SELECT COUNT(*)::bigint AS n,
                           AVG(achieved_level)::numeric AS avg_achieved,
                           AVG(target_level)::numeric AS avg_target
                    FROM analytics.v_maturity_progress
                    WHERE tenant_id = :tenant_id
                    """
                ),
                {"tenant_id": tenant_id},
            ).mappings().first()
            n = int(row["n"] or 0)
            if n == 0 or row["avg_target"] is None or float(row["avg_target"]) <= 0:
                warnings.append("maturity:no_source")
                return 0.0, stats, warnings, False
            ratio = max(0.0, min(1.0, float(row["avg_achieved"] or 0) / float(row["avg_target"])))
            pressure = (1.0 - ratio) * 100.0
            stats.update({"row_count": n, "avg_achieved": float(row["avg_achieved"] or 0), "avg_target": float(row["avg_target"])})
            return pressure, stats, warnings, True
        except Exception:
            warnings.append("maturity:no_source")
            return 0.0, stats, warnings, False

    def _compute_task_pressure_index(self, db: Session, tenant_id: int) -> Tuple[float, Dict[str, Any], list[str], bool]:
        warnings: list[str] = []
        stats: Dict[str, Any] = {}
        try:
            row = db.execute(
                text(
                    """
                    SELECT COUNT(*)::bigint AS n,
                           SUM(CASE WHEN status IN ('open','todo','in_progress') THEN 1 ELSE 0 END)::bigint AS open_n,
                           SUM(CASE WHEN due_date IS NOT NULL AND due_date < NOW() AND status NOT IN ('done','closed') THEN 1 ELSE 0 END)::bigint AS overdue_n
                    FROM compliance_tasks
                    WHERE tenant_id = :tenant_id
                    """
                ),
                {"tenant_id": tenant_id},
            ).mappings().first()
            n = int(row["n"] or 0)
            if n == 0:
                warnings.append("task:no_rows")
                return 0.0, {"row_count": 0}, warnings, True
            open_n = int(row["open_n"] or 0)
            overdue_n = int(row["overdue_n"] or 0)
            pressure = (0.6 * open_n / n + 0.4 * min(1.0, (overdue_n / n) * 2.0)) * 100.0
            stats.update({"row_count": n, "open_count": open_n, "overdue_count": overdue_n})
            return self._clamp_0_100(pressure), stats, warnings, True
        except Exception:
            warnings.append("task:no_source")
            return 0.0, stats, warnings, False

    @staticmethod
    def _clamp_0_100(value: float) -> float:
        try:
            value = float(value)
        except (TypeError, ValueError):
            return 0.0
        if value != value:
            return 0.0
        return max(0.0, min(100.0, value))
