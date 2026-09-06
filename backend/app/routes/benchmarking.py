from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.dependencies.permission_checker import require_permission
from app.models.peer_population import PeerPopulation, PeerPopulationMember
from app.models.tenants import Tenant
from app.schemas.benchmarking_schema import (
    BenchmarkComparisonResponse,
    BenchmarkSnapshotResponse,
    BenchmarkSummaryResponse,
    PeerBenchmarkResponse,
    PeerPopulationCreateRequest,
    PeerPopulationMemberCreateRequest,
    PeerPopulationMemberResponse,
    PeerPopulationMemberUpdateRequest,
    PeerPopulationResponse,
    PeerPopulationUpdateRequest,
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


def _get_population(
    db: Session,
    population_id: int,
) -> PeerPopulation:
    population = db.get(PeerPopulation, population_id)

    if population is None:
        raise HTTPException(
            status_code=404,
            detail="Peer benchmark population not found.",
        )

    return population


def _validate_effective_dates(
    effective_from: datetime | None,
    effective_to: datetime | None,
) -> None:
    if effective_from and effective_to and effective_from > effective_to:
        raise HTTPException(
            status_code=400,
            detail="effective_from cannot be later than effective_to.",
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

    peer_result = service.get_peer_benchmark(
        db=db,
        tenant_id=tenant_id,
    )

    peer_benchmark = PeerBenchmarkResponse(
        available=peer_result.available,
        reason=peer_result.reason,
        population_id=peer_result.population_id,
        population_name=peer_result.population_name,
        current_tenant_score=peer_result.current_tenant_score,
        peer_average_score=peer_result.peer_average_score,
        delta_vs_peer=peer_result.delta_vs_peer,
        peer_sample_size=peer_result.peer_sample_size,
        minimum_sample_size=peer_result.minimum_sample_size,
        metric="uee_score",
        evaluated_at=peer_result.evaluated_at,
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
        peer_benchmark_available=peer_result.available,
        peer_benchmark_reason=peer_result.reason,
        peer_benchmark=peer_benchmark,
    )


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


@router.get(
    "/populations",
    response_model=list[PeerPopulationResponse],
)
def list_peer_populations(
    db: Session = Depends(get_db),
    user=Depends(require_permission("admin.full")),
) -> list[PeerPopulation]:
    return list(
        db.scalars(
            select(PeerPopulation).order_by(
                PeerPopulation.updated_at.desc(),
                PeerPopulation.id.desc(),
            )
        ).all()
    )


@router.post(
    "/populations",
    response_model=PeerPopulationResponse,
    status_code=201,
)
def create_peer_population(
    payload: PeerPopulationCreateRequest,
    db: Session = Depends(get_db),
    user=Depends(require_permission("admin.full")),
) -> PeerPopulation:
    population = PeerPopulation(
        name=payload.name,
        description=payload.description,
        industry=payload.industry,
        geography=payload.geography,
        company_size_band=payload.company_size_band,
        revenue_band=payload.revenue_band,
        standard_id=payload.standard_id,
        minimum_sample_size=payload.minimum_sample_size,
        status=payload.status,
        created_by=getattr(user, "id", None),
    )

    db.add(population)
    db.commit()
    db.refresh(population)

    return population


@router.get(
    "/populations/tenant-candidates",
)
def list_population_tenant_candidates(
    db: Session = Depends(get_db),
    user=Depends(require_permission("admin.full")),
):
    rows = (
        db.query(Tenant)
        .filter(Tenant.status == "active")
        .order_by(Tenant.name.asc())
        .all()
    )

    return [
        {
            "id": tenant.id,
            "code": tenant.code,
            "name": tenant.name,
            "status": tenant.status,
        }
        for tenant in rows
    ]


@router.get(
    "/populations/{population_id}",
    response_model=PeerPopulationResponse,
)
def get_peer_population(
    population_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_permission("admin.full")),
) -> PeerPopulation:
    return _get_population(
        db=db,
        population_id=population_id,
    )


@router.patch(
    "/populations/{population_id}",
    response_model=PeerPopulationResponse,
)
def update_peer_population(
    population_id: int,
    payload: PeerPopulationUpdateRequest,
    db: Session = Depends(get_db),
    user=Depends(require_permission("admin.full")),
) -> PeerPopulation:
    population = _get_population(
        db=db,
        population_id=population_id,
    )

    updates = payload.model_dump(exclude_unset=True)

    for field, value in updates.items():
        setattr(population, field, value)

    population.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(population)

    return population


@router.delete(
    "/populations/{population_id}",
    status_code=204,
)
def delete_peer_population(
    population_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_permission("admin.full")),
) -> None:
    population = _get_population(
        db=db,
        population_id=population_id,
    )

    db.delete(population)
    db.commit()


