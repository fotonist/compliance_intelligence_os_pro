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
        total = float(self.risk + self.coverage + self.maturity + self.evidence + self.task_pressure)
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
    """Tenant-safe Unified Exposure Engine.

    All indices are exposure/pressure values: 0 is best, 100 is worst.
    No-data conditions are represented as zero exposure where the absence of
    records means no current exposure, and coverage is derived from the
    canonical tenant-scoped control coverage view.
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

        risk_index, risk_stats, w1 = self._safe_metric(db, tenant_id, self._compute_risk_index)
        warnings.extend(w1)
        evidence_index, evidence_stats, w2 = self._safe_metric(db, tenant_id, self._compute_evidence_index)
        warnings.extend(w2)
        maturity_index, maturity_stats, w3 = self._safe_metric(db, tenant_id, self._compute_maturity_index)
        warnings.extend(w3)
        coverage_index, coverage_stats, w4 = self._safe_metric(db, tenant_id, self._compute_coverage_index)
        warnings.extend(w4)
        task_pressure_index, task_stats, w5 = self._safe_metric(db, tenant_id, self._compute_task_pressure_index)
        warnings.extend(w5)

        components = {
            "risk": risk_index,
            "coverage": coverage_index,
            "maturity": maturity_index,
            "evidence": evidence_index,
            "task_pressure": task_pressure_index,
        }

        unified_exposure_score = self._clamp_0_100(
            risk_index * weights.risk
            + coverage_index * weights.coverage
            + maturity_index * weights.maturity
            + evidence_index * weights.evidence
            + task_pressure_index * weights.task_pressure
        )

        # Control Health is a hard gate. If controls exist but none are covered,
        # compliance health cannot be positive even when other exposure components
        # are low. This keeps the API contract aligned with analytics views.
        total_controls = int(coverage_stats.get("total_controls", 0) or 0)
        covered_controls = int(coverage_stats.get("covered_controls", 0) or 0)
        control_health = (
            0.0
            if total_controls <= 0
            else (covered_controls / float(total_controls)) * 100.0
        )
        raw_health = self._clamp_0_100(100.0 - unified_exposure_score)
        compliance_health_index = self._clamp_0_100(min(raw_health, control_health))

        state = UEEState(
            tenant_id=tenant_id,
            computed_at=computed_at,
            risk_index=risk_index,
            coverage_index=coverage_index,
            maturity_index=maturity_index,
            evidence_index=evidence_index,
            task_pressure_index=task_pressure_index,
            unified_exposure_score=unified_exposure_score,
            compliance_health_index=compliance_health_index,
            weights={
                "risk": weights.risk,
                "coverage": weights.coverage,
                "maturity": weights.maturity,
                "evidence": weights.evidence,
                "task_pressure": weights.task_pressure,
            },
            components=components,
            source_stats={
                "risk": risk_stats,
                "evidence": evidence_stats,
                "maturity": maturity_stats,
                "coverage": coverage_stats,
                "task_pressure": task_stats,
                "control_health": control_health,
                "raw_health": raw_health,
            },
            warnings=tuple(dict.fromkeys(warnings)),
        )

        if self._snapshot_persister is not None:
            try:
                with db.begin_nested():
                    self._snapshot_persister(db=db, state=state)
            except Exception as e:
                try:
                    db.rollback()
                except Exception:
                    pass
                state = UEEState(
                    **{**state.__dict__, "warnings": tuple(state.warnings + (f"snapshot_persist_failed:{type(e).__name__}",))}
                )

        return state

    def _safe_metric(self, db: Session, tenant_id: int, fn: callable) -> Tuple[float, Dict[str, Any], list[str]]:
        try:
            with db.begin_nested():
                return fn(db, tenant_id)
        except Exception as e:
            try:
                db.rollback()
            except Exception:
                pass
            name = getattr(fn, "__name__", "metric")
            return 0.0, {}, [f"{name}:failed:{type(e).__name__}"]

    def _get_weights(self, db: Session, tenant_id: int) -> UEEWeights:
        if self._weights_provider is None:
            return self._default_weights
        try:
            w = self._weights_provider(db=db, tenant_id=tenant_id)
            if isinstance(w, UEEWeights):
                return w
            if isinstance(w, dict):
                return UEEWeights(
                    risk=float(w.get("risk", self._default_weights.risk)),
                    coverage=float(w.get("coverage", self._default_weights.coverage)),
                    maturity=float(w.get("maturity", self._default_weights.maturity)),
                    evidence=float(w.get("evidence", self._default_weights.evidence)),
                    task_pressure=float(w.get("task_pressure", self._default_weights.task_pressure)),
                )
        except Exception:
            pass
        return self._default_weights

    def _compute_risk_index(self, db: Session, tenant_id: int) -> Tuple[float, Dict[str, Any], list[str]]:
        stats: Dict[str, Any] = {}
        warnings: list[str] = []
        try:
            row = db.execute(text("""
                SELECT
                    COUNT(*)::bigint AS n,
                    AVG(exposure_score)::numeric AS avg_exposure_score,
                    AVG(risk_score)::numeric AS avg_risk_score,
                    SUM(CASE WHEN is_covered THEN 1 ELSE 0 END)::bigint AS covered_n
                FROM analytics.v_risk_exposure
                WHERE tenant_id = :tenant_id
            """), {"tenant_id": tenant_id}).mappings().first()
            n = int(row["n"] or 0)
            stats["row_count"] = n
            stats["covered_count"] = int(row["covered_n"] or 0)
            if n <= 0:
                warnings.append("risk:no_rows")
                return 0.0, stats, warnings
            if row["avg_exposure_score"] is not None:
                value = self._clamp_0_100(float(row["avg_exposure_score"]))
                stats["avg_exposure_score"] = value
                return value, stats, warnings
            if row["avg_risk_score"] is not None:
                value = self._normalize_unknown_scale(float(row["avg_risk_score"]))
                stats["avg_risk_score"] = float(row["avg_risk_score"])
                warnings.append("risk:used_avg_risk_score_normalization")
                return value, stats, warnings
            warnings.append("risk:missing_scores")
            return 0.0, stats, warnings
        except Exception as e:
            try:
                db.rollback()
            except Exception:
                pass
            warnings.append(f"risk:query_failed:{type(e).__name__}")
            return 0.0, stats, warnings

    def _compute_evidence_index(self, db: Session, tenant_id: int) -> Tuple[float, Dict[str, Any], list[str]]:
        stats: Dict[str, Any] = {}
        warnings: list[str] = []
        try:
            row = db.execute(text("""
                SELECT COUNT(*)::bigint AS n,
                       COALESCE(AVG(evidence_quality_score), 0)::numeric AS avg_quality
                FROM analytics.v_evidence_intelligence
                WHERE tenant_id = :tenant_id
            """), {"tenant_id": tenant_id}).mappings().first()
            n = int(row["n"] or 0)
            stats["row_count"] = n
            if n <= 0:
                warnings.append("evidence:no_rows")
                return 100.0, stats, warnings
            value = self._clamp_0_100(float(row["avg_quality"] or 0))
            stats["avg_quality"] = value
            stats["source"] = "analytics.v_evidence_intelligence"
            # quality is positive; convert to exposure/pressure
            return 100.0 - value, stats, warnings
        except Exception as e:
            try:
                db.rollback()
            except Exception:
                pass
            warnings.append(f"evidence:query_failed:{type(e).__name__}")
            return 100.0, stats, warnings

    def _compute_maturity_index(self, db: Session, tenant_id: int) -> Tuple[float, Dict[str, Any], list[str]]:
        # No active maturity assessment session means there is no measured maturity
        # exposure to inject into the composite. Do not manufacture a 50 score.
        return 0.0, {"row_count": 0, "source": "no_active_maturity_assessment"}, ["maturity:no_active_assessment"]

    def _compute_coverage_index(self, db: Session, tenant_id: int) -> Tuple[float, Dict[str, Any], list[str]]:
        stats: Dict[str, Any] = {}
        warnings: list[str] = []
        try:
            row = db.execute(text("""
                SELECT
                    COUNT(*)::bigint AS total_controls,
                    COUNT(*) FILTER (WHERE coverage_status = 'covered')::bigint AS covered_controls,
                    COUNT(*) FILTER (WHERE coverage_status = 'partial')::bigint AS partial_controls,
                    COUNT(*) FILTER (WHERE coverage_status = 'uncovered')::bigint AS uncovered_controls
                FROM analytics.v_control_coverage_uee
                WHERE tenant_id = :tenant_id
            """), {"tenant_id": tenant_id}).mappings().first()
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
            if total <= 0:
                warnings.append("coverage:no_controls")
                return 0.0, stats, warnings
            # Exposure: covered=0, partial=50, uncovered=100.
            exposure = ((partial * 50.0) + (uncovered * 100.0)) / total
            stats["coverage_health"] = (covered / total) * 100.0
            return self._clamp_0_100(exposure), stats, warnings
        except Exception as e:
            try:
                db.rollback()
            except Exception:
                pass
            warnings.append(f"coverage:query_failed:{type(e).__name__}")
            return 0.0, stats, warnings

    def _compute_task_pressure_index(self, db: Session, tenant_id: int) -> Tuple[float, Dict[str, Any], list[str]]:
        stats: Dict[str, Any] = {}
        warnings: list[str] = []
        try:
            row = db.execute(text("""
                SELECT
                    COUNT(*)::bigint AS n,
                    SUM(CASE WHEN UPPER(status::text) NOT IN ('DONE','COMPLETED','CLOSED') THEN 1 ELSE 0 END)::bigint AS open_n,
                    SUM(CASE WHEN due_date IS NOT NULL
                                  AND due_date < NOW()
                                  AND UPPER(status::text) NOT IN ('DONE','COMPLETED','CLOSED')
                             THEN 1 ELSE 0 END)::bigint AS overdue_n
                FROM public.compliance_tasks
                WHERE tenant_id = :tenant_id
            """), {"tenant_id": tenant_id}).mappings().first()
            n = int(row["n"] or 0)
            open_n = int(row["open_n"] or 0)
            overdue_n = int(row["overdue_n"] or 0)
            stats.update({"row_count": n, "open_count": open_n, "overdue_count": overdue_n})
            if n <= 0:
                warnings.append("task:no_rows")
                return 0.0, stats, warnings
            open_ratio = open_n / float(n)
            overdue_ratio = overdue_n / float(n)
            pressure = (0.6 * open_ratio) + (0.4 * min(1.0, overdue_ratio * 2.0))
            stats["open_ratio"] = open_ratio
            stats["overdue_ratio"] = overdue_ratio
            return self._clamp_0_100(pressure * 100.0), stats, warnings
        except Exception as e:
            try:
                db.rollback()
            except Exception:
                pass
            warnings.append(f"task:query_failed:{type(e).__name__}")
            return 0.0, stats, warnings

    @staticmethod
    def _clamp_0_100(x: float) -> float:
        try:
            v = float(x)
        except Exception:
            return 0.0
        if v != v:
            return 0.0
        return max(0.0, min(100.0, v))

    @staticmethod
    def _normalize_unknown_scale(x: float) -> float:
        try:
            v = float(x)
        except Exception:
            return 0.0
        if v < 0:
            return 0.0
        if v <= 25.0:
            return max(0.0, min(100.0, v * 4.0))
        return max(0.0, min(100.0, v))
