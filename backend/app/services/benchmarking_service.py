from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.benchmark_snapshot import BenchmarkSnapshot
from app.services.uee_engine import UEEEngine
from app.services.uee_config_provider import get_active_uee_weights


@dataclass(frozen=True)
class BenchmarkComparison:
    current: float | None
    previous: float | None
    delta: float | None
    direction: str
    sufficient_data: bool


class BenchmarkingService:
    """
    Enterprise benchmarking service.

    Benchmarking is based exclusively on persisted, tenant-scoped UEE
    snapshots. No mock, seed, or synthetic benchmark values are generated.

    UEE remains the canonical calculation engine. This service only:
      1. captures a real UEE state,
      2. persists it as a benchmark snapshot,
      3. reads historical snapshots,
      4. calculates comparisons from persisted observations.
    """

    def __init__(self) -> None:
        self._uee_engine = UEEEngine(
            weights_provider=get_active_uee_weights,
        )

    def capture_current_snapshot(
        self,
        *,
        db: Session,
        tenant_id: int,
        period_start: datetime | None = None,
        period_end: datetime | None = None,
    ) -> BenchmarkSnapshot:
        if tenant_id <= 0:
            raise ValueError("Invalid tenant_id")

        state = self._uee_engine.compute_summary(
            db=db,
            tenant_id=tenant_id,
        )

        source_stats = state.source_stats

        risk_count = int(
            source_stats.get("risk", {}).get("row_count", 0) or 0
        )

        control_count = int(
            source_stats.get("coverage", {}).get("total_controls", 0) or 0
        )

        evidence_count = int(
            source_stats.get("evidence", {}).get("total_files", 0) or 0
        )

        data_quality_score = self._calculate_data_quality(
            state.source_stats,
            state.warnings,
        )

        snapshot = BenchmarkSnapshot(
            tenant_id=tenant_id,
            snapshot_at=state.computed_at,
            period_start=period_start,
            period_end=period_end,
            uee_score=float(state.unified_exposure_score),
            compliance_health_index=float(
                state.compliance_health_index
            ),
            risk_index=float(state.risk_index),
            coverage_index=float(state.coverage_index),
            maturity_index=float(state.maturity_index),
            evidence_index=float(state.evidence_index),
            task_pressure_index=float(
                state.task_pressure_index
            ),
            risk_count=risk_count,
            control_count=control_count,
            evidence_count=evidence_count,
            data_quality_score=data_quality_score,
            source="UEE",
            engine_version="UEE-v1",
        )

        db.add(snapshot)
        db.flush()

        return snapshot

    def get_history(
        self,
        *,
        db: Session,
        tenant_id: int,
        limit: int = 30,
    ) -> list[BenchmarkSnapshot]:
        if tenant_id <= 0:
            raise ValueError("Invalid tenant_id")

        limit = max(1, min(int(limit), 365))

        return (
            db.query(BenchmarkSnapshot)
            .filter(
                BenchmarkSnapshot.tenant_id == tenant_id,
            )
            .order_by(
                BenchmarkSnapshot.snapshot_at.desc(),
                BenchmarkSnapshot.id.desc(),
            )
            .limit(limit)
            .all()
        )

    def get_latest(
        self,
        *,
        db: Session,
        tenant_id: int,
    ) -> BenchmarkSnapshot | None:
        return (
            db.query(BenchmarkSnapshot)
            .filter(
                BenchmarkSnapshot.tenant_id == tenant_id,
            )
            .order_by(
                BenchmarkSnapshot.snapshot_at.desc(),
                BenchmarkSnapshot.id.desc(),
            )
            .first()
        )

    def compare_latest(
        self,
        *,
        db: Session,
        tenant_id: int,
    ) -> BenchmarkComparison:
        snapshots = self.get_history(
            db=db,
            tenant_id=tenant_id,
            limit=2,
        )

        if not snapshots:
            return BenchmarkComparison(
                current=None,
                previous=None,
                delta=None,
                direction="insufficient_data",
                sufficient_data=False,
            )

        current = float(snapshots[0].uee_score)

        if len(snapshots) < 2:
            return BenchmarkComparison(
                current=current,
                previous=None,
                delta=None,
                direction="insufficient_data",
                sufficient_data=False,
            )

        previous = float(snapshots[1].uee_score)
        delta = current - previous

        if delta < 0:
            direction = "improved"
        elif delta > 0:
            direction = "deteriorated"
        else:
            direction = "unchanged"

        return BenchmarkComparison(
            current=current,
            previous=previous,
            delta=delta,
            direction=direction,
            sufficient_data=True,
        )

    @staticmethod
    def _calculate_data_quality(
        source_stats: dict[str, Any],
        warnings: tuple[str, ...],
    ) -> float:
        """
        Conservative data-quality indicator.

        This is not a compliance score and does not alter UEE.
        It communicates whether the benchmark observation had sufficient
        underlying source data.

        100 = no source warnings
        80  = one source warning
        60  = two source warnings
        ...
        """

        warning_count = len(warnings)

        if warning_count <= 0:
            return 100.0

        return max(
            0.0,
            100.0 - (warning_count * 20.0),
        )
