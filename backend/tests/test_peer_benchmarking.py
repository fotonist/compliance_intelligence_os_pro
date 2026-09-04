from datetime import datetime, timezone

from app.models.benchmark_snapshot import BenchmarkSnapshot
from app.models.peer_population import PeerPopulation
from app.services.benchmarking_service import BenchmarkingService


def _snapshot(tenant_id: int, score: float) -> BenchmarkSnapshot:
    return BenchmarkSnapshot(
        tenant_id=tenant_id,
        snapshot_at=datetime(2026, 9, 4, tzinfo=timezone.utc),
        uee_score=score,
        compliance_health_index=100.0 - score,
        risk_index=score,
        coverage_index=score,
        maturity_index=score,
        evidence_index=score,
        task_pressure_index=score,
        risk_count=1,
        control_count=1,
        evidence_count=1,
        data_quality_score=100.0,
        source="UEE",
        engine_version="UEE-v1",
    )


def test_percentile_higher_is_better():
    assert BenchmarkingService._percentile(80.0, [60.0, 70.0, 80.0], higher_is_better=True) == 33.33


def test_percentile_lower_is_better():
    assert BenchmarkingService._percentile(40.0, [20.0, 30.0, 50.0], higher_is_better=False) == 66.67


def test_peer_benchmark_requires_minimum_peer_snapshots(db_session):
    service = BenchmarkingService()

    db_session.add(PeerPopulation(tenant_id=1, population_key="industry:finance", is_active=True))
    db_session.add(PeerPopulation(tenant_id=2, population_key="industry:finance", is_active=True))
    db_session.add(PeerPopulation(tenant_id=3, population_key="industry:finance", is_active=True))

    db_session.add(_snapshot(1, 40.0))
    db_session.add(_snapshot(2, 30.0))
    db_session.add(_snapshot(3, 35.0))
    db_session.commit()

    result = service.get_peer_benchmark(db=db_session, tenant_id=1)

    assert result.available is False
    assert result.reason == "insufficient_peer_snapshots"


def test_peer_benchmark_uses_real_peer_snapshots(db_session):
    service = BenchmarkingService()

    for tenant_id in range(1, 6):
        db_session.add(
            PeerPopulation(
                tenant_id=tenant_id,
                population_key="industry:finance",
                is_active=True,
            )
        )
        db_session.add(_snapshot(tenant_id, float(20 + tenant_id * 5)))

    db_session.commit()

    result = service.get_peer_benchmark(db=db_session, tenant_id=1)

    assert result.available is True
    assert result.peer_count == 4
    assert result.population_key == "industry:finance"
    assert len(result.metrics) == 7
    assert result.metrics[0].metric == "uee_score"
    assert result.metrics[0].benchmark_value == 37.5
    assert result.metrics[0].company_value == 25.0
