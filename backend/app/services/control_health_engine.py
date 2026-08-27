from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class ControlHealthWeights:
    coverage: float = 0.30
    evidence: float = 0.20
    risk: float = 0.20
    gap: float = 0.20
    remediation: float = 0.10

    def normalized(self) -> "ControlHealthWeights":
        values = {
            "coverage": float(self.coverage),
            "evidence": float(self.evidence),
            "risk": float(self.risk),
            "gap": float(self.gap),
            "remediation": float(self.remediation),
        }

        if any(value < 0.0 or value > 1.0 for value in values.values()):
            raise ValueError("Control Health weights must be between 0 and 1.")

        total = sum(values.values())

        if total <= 0.0:
            raise ValueError("Control Health weight total must be greater than zero.")

        return ControlHealthWeights(
            coverage=values["coverage"] / total,
            evidence=values["evidence"] / total,
            risk=values["risk"] / total,
            gap=values["gap"] / total,
            remediation=values["remediation"] / total,
        )


@dataclass(frozen=True)
class ControlHealthResult:
    control_id: int
    control_code: Optional[str]
    control_title: Optional[str]

    health_index: float

    coverage_health: float
    evidence_quality: float
    risk_health: Optional[float]
    gap_health: Optional[float]
    remediation_health: Optional[float]

    evidence_count: int
    approved_evidence_count: int
    risk_count: int
    gap_count: int
    open_task_count: int

    worst_risk_score: float
    worst_gap_severity: float


