# C:\Projects\compliance_app\backend\app\engines\uee_engine.py
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session


# ==============================
# Models (Pure output contracts)
# ==============================

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
            # fallback to defaults if corrupted config arrives
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

    # normalized indices 0..100
    risk_index: float
    coverage_index: float
    maturity_index: float
    evidence_index: float
    task_pressure_index: float

    unified_exposure_score: float
    compliance_health_index: float

    # explainability (lightweight, deterministic)
    weights: Dict[str, float]
    components: Dict[str, float]
    source_stats: Dict[str, Any]
    warnings: Tuple[str, ...] = ()


# ==============================
# Engine
# ==============================

class UEEEngine:
    """
    Unified Evaluation Engine (UEE)
    - Deterministic computation core
    - Tenant-safe: always requires tenant_id, always filters by tenant_id
    - Uses analytics views when present:
        * analytics.v_risk_exposure (confirmed exists in your DB)
        * v_evidence_intelligence (name assumed from your context)
      plus optional maturity/task sources (safe fallbacks if absent).
    """

    def __init__(
        self,
        *,
        default_weights: Optional[UEEWeights] = None,
        # Optional: function to fetch tenant-specific weights from DB/config
        weights_provider: Optional[callable] = None,
        # Optional: snapshot persister hook (kept optional to avoid breaking existing code)
        snapshot_persister: Optional[callable] = None,
    ) -> None:
        self._default_weights = (default_weights or UEEWeights()).normalized()
        self._weights_provider = weights_provider
        self._snapshot_persister = snapshot_persister

    # --------------------------
    # Public API
    # --------------------------

    def compute_summary(self, db: Session, tenant_id: int) -> UEEState:
        """
        Returns a unified deterministic state for the given tenant.
        Transaction-safe:
          - Each metric runs in its own SAVEPOINT (begin_nested)
          - Any DB error triggers rollback to clear the session state
          - Engine never leaves session in aborted transaction state
        """
        computed_at = datetime.now(timezone.utc)

        warnings: list[str] = []

        weights = self._get_weights(db, tenant_id).normalized()

        # Gather raw metrics (each in its own savepoint so a failure doesn't poison the session)
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

        # Deterministic composite
        components = {
            "risk": risk_index,
            "coverage": coverage_index,
            "maturity": maturity_index,
            "evidence": evidence_index,
            "task_pressure": task_pressure_index,
        }

        unified_exposure_score = self._clamp_0_100(
            (risk_index * weights.risk)
            + (coverage_index * weights.coverage)
            + (maturity_index * weights.maturity)
            + (evidence_index * weights.evidence)
            + (task_pressure_index * weights.task_pressure)
        )

        # Health index: inverse exposure (higher is better)
        compliance_health_index = self._clamp_0_100(100.0 - unified_exposure_score)

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
            },
            warnings=tuple(dict.fromkeys(warnings)),  # de-dup while preserving order
        )

        # Optional snapshot persistence (non-breaking)
        if self._snapshot_persister is not None:
            try:
                # keep snapshot isolated as well
                with db.begin_nested():
                    self._snapshot_persister(db=db, state=state)
            except Exception as e:
                # clear session if snapshot write failed
                try:
                    db.rollback()
                except Exception:
                    pass
                # never break KPI/dashboard because snapshots failed
                state = UEEState(
                    **{**state.__dict__, "warnings": tuple(state.warnings + (f"snapshot_persist_failed:{type(e).__name__}",))}
                )

        return state

    # --------------------------
    # Transaction-safe wrapper
    # --------------------------

    def _safe_metric(
        self,
        db: Session,
        tenant_id: int,
        fn: callable,
    ) -> Tuple[float, Dict[str, Any], list[str]]:
        """
        Runs metric fn inside a SAVEPOINT; on any failure, rolls back the session
        to avoid 'InFailedSqlTransaction' poisoning for subsequent queries.
        """
        try:
            with db.begin_nested():
                return fn(db, tenant_id)
        except Exception as e:
            # IMPORTANT: clear aborted transaction state
            try:
                db.rollback()
            except Exception:
                pass

            # fn is expected to return (value, stats, warnings)
            # but on failure here, we must return stable fallback
            name = getattr(fn, "__name__", "metric")
            return 50.0, {}, [f"{name}:failed:{type(e).__name__}"]

    # --------------------------
    # Weights
    # --------------------------

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

    # --------------------------
    # Metric computation (safe)
    # --------------------------

    def _compute_risk_index(self, db: Session, tenant_id: int) -> Tuple[float, Dict[str, Any], list[str]]:
        """
        Uses analytics.v_risk_exposure:
            tenant_id, risk_score (int), exposure_score (numeric), is_covered (bool),
            linked_evidence_count, approved_evidence_count
        Strategy:
            - Prefer avg(exposure_score) if present (0..100 assumed); else normalize avg(risk_score) (0..100).
        """
        warnings: list[str] = []
        stats: Dict[str, Any] = {}

        try:
            row = db.execute(
                text(
                    """
                    SELECT
                      COUNT(*)::bigint AS n,
                      AVG(COALESCE(exposure_score, NULL))::numeric AS avg_exposure_score,
                      AVG(COALESCE(risk_score, NULL))::numeric AS avg_risk_score,
                      SUM(CASE WHEN is_covered THEN 1 ELSE 0 END)::bigint AS covered_n
                    FROM analytics.v_risk_exposure
                    WHERE tenant_id = :tenant_id
                    """
                ),
                {"tenant_id": tenant_id},
            ).mappings().first()

            n = int(row["n"] or 0)
            stats["row_count"] = n
            stats["covered_count"] = int(row["covered_n"] or 0)

            if n <= 0:
                warnings.append("risk:no_rows")
                return 50.0, stats, warnings

            avg_exposure = row["avg_exposure_score"]
            avg_risk = row["avg_risk_score"]

            if avg_exposure is not None:
                # assume already 0..100 scale
                risk_index = self._clamp_0_100(float(avg_exposure))
                stats["avg_exposure_score"] = float(avg_exposure)
            elif avg_risk is not None:
                # risk_score could be 1..25 / 1..10 etc. We normalize conservatively.
                # If your risk_score is already 0..100, this still behaves okay.
                risk_index = self._normalize_unknown_scale(float(avg_risk))
                stats["avg_risk_score"] = float(avg_risk)
                warnings.append("risk:used_avg_risk_score_normalization")
            else:
                risk_index = 50.0
                warnings.append("risk:missing_scores_fallback_50")

            return risk_index, stats, warnings

        except Exception as e:
            # clear aborted transaction state if any
            try:
                db.rollback()
            except Exception:
                pass
            warnings.append(f"risk:query_failed:{type(e).__name__}")
            return 50.0, stats, warnings

    def _compute_evidence_index(self, db: Session, tenant_id: int) -> Tuple[float, Dict[str, Any], list[str]]:
        """
        Evidence intelligence source is project-specific.
        We try a minimal, safe aggregation pattern:

        Expected columns (example):
          tenant_id, evidence_quality_score (0..100) OR approved_ratio
        If view/table absent, fallback to 50.
        """
        warnings: list[str] = []
        stats: Dict[str, Any] = {}

        # Try common view name from your context: analytics.v_evidence_intelligence or v_evidence_intelligence
        candidates = [
            ("analytics.v_evidence_intelligence", "evidence_quality_score"),
            ("v_evidence_intelligence", "evidence_quality_score"),
        ]

        for rel, col in candidates:
            try:
                row = db.execute(
                    text(
                        f"""
                        SELECT
                          COUNT(*)::bigint AS n,
                          AVG(COALESCE({col}, NULL))::numeric AS avg_quality
                        FROM {rel}
                        WHERE tenant_id = :tenant_id
                        """
                    ),
                    {"tenant_id": tenant_id},
                ).mappings().first()

                n = int(row["n"] or 0)
                stats["row_count"] = n
                if n <= 0:
                    warnings.append("evidence:no_rows")
                    return 50.0, stats, warnings

                avg_q = row["avg_quality"]
                if avg_q is None:
                    warnings.append("evidence:missing_quality_fallback_50")
                    return 50.0, stats, warnings

                evidence_index = self._clamp_0_100(float(avg_q))
                stats["avg_quality"] = float(avg_q)
                stats["source"] = rel
                return evidence_index, stats, warnings
            except Exception:
                # clear session if this candidate caused an abort
                try:
                    db.rollback()
                except Exception:
                    pass
                continue

        warnings.append("evidence:source_not_found_fallback_50")
        return 50.0, stats, warnings

    def _compute_maturity_index(self, db: Session, tenant_id: int) -> Tuple[float, Dict[str, Any], list[str]]:
        """
        Maturity is project-specific. Safe default:
          - If there's a maturity view with achieved/target ratio, consume it.
          - Otherwise fallback 50.
        """
        warnings: list[str] = []
        stats: Dict[str, Any] = {}

        candidates = [
            # You can later align to your actual view/table names:
            ("analytics.v_maturity_progress", ("achieved_level", "target_level")),
            ("v_maturity_progress", ("achieved_level", "target_level")),
        ]

        for rel, (ach_col, tgt_col) in candidates:
            try:
                row = db.execute(
                    text(
                        f"""
                        SELECT
                          COUNT(*)::bigint AS n,
                          AVG(COALESCE({ach_col}, NULL))::numeric AS avg_ach,
                          AVG(COALESCE({tgt_col}, NULL))::numeric AS avg_tgt
                        FROM {rel}
                        WHERE tenant_id = :tenant_id
                        """
                    ),
                    {"tenant_id": tenant_id},
                ).mappings().first()

                n = int(row["n"] or 0)
                stats["row_count"] = n
                if n <= 0:
                    warnings.append("maturity:no_rows")
                    return 50.0, stats, warnings

                avg_ach = row["avg_ach"]
                avg_tgt = row["avg_tgt"]
                if avg_ach is None or avg_tgt is None or float(avg_tgt) <= 0:
                    warnings.append("maturity:missing_levels_fallback_50")
                    return 50.0, stats, warnings

                # ratio -> index (higher maturity should reduce exposure; but index here is "pressure" scale 0..100)
                ratio = float(avg_ach) / float(avg_tgt)  # 0..1+
                ratio = max(0.0, min(1.0, ratio))
                # Convert to "maturity pressure": low maturity => high pressure
                maturity_index = self._clamp_0_100(100.0 * (1.0 - ratio))

                stats["avg_achieved"] = float(avg_ach)
                stats["avg_target"] = float(avg_tgt)
                stats["source"] = rel
                return maturity_index, stats, warnings
            except Exception:
                try:
                    db.rollback()
                except Exception:
                    pass
                continue

        warnings.append("maturity:source_not_found_fallback_50")
        return 50.0, stats, warnings

    def _compute_coverage_index(self, db: Session, tenant_id: int) -> Tuple[float, Dict[str, Any], list[str]]:
        """
        Coverage is derivable from analytics.v_risk_exposure in your DB:
          covered_n / n
        Convert to "coverage pressure": low coverage => high pressure.
        """
        warnings: list[str] = []
        stats: Dict[str, Any] = {}

        try:
            row = db.execute(
                text(
                    """
                    SELECT
                      COUNT(*)::bigint AS n,
                      SUM(CASE WHEN is_covered THEN 1 ELSE 0 END)::bigint AS covered_n
                    FROM analytics.v_risk_exposure
                    WHERE tenant_id = :tenant_id
                    """
                ),
                {"tenant_id": tenant_id},
            ).mappings().first()

            n = int(row["n"] or 0)
            covered_n = int(row["covered_n"] or 0)
            stats["row_count"] = n
            stats["covered_count"] = covered_n

            if n <= 0:
                warnings.append("coverage:no_rows")
                return 50.0, stats, warnings

            coverage_ratio = covered_n / float(n)  # 0..1
            coverage_ratio = max(0.0, min(1.0, coverage_ratio))

            # coverage pressure: low coverage -> high index
            coverage_index = self._clamp_0_100(100.0 * (1.0 - coverage_ratio))
            stats["coverage_ratio"] = coverage_ratio
            return coverage_index, stats, warnings

        except Exception as e:
            try:
                db.rollback()
            except Exception:
                pass
            warnings.append(f"coverage:query_failed:{type(e).__name__}")
            return 50.0, stats, warnings

    def _compute_task_pressure_index(self, db: Session, tenant_id: int) -> Tuple[float, Dict[str, Any], list[str]]:
        """
        Task pressure is project-specific. Safe heuristic:
          - If a tasks table/view exists, compute open/overdue ratio
          - else fallback 50
        """
        warnings: list[str] = []
        stats: Dict[str, Any] = {}

        candidates = [
            # adjust to your actual table name later (e.g., compliance_tasks)
            ("compliance_tasks",),
            ("tasks",),
            ("analytics.v_task_pressure",),
        ]

        for (rel,) in candidates:
            try:
                row = db.execute(
                    text(
                        f"""
                        SELECT
                          COUNT(*)::bigint AS n,
                          SUM(CASE WHEN status IN ('open','todo','in_progress') THEN 1 ELSE 0 END)::bigint AS open_n,
                          SUM(CASE WHEN due_date IS NOT NULL AND due_date < NOW() AND status NOT IN ('done','closed') THEN 1 ELSE 0 END)::bigint AS overdue_n
                        FROM {rel}
                        WHERE tenant_id = :tenant_id
                        """
                    ),
                    {"tenant_id": tenant_id},
                ).mappings().first()

                n = int(row["n"] or 0)
                open_n = int(row["open_n"] or 0)
                overdue_n = int(row["overdue_n"] or 0)

                stats["row_count"] = n
                stats["open_count"] = open_n
                stats["overdue_count"] = overdue_n
                stats["source"] = rel

                if n <= 0:
                    warnings.append("task:no_rows")
                    return 50.0, stats, warnings

                # pressure: overdue has heavier effect; clamp to 0..100
                open_ratio = open_n / float(n)
                overdue_ratio = overdue_n / float(n)

                pressure = (0.6 * open_ratio) + (0.4 * min(1.0, overdue_ratio * 2.0))
                task_pressure_index = self._clamp_0_100(100.0 * pressure)

                stats["open_ratio"] = open_ratio
                stats["overdue_ratio"] = overdue_ratio
                return task_pressure_index, stats, warnings

            except Exception:
                try:
                    db.rollback()
                except Exception:
                    pass
                continue

        warnings.append("task:source_not_found_fallback_50")
        return 50.0, stats, warnings

    # --------------------------
    # Utilities
    # --------------------------

    @staticmethod
    def _clamp_0_100(x: float) -> float:
        if x != x:  # NaN
            return 50.0
        return max(0.0, min(100.0, float(x)))

    @staticmethod
    def _normalize_unknown_scale(x: float) -> float:
        """
        Conservative normalization for unknown risk_score scales.
        If score is already 0..100, it remains close.
        If score is 1..5, 1..10, 1..25, it maps into 0..100 without hard dependency.

        Approach:
          - treat x in [0, 25] as common → scale *4
          - if x in (25, 100] assume already %
          - else clamp
        """
        try:
            v = float(x)
        except Exception:
            return 50.0

        if v < 0:
            return 0.0
        if v <= 25.0:
            return max(0.0, min(100.0, v * 4.0))
        if v <= 100.0:
            return max(0.0, min(100.0, v))
        # overly large values -> clamp
        return 100.0