@router.get(
    "/populations/{population_id}/members",
    response_model=list[PeerPopulationMemberResponse],
)
def list_peer_population_members(
    population_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_permission("admin.full")),
) -> list[PeerPopulationMember]:
    _get_population(
        db=db,
        population_id=population_id,
    )

    return list(
        db.scalars(
            select(PeerPopulationMember)
            .where(
                PeerPopulationMember.population_id == population_id,
            )
            .order_by(
                PeerPopulationMember.tenant_id.asc(),
                PeerPopulationMember.id.asc(),
            )
        ).all()
    )


@router.post(
    "/populations/{population_id}/members",
    response_model=PeerPopulationMemberResponse,
    status_code=201,
)
def create_peer_population_member(
    population_id: int,
    payload: PeerPopulationMemberCreateRequest,
    db: Session = Depends(get_db),
    user=Depends(require_permission("admin.full")),
) -> PeerPopulationMember:
    _get_population(
        db=db,
        population_id=population_id,
    )

    tenant = db.get(Tenant, payload.tenant_id)

    if tenant is None:
        raise HTTPException(
            status_code=404,
            detail="Tenant not found.",
        )

    existing = db.scalar(
        select(PeerPopulationMember).where(
            PeerPopulationMember.population_id == population_id,
            PeerPopulationMember.tenant_id == payload.tenant_id,
        )
    )

    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail="Tenant is already a member of this peer population.",
        )

    _validate_effective_dates(
        payload.effective_from,
        payload.effective_to,
    )

    member = PeerPopulationMember(
        population_id=population_id,
        tenant_id=payload.tenant_id,
        membership_type=payload.membership_type,
        eligibility_status=payload.eligibility_status,
        effective_from=payload.effective_from,
        effective_to=payload.effective_to,
    )

    db.add(member)
    db.commit()
    db.refresh(member)

    return member


@router.patch(
    "/populations/{population_id}/members/{tenant_id}",
    response_model=PeerPopulationMemberResponse,
)
def update_peer_population_member(
    population_id: int,
    tenant_id: int,
    payload: PeerPopulationMemberUpdateRequest,
    db: Session = Depends(get_db),
    user=Depends(require_permission("admin.full")),
) -> PeerPopulationMember:
    _get_population(
        db=db,
        population_id=population_id,
    )

    member = db.scalar(
        select(PeerPopulationMember).where(
            PeerPopulationMember.population_id == population_id,
            PeerPopulationMember.tenant_id == tenant_id,
        )
    )

    if member is None:
        raise HTTPException(
            status_code=404,
            detail="Peer population member not found.",
        )

    updates = payload.model_dump(exclude_unset=True)

    effective_from = updates.get(
        "effective_from",
        member.effective_from,
    )
    effective_to = updates.get(
        "effective_to",
        member.effective_to,
    )

    _validate_effective_dates(
        effective_from,
        effective_to,
    )

    for field, value in updates.items():
        setattr(member, field, value)

    member.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(member)

    return member


@router.delete(
    "/populations/{population_id}/members/{tenant_id}",
    status_code=204,
)
def delete_peer_population_member(
    population_id: int,
    tenant_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_permission("admin.full")),
) -> None:
    _get_population(
        db=db,
        population_id=population_id,
    )

    member = db.scalar(
        select(PeerPopulationMember).where(
            PeerPopulationMember.population_id == population_id,
            PeerPopulationMember.tenant_id == tenant_id,
        )
    )

    if member is None:
        raise HTTPException(
            status_code=404,
            detail="Peer population member not found.",
        )

    db.delete(member)
    db.commit()
