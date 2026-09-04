from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from statistics import median
from typing import Any

from sqlalchemy.orm import Session

from app.models.benchmark_snapshot import BenchmarkSnapshot
from app.models.peer_population import PeerPopulation
from app.services.uee_config_provider import get_active_uee_weights
from app.services.uee_engine import UEEEngine


@dataclass(frozen=True)
class BenchmarkComparison:
    current: float | None
    previous: float | None
    delta: float | None
    direction: str
    sufficient_data: bool


@dataclass(frozen=True)
class PeerMetricBenchmark:
    metric: str
    company_value: float
    benchmark_value: float
    percentile: float
    gap: float
    population_size: int
    scope: str
    period: datetime
    calculated_at: datetime
    source: str


@dataclass(frozen=True)
class PeerBenchmark:
    available: bool
    reason: str | None
    population_key: str | None
    peer_count: int
    snapshot_count: int
    current_snapshot_at: datetime | None
    metrics: tuple[PeerMetricBenchmark, ...]


class BenchmarkingService:
    """
    Enterprise benchmarking service.

    Benchmarking is based exclusively on persisted, tenant-scoped UEE
    snapshots. No mock, seed, or synthetic benchmark values are generated.

    UEE remains the canonical calculation engine. This service only:
      1. captures a real UEE state,
      2. persists it as a benchmark snapshot,
      3. reads historical snapshots,
      4. calculates comparisons from persisted observations,
      5. aggregates peer observations from explicit peer population membership.
    """

    MIN_PEER_COUNT = 3

    _PEER_METRICS = (
        "uee_score",
        "compliance_health_index",
        "risk_index",
        "coverage_index",
        "maturity_index",
        "evidence_index",
        "task_pressure_index",
    )

    _HIGHER_IS_BETTER = {"compliance_health_index"}

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

    def get_peer_benchmark(
        self,
        *,
        db: Session,
        tenant_id: int,
    ) -> PeerBenchmark:
        if tenant_id <= 0:
            raise ValueError("Invalid tenant_id")

        current = self.get_latest(db=db, tenant_id=tenant_id)
        if current is None:
            return PeerBenchmark(
                available=False,
                reason="no_current_snapshot",
                population_key=None,
                peer_count=0,
                snapshot_count=0,
                current_snapshot_at=None,
                metrics=(),
            )

        membership = (
            db.query(PeerPopulation)
            .filter(
                PeerPopulation.tenant_id == tenant_id,
                PeerPopulation.is_active.is_(True),
            )
            .first()
        )

        if membership is None:
            return PeerBenchmark(
                available=False,
                reason="no_active_peer_population",
                population_key=None,
                peer_count=0,
                snapshot_count=0,
                current_snapshot_at=current.snapshot_at,
                metrics=(),
            )

        population_members = (
            db.query(PeerPopulation.tenant_id)
            .filter(
                PeerPopulation.population_key == membership.population_key,
                PeerPopulation.is_active.is_(True),
            )
            .all()
        )

        peer_tenant_ids = {
            int(row[0])
            for row in population_members
            if int(row[0]) != tenant_id
        }

        if not peer_tenant_ids:
            return PeerBenchmark(
                available=False,
                reason="insufficient_peer_population",
                population_key=membership.population_key,
                peer_count=0,
                snapshot_count=0,
                current_snapshot_at=current.snapshot_at,
                metrics=(),
            )

        peer_snapshots = (
            db.query(BenchmarkSnapshot)
            .filter(
                BenchmarkSnapshot.tenant_id.in_(peer_tenant_ids),
                BenchmarkSnapshot.snapshot_at <= current.snapshot_at,
            )
            .order_by(
                BenchmarkSnapshot.tenant_id.asc(),
                BenchmarkSnapshot.snapshot_at.desc(),
                BenchmarkSnapshot.id.desc(),
            )
            .all()
        )

        latest_by_tenant: dict[int, BenchmarkSnapshot] = {}
        for snapshot in peer_snapshots:
            peer_id = int(snapshot.tenant_id)
            if peer_id not in latest_by_tenant:
                latest_by_tenant[peer_id] = snapshot

        peer_count = len(latest_by_tenant)

        if peer_count < self.MIN_PEER_COUNT:
            return PeerBenchmark(
                available=False,
                reason="insufficient_peer_snapshots",
                population_key=membership.population_key,
                peer_count=peer_count,
                snapshot_count=len(peer_snapshots),
                current_snapshot_at=current.snapshot_at,
                metrics=(),
            )

        calculated_at = current.snapshot_at
        metrics: list[PeerMetricBenchmark] = []

        for metric in self._PEER_METRICS:
            company_value = float(getattr(current, metric))
            peer_values = [
                float(getattr(snapshot, metric))
                for snapshot in latest_by_tenant.values()
            ]
            benchmark_value = float(median(peer_values))
            percentile = self._percentile(
                company_value,
                peer_values,
                higher_is_better=metric in self._HIGHER_IS_BETTER,
            )

            metrics.append(
                PeerMetricBenchmark(
                    metric=metric,
                    company_value=company_value,
                    benchmark_value=benchmark_value,
                    percentile=percentile,
                    gap=company_value - benchmark_value,
                    population_size=peer_count,
                    scope=membership.population_key,
                    period=current.snapshot_at,
                    calculated_at=calculated_at,
                    source="UEE_PEER",
                )
            )

        return PeerBenchmark(
            available=True,
            reason=None,
            population_key=membership.population_key,
            peer_count=peer_count,
            snapshot_count=len(peer_snapshots),
            current_snapshot_at=current.snapshot_at,
            metrics=tuple(metrics),
        )

    @staticmethod
    def _percentile(
        company_value: float,
        peer_values: list[float],
        *,
        higher_is_better: bool,
    ) -> float:
        if not peer_values:
            return 0.0

        if higher_is_better:
            count = sum(
                value >= company_value
                for value in peer_values
            )
        else:
            count = sum(
                value <= company_value
                for value in peer_values
            )

        return round(
            (float(count) / float(len(peer_values))) * 100.0,
            2,
        )

    @staticmethod
    def _calculate_data_quality(
        source_stats: dict[str, Any],
        warnings: tuple[str, ...],
    ) -> float:
        warning_count = len(warnings)

        if warning_count <= 0:
            return 100.0

        return max(
            0.0,
            100.0 - (warning_count * 20.0),
        )