class ControlHealthEngine:
    """
    Canonical Control Health calculation engine.

    Every component is normalized to 0..100.
    Higher values always mean better control health.

    Formula:

        health =
            coverage_health    * coverage_weight
          + evidence_quality   * evidence_weight
          + risk_health        * risk_weight
          + gap_health         * gap_weight
          + remediation_health * remediation_weight

    The engine deliberately separates data acquisition from weighting so
    configuration can later be supplied by the Intelligence Configuration
    Center without changing the calculation logic.
    """

    def __init__(
        self,
        weights: Optional[ControlHealthWeights] = None,
    ):
        self.weights = (
            weights or ControlHealthWeights()
        ).normalized()

    @staticmethod
    def _clamp(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
        return max(minimum, min(maximum, float(value)))

    @staticmethod
    def _safe_float(value: Any, default: float = 0.0) -> float:
        try:
            if value is None:
                return default
            return float(value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _safe_int(value: Any, default: int = 0) -> int:
        try:
            if value is None:
                return default
            return int(value)
        except (TypeError, ValueError):
            return default

    def calculate(
        self,
        db: Session,
        tenant_id: int,
        control_id: int,
    ) -> ControlHealthResult:
        row = db.execute(
            text(
                """
                SELECT
                    c.id AS control_id,
                    c.code AS control_code,
                    c.title AS control_title,

                    COALESCE(ev.evidence_count, 0) AS evidence_count,
                    COALESCE(ev.approved_evidence_count, 0)
                        AS approved_evidence_count,

                    COALESCE(rk.risk_count, 0) AS risk_count,
                    COALESCE(rk.worst_risk_score, 0)
                        AS worst_risk_score,

                    COALESCE(gp.gap_count, 0) AS gap_count,
                    COALESCE(gp.worst_gap_severity, 0)
                        AS worst_gap_severity,

                    COALESCE(ts.open_task_count, 0)
                        AS open_task_count,

                    COALESCE(cc.coverage_status, 'uncovered')
                        AS coverage_status

                FROM controls c

                LEFT JOIN analytics.v_control_coverage cc
                    ON cc.control_id = c.id
                   AND cc.tenant_id = :tenant_id

                LEFT JOIN (
                    SELECT
                        e.control_id,
                        e.tenant_id,
                        COUNT(DISTINCT e.id) AS evidence_count,
                        COUNT(DISTINCT ef.id) FILTER (
                            WHERE LOWER(COALESCE(ef.status, '')) = 'approved'
                        ) AS approved_evidence_count
                    FROM evidences e
                    LEFT JOIN evidence_files ef
                        ON ef.evidence_id = e.id
                    WHERE e.tenant_id = :tenant_id
                      AND e.is_deleted = false
                    GROUP BY e.control_id, e.tenant_id
                ) ev
                    ON ev.control_id = c.id
                   AND ev.tenant_id = :tenant_id

                LEFT JOIN (
                    SELECT
                        control_id,
                        tenant_id,
                        COUNT(*) AS risk_count,
                        COALESCE(MAX(score), 0) AS worst_risk_score
                    FROM risks
                    WHERE tenant_id = :tenant_id
                      AND control_id IS NOT NULL
                    GROUP BY control_id, tenant_id
                ) rk
                    ON rk.control_id = c.id
                   AND rk.tenant_id = :tenant_id

                LEFT JOIN (
                    SELECT
                        control_id,
                        tenant_id,
                        COUNT(*) FILTER (
                            WHERE LOWER(
                                COALESCE(status, '')
                            ) NOT IN (
                                'resolved',
                                'accepted',
                                'closed',
                                'cancelled',
                                'archived'
                            )
                        ) AS gap_count,
                        COALESCE(
                            MAX(severity_score) FILTER (
                                WHERE LOWER(
                                    COALESCE(status, '')
                                ) NOT IN (
                                    'resolved',
                                    'accepted',
                                    'closed',
                                    'cancelled',
                                    'archived'
                                )
                            ),
                            0
                        ) AS worst_gap_severity
                    FROM gap_items
                    WHERE tenant_id = :tenant_id
                      AND control_id IS NOT NULL
                    GROUP BY control_id, tenant_id
                ) gp
                    ON gp.control_id = c.id
                   AND gp.tenant_id = :tenant_id

                LEFT JOIN (
                    SELECT
                        control_id,
                        tenant_id,
                        COUNT(*) FILTER (
                            WHERE LOWER(
                                COALESCE(status, '')
                            ) NOT IN ('closed', 'cancelled')
                        ) AS open_task_count
                    FROM compliance_tasks
                    WHERE tenant_id = :tenant_id
                      AND control_id IS NOT NULL
                    GROUP BY control_id, tenant_id
                ) ts
                    ON ts.control_id = c.id
                   AND ts.tenant_id = :tenant_id

                WHERE c.id = :control_id

                LIMIT 1
                """
            ),
            {
                "tenant_id": tenant_id,
                "control_id": control_id,
            },
        ).mappings().first()

        if not row:
            raise ValueError(
                f"Control {control_id} not found."
            )

        evidence_count = self._safe_int(
            row["evidence_count"]
        )

        approved_evidence_count = self._safe_int(
            row["approved_evidence_count"]
        )

        risk_count = self._safe_int(
            row["risk_count"]
        )

        gap_count = self._safe_int(
            row["gap_count"]
        )

        open_task_count = self._safe_int(
            row["open_task_count"]
        )

        worst_risk_score = self._safe_float(
            row["worst_risk_score"]
        )

        worst_gap_severity = self._safe_float(
            row["worst_gap_severity"]
        )

        coverage_status = str(
            row["coverage_status"] or "uncovered"
        ).lower()

        if coverage_status == "covered":
            coverage_health = 100.0
        elif coverage_status == "partial":
            coverage_health = 50.0
        else:
            coverage_health = 0.0

        if evidence_count <= 0:
            evidence_quality = 0.0
        else:
            evidence_quality = self._clamp(
                approved_evidence_count
                / evidence_count
                * 100.0
            )

        # Risk Health:
        # No linked risk means there is no risk signal.
        # Do not interpret absence of risk data as perfect health.
        if risk_count > 0:
            risk_health = self._clamp(
                100.0 - worst_risk_score
            )
        else:
            risk_health = None

        # Gap Health:
        # No open gaps means there is no gap signal.
        # Do not interpret absence of gaps as perfect health.
        if gap_count > 0:
            gap_health = self._clamp(
                100.0 - worst_gap_severity
            )
        else:
            gap_health = None

        # Remediation Health:
        # Remediation is meaningful only when open gaps exist.
        # No tasks against open gaps means 0 remediation health.
        if gap_count > 0:
            remediation_health = self._clamp(
                (open_task_count / gap_count) * 100.0
            )
        else:
            remediation_health = None

        # Only include dimensions for which a meaningful signal exists.
        components = [
            (coverage_health, self.weights.coverage),
            (evidence_quality, self.weights.evidence),
        ]

        if risk_health is not None:
            components.append(
                (risk_health, self.weights.risk)
            )

        if gap_health is not None:
            components.append(
                (gap_health, self.weights.gap)
            )

        if remediation_health is not None:
            components.append(
                (remediation_health, self.weights.remediation)
            )

        active_weight = sum(
            weight
            for _, weight in components
        )

        if active_weight <= 0.0:
            health_index = 0.0
        else:
            health_index = sum(
                value * weight
                for value, weight in components
            ) / active_weight

        return ControlHealthResult(
            control_id=self._safe_int(
                row["control_id"]
            ),
            control_code=row.get("control_code"),
            control_title=row.get("control_title"),
            health_index=round(
                self._clamp(health_index),
                2,
            ),
            coverage_health=round(
                coverage_health,
                2,
            ),
            evidence_quality=round(
                evidence_quality,
                2,
            ),
            risk_health=(
                round(risk_health, 2)
                if risk_health is not None
                else None
            ),
            gap_health=(
                round(gap_health, 2)
                if gap_health is not None
                else None
            ),
            remediation_health=(
                round(remediation_health, 2)
                if remediation_health is not None
                else None
            ),
            evidence_count=evidence_count,
            approved_evidence_count=approved_evidence_count,
            risk_count=risk_count,
            gap_count=gap_count,
            open_task_count=open_task_count,
            worst_risk_score=round(
                worst_risk_score,
                2,
            ),
            worst_gap_severity=round(
                worst_gap_severity,
                2,
            ),
        )

