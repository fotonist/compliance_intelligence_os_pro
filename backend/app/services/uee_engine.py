from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.maturity_capability_service import MaturityCapabilityService


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

    def _get_framework_context(
        self,
        db: Session,
        tenant_id: int,
    ) -> Dict[str, Any]:
        rows = db.execute(
            text("""
                SELECT
                    fa.id AS adoption_id,
                    fa.standard_id,
                    fa.standard_version_id,
                    fa.status AS adoption_status,
                    fa.applicability,
                    s.code AS standard_code,
                    s.type AS standard_type
                FROM public.framework_adoptions fa
                JOIN public.standards s
                  ON s.id = fa.standard_id
                WHERE fa.tenant_id = :tenant_id
                  AND UPPER(fa.status) = 'ACTIVE'
                  AND UPPER(COALESCE(fa.applicability, 'APPLICABLE')) = 'APPLICABLE'
                ORDER BY fa.id
            """),
            {"tenant_id": tenant_id},
        ).mappings().all()

        adoptions = [dict(row) for row in rows]

        control_adoptions = [
            item
            for item in adoptions
            if str(item.get("standard_type") or "").upper() == "CONTROL_BASED"
        ]

        maturity_adoptions = [
            item
            for item in adoptions
            if str(item.get("standard_type") or "").upper() == "MATURITY_BASED"
        ]

        return {
            "active_framework_count": len(adoptions),
            "control_based_count": len(control_adoptions),
            "maturity_based_count": len(maturity_adoptions),
            "has_control_based": bool(control_adoptions),
            "has_maturity_based": bool(maturity_adoptions),
            "control_adoptions": control_adoptions,
            "maturity_adoptions": maturity_adoptions,
            "adoptions": adoptions,
        }

    def _get_maturity_framework_state(
        self,
        db: Session,
        tenant_id: int,
        framework_context: Dict[str, Any],
    ) -> Dict[str, Any]:
        frameworks = []

        total_processes = 0
        measured_processes = 0
        calculated_processes = 0
        achieved_processes = 0

        for adoption in framework_context.get("maturity_adoptions", []):
            standard_version_id = adoption.get("standard_version_id")

            if standard_version_id is None:
                continue

            state = MaturityCapabilityService.get_standard_version_state(
                db,
                tenant_id=tenant_id,
                standard_version_id=int(standard_version_id),
            )

            if state is None:
                frameworks.append({
                    "adoption_id": adoption.get("adoption_id"),
                    "standard_id": adoption.get("standard_id"),
                    "standard_code": adoption.get("standard_code"),
                    "standard_version_id": standard_version_id,
                    "assessment_id": None,
                    "assessment_status": None,
                    "total_processes": 0,
                    "measured_processes": 0,
                    "calculated_processes": 0,
                    "unassessed_processes": 0,
                    "achieved_processes": 0,
                    "partial_processes": 0,
                    "not_achieved_processes": 0,
                    "target_achievement_percentage": None,
                    "assessment_coverage_percentage": 0.0,
                })
                continue

            processes = state.get("processes") or []
            adoption_scope = state.get("adoption_scope") or {}

            total = int(
                adoption_scope.get("total_processes") or 0
            )
            measured = int(
                adoption_scope.get("measured_processes") or 0
            )
            calculated = int(
                adoption_scope.get("calculated_processes") or 0
            )

            achieved = 0
            partial = 0
            not_achieved = 0

            for process in processes:
                if process.get("capability_status") != "CALCULATED":
                    continue

                target = process.get("target_capability_level")
                achieved_level = process.get("achieved_capability_level")

                if target is None or achieved_level is None:
                    continue

                target_value = int(target)
                achieved_value = int(achieved_level)

                if achieved_value >= target_value:
                    achieved += 1
                elif achieved_value > 0:
                    partial += 1
                else:
                    not_achieved += 1

            target_achievement = (
                round((achieved / total) * 100.0, 1)
                if total > 0
                else None
            )

            assessment_coverage = (
                round((measured / total) * 100.0, 1)
                if total > 0
                else 0.0
            )

            unassessed = max(total - measured, 0)

            total_processes += total
            measured_processes += measured
            calculated_processes += calculated
            achieved_processes += achieved

            frameworks.append({
                "adoption_id": adoption.get("adoption_id"),
                "standard_id": adoption.get("standard_id"),
                "standard_code": adoption.get("standard_code"),
                "standard_version_id": standard_version_id,
                "assessment_id": state.get("assessment_id"),
                "assessment_status": state.get("assessment_status"),
                "total_processes": total,
                "measured_processes": measured,
                "calculated_processes": calculated,
                "unassessed_processes": unassessed,
                "achieved_processes": achieved,
                "partial_processes": partial,
                "not_achieved_processes": not_achieved,
                "target_achievement_percentage": target_achievement,
                "assessment_coverage_percentage": assessment_coverage,
            })

        aggregate_target_achievement = (
            round(
                (achieved_processes / total_processes) * 100.0,
                1,
            )
            if total_processes > 0
            else None
        )

        aggregate_assessment_coverage = (
            round(
                (measured_processes / total_processes) * 100.0,
                1,
            )
            if total_processes > 0
            else 0.0
        )

        return {
            "framework_count": len(frameworks),
            "total_processes": total_processes,
            "measured_processes": measured_processes,
            "calculated_processes": calculated_processes,
            "unassessed_processes": max(
                total_processes - measured_processes,
                0,
            ),
            "achieved_processes": achieved_processes,
            "target_achievement_percentage": aggregate_target_achievement,
            "assessment_coverage_percentage": aggregate_assessment_coverage,
            "frameworks": frameworks,
        }

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

        # -------------------------------------------------------------
        # EFFECTIVE WEIGHTS
        # -------------------------------------------------------------
        # Maturity exposure is not yet defined by the UEE model.
        # Canonical maturity assessment state is exposed separately and
        # must not be converted into an invented exposure score.
        maturity_exposure_available = not any(
            warning == "maturity:exposure_not_available"
            for warning in warnings
        )

        effective_weight_values = {
            "risk": float(weights.risk),
            "coverage": float(weights.coverage),
            "maturity": (
                float(weights.maturity)
                if maturity_exposure_available
                else 0.0
            ),
            "evidence": float(weights.evidence),
            "task_pressure": float(weights.task_pressure),
        }

        effective_weight_total = sum(effective_weight_values.values())

        if effective_weight_total <= 0:
            effective_weight_values = {
                "risk": 1.0,
                "coverage": 0.0,
                "maturity": 0.0,
                "evidence": 0.0,
                "task_pressure": 0.0,
            }
        else:
            effective_weight_values = {
                key: value / effective_weight_total
                for key, value in effective_weight_values.items()
            }

        unified_exposure_score = self._clamp_0_100(
            risk_index * effective_weight_values["risk"]
            + coverage_index * effective_weight_values["coverage"]
            + maturity_index * effective_weight_values["maturity"]
            + evidence_index * effective_weight_values["evidence"]
            + task_pressure_index * effective_weight_values["task_pressure"]
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
            weights=effective_weight_values,
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

    def _compute_risk_index(
        self,
        db: Session,
        tenant_id: int,
    ) -> Tuple[float, Dict[str, Any], list[str]]:
        """
        Tenant-scoped risk exposure index.

        Source of truth:
            analytics.v_risk_exposure_uee

        The view exposes the current risk score directly, therefore
        no dependency is placed on the non-existent legacy
        analytics.v_risk_exposure view.
        """
        stats: Dict[str, Any] = {}
        warnings: list[str] = []

        try:
            row = db.execute(
                text("""
                    SELECT
                        COUNT(*)::bigint AS n,
                        COALESCE(AVG(score), 0)::numeric AS avg_score
                    FROM analytics.v_risk_exposure_uee
                    WHERE tenant_id = :tenant_id
                """),
                {"tenant_id": tenant_id},
            ).mappings().first()

            n = int(row["n"] or 0)
            avg_score = float(row["avg_score"] or 0.0)

            stats["row_count"] = n
            stats["avg_risk_score"] = avg_score
            stats["source"] = "analytics.v_risk_exposure_uee"

            if n <= 0:
                warnings.append("risk:no_rows")
                return 0.0, stats, warnings

            # Risk scores in the current model use a 1-25 scale.
            # Normalize to the common 0-100 exposure scale.
            value = self._clamp_0_100(
                (avg_score / 25.0) * 100.0
            )

            stats["normalized_risk_exposure"] = value

            return value, stats, warnings

        except Exception as e:
            try:
                db.rollback()
            except Exception:
                pass

            warnings.append(
                f"risk:query_failed:{type(e).__name__}"
            )
            return 0.0, stats, warnings

    def _compute_evidence_index(
        self,
        db: Session,
        tenant_id: int,
    ) -> Tuple[float, Dict[str, Any], list[str]]:
        """
        Tenant-scoped evidence exposure.

        Evidence quality:
            approved_files / total_files

        Evidence exposure:
            (1 - evidence_quality) * 100

        No analytics view is used here because
        analytics.v_evidence_intelligence does not expose tenant_id.
        """

        stats: Dict[str, Any] = {}
        warnings: list[str] = []

        try:
            row = db.execute(
                text("""
                    SELECT
                        COUNT(ef.id)::bigint AS total_files,
                        COUNT(ef.id) FILTER (
                            WHERE LOWER(COALESCE(ef.status::text, ''))
                                = 'approved'
                        )::bigint AS approved_files
                    FROM public.evidence_files ef
                    WHERE ef.tenant_id = :tenant_id
                """),
                {"tenant_id": tenant_id},
            ).mappings().first()

            total_files = int(row["total_files"] or 0)
            approved_files = int(row["approved_files"] or 0)

            stats.update({
                "total_files": total_files,
                "approved_files": approved_files,
                "source": "public.evidence_files",
            })

            if total_files <= 0:
                warnings.append("evidence:no_files")
                return 100.0, stats, warnings

            quality = (
                float(approved_files)
                / float(total_files)
            ) * 100.0

            quality = self._clamp_0_100(quality)
            exposure = 100.0 - quality

            stats["evidence_quality"] = quality
            stats["evidence_exposure"] = exposure

            return exposure, stats, warnings

        except Exception as e:
            try:
                db.rollback()
            except Exception:
                pass

            warnings.append(
                f"evidence:query_failed:{type(e).__name__}"
            )
            return 100.0, stats, warnings

    def _compute_maturity_index(self, db: Session, tenant_id: int) -> Tuple[float, Dict[str, Any], list[str]]:
        # Canonical maturity assessment state exists independently from UEE
        # exposure. No approved maturity-to-exposure transformation is defined
        # yet, so maturity must remain excluded from the composite rather than
        # manufacturing an exposure value.
        return (
            0.0,
            {
                "row_count": 0,
                "source": "maturity_exposure_not_defined",
            },
            ["maturity:exposure_not_available"],
        )

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
            stats["coverage_health"] = (covered / float(total)) * 100.0
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
