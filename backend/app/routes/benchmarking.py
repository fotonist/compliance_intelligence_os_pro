from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.schemas.benchmarking_schema import (
    BenchmarkComparisonResponse,
    BenchmarkSnapshotResponse,
    BenchmarkSummaryResponse,
    PeerBenchmarkResponse,
    PeerMetricBenchmarkResponse,
)
from app.services.benchmarking_service import BenchmarkingService


router = APIRouter(
    prefix="/benchmarking",
    tags=["Benchmarking"],
)

service = BenchmarkingService()


def _tenant_id_from_user(user: Any) -> int:
    tenant_id = getattr(user, "tenant_id", None)

    if tenant_id is None or int(tenant_id) <= 0:
        raise HTTPException(
            status_code=403,
            detail="Authenticated user has no valid tenant scope.",
        )

    return int(tenant_id)


def _peer_response(peer) -> PeerBenchmarkResponse:
    return PeerBenchmarkResponse(
        available=peer.available,
        reason=peer.reason,
        population_key=peer.population_key,
        peer_count=peer.peer_count,
        snapshot_count=peer.snapshot_count,
        current_snapshot_at=peer.current_snapshot_at,
        metrics=[
            PeerMetricBenchmarkResponse(
                metric=metric.metric,
                company_value=metric.company_value,
                benchmark_value=metric.benchmark_value,
                percentile=metric.percentile,
                gap=metric.gap,
                population_size=metric.population_size,
                scope=metric.scope,
                period=metric.period,
                calculated_at=metric.calculated_at,
                source=metric.source,
            )
            for metric in peer.metrics
        ],
    )


@router.get(
    "/summary",
    response_model=BenchmarkSummaryResponse,
)
def benchmarking_summary(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> BenchmarkSummaryResponse:
    tenant_id = _tenant_id_from_user(user)

    latest = service.get_latest(
        db=db,
        tenant_id=tenant_id,
    )

    comparison = service.compare_latest(
        db=db,
        tenant_id=tenant_id,
    )

    snapshot_count = len(
        service.get_history(
            db=db,
            tenant_id=tenant_id,
            limit=365,
        )
    )

    peer = service.get_peer_benchmark(
        db=db,
        tenant_id=tenant_id,
    )

    return BenchmarkSummaryResponse(
        tenant_id=tenant_id,
        latest=latest,
        comparison=BenchmarkComparisonResponse(
            current=comparison.current,
            previous=comparison.previous,
            delta=comparison.delta,
            direction=comparison.direction,
            sufficient_data=comparison.sufficient_data,
        ),
        historical_snapshot_count=snapshot_count,
        peer_benchmark_available=peer.available,
        peer_benchmark_reason=peer.reason,
    )


@router.get(
    "/peer",
    response_model=PeerBenchmarkResponse,
)
def benchmarking_peer(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> PeerBenchmarkResponse:
    tenant_id = _tenant_id_from_user(user)

    peer = service.get_peer_benchmark(
        db=db,
        tenant_id=tenant_id,
    )

    return _peer_response(peer)


@router.get(
    "/history",
    response_model=list[BenchmarkSnapshotResponse],
)
def benchmarking_history(
    limit: int = Query(
        default=30,
        ge=1,
        le=365,
    ),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> list[BenchmarkSnapshotResponse]:
    tenant_id = _tenant_id_from_user(user)

    return service.get_history(
        db=db,
        tenant_id=tenant_id,
        limit=limit,
    )


@router.get(
    "/comparison",
    response_model=BenchmarkComparisonResponse,
)
def benchmarking_comparison(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> BenchmarkComparisonResponse:
    tenant_id = _tenant_id_from_user(user)

    comparison = service.compare_latest(
        db=db,
        tenant_id=tenant_id,
    )

    return BenchmarkComparisonResponse(
        current=comparison.current,
        previous=comparison.previous,
        delta=comparison.delta,
        direction=comparison.direction,
        sufficient_data=comparison.sufficient_data,
    )


@router.post(
    "/snapshot",
    response_model=BenchmarkSnapshotResponse,
)
def create_benchmark_snapshot(
    period_start: datetime | None = Query(default=None),
    period_end: datetime | None = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
) -> BenchmarkSnapshotResponse:
    tenant_id = _tenant_id_from_user(user)

    if period_start and period_end and period_start > period_end:
        raise HTTPException(
            status_code=400,
            detail="period_start cannot be later than period_end.",
        )

    snapshot = service.capture_current_snapshot(
        db=db,
        tenant_id=tenant_id,
        period_start=period_start,
        period_end=period_end,
    )

    db.commit()
    db.refresh(snapshot)

    return snapshot
