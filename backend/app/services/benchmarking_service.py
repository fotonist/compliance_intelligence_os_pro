from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.benchmark_snapshot import BenchmarkSnapshot
from app.models.framework_adoption import FrameworkAdoption
from app.models.organization import Organization
from app.models.peer_population import PeerPopulation, PeerPopulationMember
from app.services.uee_engine import UEEEngine
from app.services.uee_config_provider import get_active_uee_weights


@dataclass(frozen=True)
class BenchmarkComparison:
    current: float | None
    previous: float | None
    delta: float | None
    direction: str
    sufficient_data: bool


@dataclass(frozen=True)
class PeerBenchmarkResult:
    available: bool
    reason: str | None
    population_id: int | None
    population_name: str | None
    current_tenant_score: float | None
    peer_average_score: float | None
    delta_vs_peer: float | None
    peer_sample_size: int
    minimum_sample_size: int | None
    evaluated_at: datetime | None


class BenchmarkingService:
    """
    Enterprise benchmarking service.

    Benchmarking is based exclusively on persisted, tenant-scoped UEE
    snapshots. No mock, seed, or synthetic benchmark values are generated.

    UEE remains the canonical calculation engine.
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

    def get_peer_benchmark(
        self,
        *,
        db: Session,
        tenant_id: int,
        evaluated_at: datetime | None = None,
    ) -> PeerBenchmarkResult:
        if tenant_id <= 0:
            raise ValueError("Invalid tenant_id")

        evaluation_time = evaluated_at or datetime.now(timezone.utc)

        adoption = (
            db.query(FrameworkAdoption)
            .filter(
                FrameworkAdoption.tenant_id == tenant_id,
                FrameworkAdoption.status == "ACTIVE",
                FrameworkAdoption.applicability == "APPLICABLE",
            )
            .order_by(
                FrameworkAdoption.updated_at.desc(),
                FrameworkAdoption.id.desc(),
            )
            .first()
        )

        population_query = (
            db.query(PeerPopulation)
            .filter(
                PeerPopulation.status == "ACTIVE",
            )
        )

        if adoption is not None:
            population_query = population_query.filter(
                (
                    PeerPopulation.standard_id.is_(None)
                    | (
                        PeerPopulation.standard_id
                        == adoption.standard_id
                    )
                )
            )
        else:
            population_query = population_query.filter(
                PeerPopulation.standard_id.is_(None)
            )

        population = (
            population_query
            .order_by(
                PeerPopulation.updated_at.desc(),
                PeerPopulation.id.desc(),
            )
            .first()
        )

        if population is None:
            return PeerBenchmarkResult(
                available=False,
                reason="No active peer population is configured.",
                population_id=None,
                population_name=None,
                current_tenant_score=None,
                peer_average_score=None,
                delta_vs_peer=None,
                peer_sample_size=0,
                minimum_sample_size=None,
                evaluated_at=evaluation_time,
            )

        current_snapshot = self.get_latest(
            db=db,
            tenant_id=tenant_id,
        )

        if current_snapshot is None:
            return PeerBenchmarkResult(
                available=False,
                reason="Current tenant has no persisted benchmark snapshot.",
                population_id=population.id,
                population_name=population.name,
                current_tenant_score=None,
                peer_average_score=None,
                delta_vs_peer=None,
                peer_sample_size=0,
                minimum_sample_size=population.minimum_sample_size,
                evaluated_at=evaluation_time,
            )

        members = (
            db.query(PeerPopulationMember)
            .filter(
                PeerPopulationMember.population_id == population.id,
                PeerPopulationMember.eligibility_status == "ELIGIBLE",
                (
                    PeerPopulationMember.effective_from.is_(None)
                    | (
                        PeerPopulationMember.effective_from
                        <= evaluation_time
                    )
                ),
                (
                    PeerPopulationMember.effective_to.is_(None)
                    | (
                        PeerPopulationMember.effective_to
                        >= evaluation_time
                    )
                ),
            )
            .all()
        )

        candidate_tenant_ids = {
            int(item.tenant_id)
            for item in members
            if int(item.tenant_id) != tenant_id
        }

        if not candidate_tenant_ids:
            return PeerBenchmarkResult(
                available=False,
                reason="Peer population has no eligible peer tenants.",
                population_id=population.id,
                population_name=population.name,
                current_tenant_score=float(current_snapshot.uee_score),
                peer_average_score=None,
                delta_vs_peer=None,
                peer_sample_size=0,
                minimum_sample_size=population.minimum_sample_size,
                evaluated_at=evaluation_time,
            )

        candidate_tenant_ids = self._filter_peer_tenants(
            db=db,
            population=population,
            tenant_ids=candidate_tenant_ids,
        )

        if not candidate_tenant_ids:
            return PeerBenchmarkResult(
                available=False,
                reason="No eligible peer tenants satisfy the population criteria.",
                population_id=population.id,
                population_name=population.name,
                current_tenant_score=float(current_snapshot.uee_score),
                peer_average_score=None,
                delta_vs_peer=None,
                peer_sample_size=0,
                minimum_sample_size=population.minimum_sample_size,
                evaluated_at=evaluation_time,
            )

        latest_snapshots = self._latest_snapshots_for_tenants(
            db=db,
            tenant_ids=candidate_tenant_ids,
        )

        peer_scores = [
            float(snapshot.uee_score)
            for snapshot in latest_snapshots
            if snapshot.uee_score is not None
        ]

        sample_size = len(peer_scores)

        if sample_size < population.minimum_sample_size:
            return PeerBenchmarkResult(
                available=False,
                reason=(
                    "Peer population does not have enough valid benchmark "
                    "snapshots to satisfy the minimum sample size."
                ),
                population_id=population.id,
                population_name=population.name,
                current_tenant_score=float(current_snapshot.uee_score),
                peer_average_score=None,
                delta_vs_peer=None,
                peer_sample_size=sample_size,
                minimum_sample_size=population.minimum_sample_size,
                evaluated_at=evaluation_time,
            )

        peer_average = sum(peer_scores) / sample_size
        current_score = float(current_snapshot.uee_score)

        return PeerBenchmarkResult(
            available=True,
            reason=None,
            population_id=population.id,
            population_name=population.name,
            current_tenant_score=current_score,
            peer_average_score=peer_average,
            delta_vs_peer=current_score - peer_average,
            peer_sample_size=sample_size,
            minimum_sample_size=population.minimum_sample_size,
            evaluated_at=evaluation_time,
        )

    def _filter_peer_tenants(
        self,
        *,
        db: Session,
        population: PeerPopulation,
        tenant_ids: set[int],
    ) -> set[int]:
        if not tenant_ids:
            return set()

        filtered = set(tenant_ids)

        if population.industry:
            rows = (
                db.query(Organization.tenant_id)
                .filter(
                    Organization.tenant_id.in_(filtered),
                    Organization.industry == population.industry,
                )
                .all()
            )
            filtered &= {int(row[0]) for row in rows}

        if population.company_size_band:
            rows = (
                db.query(Organization.tenant_id)
                .filter(
                    Organization.tenant_id.in_(filtered),
                    Organization.company_size == population.company_size_band,
                )
                .all()
            )
            filtered &= {int(row[0]) for row in rows}

        if population.geography:
            return set()

        if population.revenue_band:
            return set()

        if population.standard_id:
            rows = (
                db.query(FrameworkAdoption.tenant_id)
                .filter(
                    FrameworkAdoption.tenant_id.in_(filtered),
                    FrameworkAdoption.standard_id == population.standard_id,
                    FrameworkAdoption.status == "ACTIVE",
                    FrameworkAdoption.applicability == "APPLICABLE",
                )
                .all()
            )
            filtered &= {int(row[0]) for row in rows}

        return filtered

    @staticmethod
    def _latest_snapshots_for_tenants(
        *,
        db: Session,
        tenant_ids: set[int],
    ) -> list[BenchmarkSnapshot]:
        if not tenant_ids:
            return []

        snapshots = (
            db.query(BenchmarkSnapshot)
            .filter(
                BenchmarkSnapshot.tenant_id.in_(tenant_ids),
            )
            .order_by(
                BenchmarkSnapshot.tenant_id.asc(),
                BenchmarkSnapshot.snapshot_at.desc(),
                BenchmarkSnapshot.id.desc(),
            )
            .all()
        )

        latest_by_tenant: dict[int, BenchmarkSnapshot] = {}

        for snapshot in snapshots:
            tenant_id = int(snapshot.tenant_id)
            if tenant_id not in latest_by_tenant:
                latest_by_tenant[tenant_id] = snapshot

        return list(latest_by_tenant.values())

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



