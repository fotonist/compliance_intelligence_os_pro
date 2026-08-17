from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session

from app.models.risks import Risk
from app.models.risk_forecasts import RiskForecast
from app.models.risk_versions import RiskVersion  # type: ignore
from app.models.risk_evidence_link import RiskEvidenceLink
from app.models.evidence_files import EvidenceFile
from app.models.audit_finding_records import AuditFindingRecord


@dataclass
class RiskExposureDTO:
    tenant_id: int
    risk_id: int
    risk_version_id: int
    title: str
    control_id: Optional[int]
    risk_level: Optional[str]
    inherent_score: float
    linked_evidence_count: int
    approved_evidence_count: int
    evidence_quality: float
    density_factor: float
    pressure_factor: float
    finding_pressure_score: float
    velocity_factor: float
    residual_exposure: float
    escalation_probability_30d: float
    expected_score_delta: float
    unified_score: float


@dataclass
class ExposureTotalsDTO:
    total_inherent: float
    total_residual: float
    exposure_reduction: float
    exposure_index: float


class ExposureEngine:
    """Compliance OS – Phase-2 Unified Exposure Engine.

    Active audit findings contribute to the control pressure factor.
    Closed / verified findings do not contribute active pressure.
    """

    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _clamp01(x: float) -> float:
        return max(0.0, min(1.0, x))

    @staticmethod
    def _safe_float(x: Any, default: float = 0.0) -> float:
        try:
            return default if x is None else float(x)
        except Exception:
            return default

    @staticmethod
    def _safe_int(x: Any, default: int = 0) -> int:
        try:
            return default if x is None else int(x)
        except Exception:
            return default

    def _latest_risk_versions(self, tenant_id: int) -> List[Tuple[int, int, float]]:
        subq = (
            select(
                RiskVersion.risk_id.label("risk_id"),
                func.max(RiskVersion.created_at).label("max_created_at"),
            )
            .where(RiskVersion.tenant_id == tenant_id)
            .group_by(RiskVersion.risk_id)
            .subquery()
        )
        stmt = (
            select(RiskVersion.risk_id, RiskVersion.id, RiskVersion.score)
            .join(
                subq,
                and_(
                    RiskVersion.risk_id == subq.c.risk_id,
                    RiskVersion.created_at == subq.c.max_created_at,
                ),
            )
            .where(RiskVersion.tenant_id == tenant_id)
        )
        rows = self.db.execute(stmt).all()
        return [
            (self._safe_int(r[0]), self._safe_int(r[1]), self._safe_float(r[2]))
            for r in rows
        ]

    def _evidence_counts_by_risk_version(self, tenant_id: int) -> Dict[int, Tuple[int, int]]:
        stmt = (
            select(
                RiskEvidenceLink.risk_version_id.label("risk_version_id"),
                func.count(func.distinct(RiskEvidenceLink.evidence_file_id)).label("linked_cnt"),
                func.count(
                    func.distinct(
                        case(
                            (func.lower(EvidenceFile.status) == "approved", EvidenceFile.id),
                            else_=None,
                        )
                    )
                ).label("approved_cnt"),
            )
            .select_from(RiskEvidenceLink)
            .join(
                EvidenceFile,
                and_(
                    EvidenceFile.id == RiskEvidenceLink.evidence_file_id,
                    EvidenceFile.tenant_id == RiskEvidenceLink.tenant_id,
                ),
            )
            .where(RiskEvidenceLink.tenant_id == tenant_id)
            .group_by(RiskEvidenceLink.risk_version_id)
        )
        rows = self.db.execute(stmt).all()
        return {
            self._safe_int(rv_id): (self._safe_int(linked), self._safe_int(approved))
            for rv_id, linked, approved in rows
        }

    def _risk_count_per_control(self, tenant_id: int) -> Dict[int, int]:
        stmt = (
            select(Risk.control_id, func.count(Risk.id).label("risk_cnt"))
            .where(and_(Risk.tenant_id == tenant_id, Risk.control_id.isnot(None)))
            .group_by(Risk.control_id)
        )
        rows = self.db.execute(stmt).all()
        return {self._safe_int(cid): self._safe_int(cnt) for cid, cnt in rows}

    def _finding_pressure_by_control(self, tenant_id: int) -> Dict[int, float]:
        """Aggregate active finding pressure by control."""
        rows = self.db.execute(
            select(
                AuditFindingRecord.control_id,
                AuditFindingRecord.severity,
                AuditFindingRecord.status,
            ).where(AuditFindingRecord.tenant_id == tenant_id)
        ).all()

        out: Dict[int, float] = {}
        severity_weights = {
            "CRITICAL": 1.00,
            "MAJOR": 0.80,
            "HIGH": 0.80,
            "MEDIUM": 0.50,
            "MINOR": 0.25,
            "LOW": 0.25,
        }
        workflow_factors = {
            "READY_FOR_VERIFICATION": 0.25,
            "IN_PROGRESS": 0.50,
            "PLAN_APPROVED": 0.50,
        }

        for control_id, severity, status in rows:
            if control_id is None:
                continue
            status_key = str(status or "").upper()
            if status_key in {"CLOSED", "VERIFIED"}:
                continue
            severity_key = str(severity or "").upper()
            weight = severity_weights.get(severity_key, 0.50)
            factor = workflow_factors.get(status_key, 1.00)
            cid = self._safe_int(control_id)
            out[cid] = out.get(cid, 0.0) + weight * factor

        return out

    def _latest_forecasts_by_risk(self, tenant_id: int) -> Dict[int, Tuple[float, float]]:
        subq = (
            select(
                RiskForecast.risk_id.label("risk_id"),
                func.max(RiskForecast.created_at).label("max_created_at"),
            )
            .where(RiskForecast.tenant_id == tenant_id)
            .group_by(RiskForecast.risk_id)
            .subquery()
        )
        stmt = (
            select(
                RiskForecast.risk_id,
                RiskForecast.escalation_probability_30d,
                RiskForecast.expected_score_delta,
            )
            .join(
                subq,
                and_(
                    RiskForecast.risk_id == subq.c.risk_id,
                    RiskForecast.created_at == subq.c.max_created_at,
                ),
            )
            .where(RiskForecast.tenant_id == tenant_id)
        )
        rows = self.db.execute(stmt).all()
        return {
            self._safe_int(rid): (self._safe_float(prob), self._safe_float(delta))
            for rid, prob, delta in rows
        }

    def _calc_evidence_quality(self, approved: int, linked: int) -> float:
        return 0.0 if linked <= 0 else self._clamp01(float(approved) / float(linked))

    def _calc_density_factor(self, linked: int) -> float:
        return 0.0 if linked <= 0 else self._clamp01(float(linked) / 3.0)

    def _calc_pressure_factor(self, risk_count_for_control: int, finding_pressure_score: float) -> float:
        rc = max(0, int(risk_count_for_control))
        return 1.0 + (float(rc) / 10.0) + (max(0.0, float(finding_pressure_score)) / 10.0)

    def _calc_velocity_factor(self, expected_delta: float) -> float:
        return 1.0 + (float(expected_delta) / 20.0)

    def _calc_residual(self, inherent: float, evidence_quality: float, density_factor: float, pressure_factor: float, velocity_factor: float) -> float:
        residual = (
            float(inherent)
            * (1.0 - float(evidence_quality))
            * (1.0 - float(density_factor) * 0.3)
            * float(pressure_factor)
            * float(velocity_factor)
        )
        return max(0.0, residual)

    def compute_risk_exposure(self, tenant_id: int, limit: int = 200) -> List[RiskExposureDTO]:
        latest_versions = self._latest_risk_versions(tenant_id)
        evidence_map = self._evidence_counts_by_risk_version(tenant_id)
        control_risk_counts = self._risk_count_per_control(tenant_id)
        finding_pressure_map = self._finding_pressure_by_control(tenant_id)
        forecast_map = self._latest_forecasts_by_risk(tenant_id)

        if not latest_versions:
            return []

        risk_ids = [rid for rid, _rv, _score in latest_versions]
        risk_stmt = select(
            Risk.id,
            Risk.title,
            Risk.control_id,
            Risk.risk_level,
        ).where(and_(Risk.tenant_id == tenant_id, Risk.id.in_(risk_ids)))
        risk_rows = self.db.execute(risk_stmt).all()
        risk_meta: Dict[int, Dict[str, Any]] = {
            self._safe_int(rid): {
                "title": title or "",
                "control_id": self._safe_int(control_id) if control_id is not None else None,
                "risk_level": risk_level,
            }
            for rid, title, control_id, risk_level in risk_rows
        }

        out: List[RiskExposureDTO] = []
        for risk_id, rv_id, score in latest_versions:
            meta = risk_meta.get(risk_id, {"title": "", "control_id": None, "risk_level": None})
            title = str(meta.get("title") or "")
            control_id = meta.get("control_id")
            risk_level = meta.get("risk_level")

            linked_cnt, approved_cnt = evidence_map.get(rv_id, (0, 0))
            evidence_quality = self._calc_evidence_quality(approved_cnt, linked_cnt)
            density_factor = self._calc_density_factor(linked_cnt)
            risk_count_for_control = control_risk_counts.get(int(control_id), 0) if control_id else 0
            finding_pressure_score = finding_pressure_map.get(int(control_id), 0.0) if control_id else 0.0
            pressure_factor = self._calc_pressure_factor(risk_count_for_control, finding_pressure_score)

            prob, expected_delta = forecast_map.get(risk_id, (0.0, 0.0))
            velocity_factor = self._calc_velocity_factor(expected_delta)
            residual = self._calc_residual(score, evidence_quality, density_factor, pressure_factor, velocity_factor)
            unified = float(residual) * float(prob)

            out.append(
                RiskExposureDTO(
                    tenant_id=int(tenant_id),
                    risk_id=int(risk_id),
                    risk_version_id=int(rv_id),
                    title=title,
                    control_id=control_id,
                    risk_level=risk_level,
                    inherent_score=float(score),
                    linked_evidence_count=int(linked_cnt),
                    approved_evidence_count=int(approved_cnt),
                    evidence_quality=float(evidence_quality),
                    density_factor=float(density_factor),
                    pressure_factor=float(pressure_factor),
                    finding_pressure_score=float(finding_pressure_score),
                    velocity_factor=float(velocity_factor),
                    residual_exposure=float(residual),
                    escalation_probability_30d=float(prob),
                    expected_score_delta=float(expected_delta),
                    unified_score=float(unified),
                )
            )

        out.sort(key=lambda x: x.unified_score, reverse=True)
        return out[: int(limit)]

    def compute_totals(self, tenant_id: int) -> ExposureTotalsDTO:
        rows = self.compute_risk_exposure(tenant_id=tenant_id, limit=1000000)
        total_inherent = sum(r.inherent_score for r in rows)
        total_residual = sum(r.residual_exposure for r in rows)
        reduction = 0.0 if total_inherent <= 0 else (total_inherent - total_residual) / total_inherent
        return ExposureTotalsDTO(
            total_inherent=float(total_inherent),
            total_residual=float(total_residual),
            exposure_reduction=float(reduction),
            exposure_index=float(total_residual),
        )
