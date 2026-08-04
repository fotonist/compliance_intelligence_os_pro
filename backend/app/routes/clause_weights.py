from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.standards import Standard
from app.models.clauses import Clause
from app.models.clause_weight_override import ClauseWeightOverride
from app.services.clause_weight_engine import ClauseWeightEngine

router = APIRouter(
    prefix="/company/clause-weights",
    tags=["Clause Weights"]
)


class OverrideUpsertPayload(BaseModel):
    standard_code: str
    clause_code: str
    weight_pct: float
    rationale: str | None = None
    is_active: bool = True


@router.get("")
@router.get("/")
def get_clause_weights_home(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Frontend /company/clause-weights çağrısı yaptığında
    404 almaması için varsayılan endpoint.
    """
    rows = db.execute(
        select(ClauseWeightOverride).where(
            ClauseWeightOverride.tenant_id == user.tenant_id
        )
    ).scalars().all()

    return {
        "count": len(rows),
        "items": [
            {
                "id": r.id,
                "standard_id": r.standard_id,
                "clause_id": r.clause_id,
                "weight_pct": r.weight_pct,
                "rationale": r.rationale,
                "is_active": r.is_active,
            }
            for r in rows
        ],
    }


@router.get("/processes/{process_id}")
def get_clause_weights_for_process(
    process_id: int,
    standard_code: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return ClauseWeightEngine.compute_for_process(
        process_id=process_id,
        db=db,
        user=user,
        standard_code=standard_code,
    )


@router.get("/overrides")
def list_overrides(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = db.execute(
        select(ClauseWeightOverride).where(
            and_(
                ClauseWeightOverride.tenant_id == user.tenant_id,
                ClauseWeightOverride.is_active == True,
            )
        )
    ).scalars().all()

    return [
        {
            "id": r.id,
            "tenant_id": r.tenant_id,
            "standard_id": r.standard_id,
            "clause_id": r.clause_id,
            "weight_pct": r.weight_pct,
            "rationale": r.rationale,
            "is_active": r.is_active,
            "created_at": r.created_at,
            "updated_at": r.updated_at,
        }
        for r in rows
    ]


@router.put("/overrides")
def upsert_override(
    payload: OverrideUpsertPayload,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.weight_pct < 0 or payload.weight_pct > 100:
        raise HTTPException(
            status_code=400,
            detail="weight_pct must be between 0 and 100"
        )

    std = db.execute(
        select(Standard).where(Standard.code == payload.standard_code)
    ).scalar_one_or_none()

    if not std:
        raise HTTPException(status_code=404, detail="Standard not found")

    clause = db.execute(
        select(Clause).where(
            and_(
                Clause.code == payload.clause_code,
                Clause.standard_id == std.id,
            )
        )
    ).scalar_one_or_none()

    if not clause:
        raise HTTPException(
            status_code=404,
            detail="Clause not found for this standard"
        )

    existing = db.execute(
        select(ClauseWeightOverride).where(
            and_(
                ClauseWeightOverride.tenant_id == user.tenant_id,
                ClauseWeightOverride.standard_id == std.id,
                ClauseWeightOverride.clause_id == clause.id,
            )
        )
    ).scalar_one_or_none()

    if existing:
        existing.weight_pct = float(payload.weight_pct)
        existing.rationale = payload.rationale
        existing.is_active = payload.is_active
        db.commit()
        db.refresh(existing)
        return {"updated": True, "id": existing.id}

    row = ClauseWeightOverride(
        tenant_id=user.tenant_id,
        standard_id=std.id,
        clause_id=clause.id,
        weight_pct=float(payload.weight_pct),
        rationale=payload.rationale,
        is_active=payload.is_active,
    )

    db.add(row)
    db.commit()
    db.refresh(row)

    return {"created": True, "id": row.id}
