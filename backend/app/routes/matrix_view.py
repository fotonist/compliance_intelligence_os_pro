from typing import Optional, Any, Dict, List

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case, literal

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.matrix_row import MatrixRow
from app.models.matrix_instance import MatrixInstance
from app.models.standards import Standard
from app.models.clauses import Clause
from app.models.requirements import Requirement
from app.models.controls import Control
from app.models.evidences import Evidence
from app.models.risks import Risk

router = APIRouter(prefix="/matrix", tags=["Matrix"])


def _rows_to_dict(rows) -> List[Dict[str, Any]]:
    return [dict(r._mapping) for r in rows]


@router.get("/")
def get_matrix_view(
    standard_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id missing")

    evidence_agg = (
        db.query(
            Evidence.standard_id.label("standard_id"),
            Evidence.control_id.label("control_id"),
            func.count(Evidence.id).label("evidence_count"),
            func.coalesce(
                func.sum(
                    case(
                        (func.lower(Evidence.status) == "approved", 1),
                        else_=0,
                    )
                ),
                0,
            ).label("approved_evidence_count"),
        )
        .filter(
            Evidence.tenant_id == tenant_id,
            Evidence.is_deleted.is_(False),
            Evidence.control_id.isnot(None),
        )
        .group_by(Evidence.standard_id, Evidence.control_id)
        .subquery()
    )

    risk_rank = case(
        (func.upper(Risk.risk_level) == "CRITICAL", 4),
        (func.upper(Risk.risk_level) == "HIGH", 3),
        (func.upper(Risk.risk_level) == "MEDIUM", 2),
        (func.upper(Risk.risk_level) == "LOW", 1),
        else_=0,
    )

    risk_agg = (
        db.query(
            Risk.standard_id.label("standard_id"),
            Risk.control_id.label("control_id"),
            func.max(risk_rank).label("risk_rank"),
        )
        .filter(
            Risk.tenant_id == tenant_id,
            Risk.standard_id.isnot(None),
            Risk.control_id.isnot(None),
        )
        .group_by(Risk.standard_id, Risk.control_id)
        .subquery()
    )

    evidence_count_expr = func.coalesce(evidence_agg.c.evidence_count, 0)
    approved_evidence_count_expr = func.coalesce(
        evidence_agg.c.approved_evidence_count, 0
    )

    coverage_status = case(
        (approved_evidence_count_expr > 0, literal("ACHIEVED")),
        else_=literal("NOT_COVERED"),
    ).label("coverage_status")

    risk_level = case(
        (risk_agg.c.risk_rank == 4, literal("CRITICAL")),
        (risk_agg.c.risk_rank == 3, literal("HIGH")),
        (risk_agg.c.risk_rank == 2, literal("MEDIUM")),
        (risk_agg.c.risk_rank == 1, literal("LOW")),
        else_=literal(None),
    ).label("risk_level")

    query = (
        db.query(
            MatrixRow.id.label("id"),
            MatrixRow.instance_id.label("matrix_instance_id"),
            Standard.id.label("standard_id"),
            Standard.code.label("standard_code"),
            Standard.title.label("standard_title"),
            Clause.id.label("clause_id"),
            Clause.code.label("clause_code"),
            Clause.title.label("clause_title"),
            Clause.description.label("clause_description"),
            Requirement.id.label("requirement_id"),
            Requirement.code.label("requirement_code"),
            Requirement.title.label("requirement_title"),
            Requirement.description.label("requirement_description"),
            Control.id.label("control_id"),
            Control.code.label("control_code"),
            Control.title.label("control_title"),
            Control.description.label("control_description"),
            evidence_count_expr.label("evidence_count"),
            approved_evidence_count_expr.label("approved_evidence_count"),
            coverage_status,
            risk_level,
        )
        .select_from(MatrixRow)
        .join(MatrixInstance, MatrixRow.instance_id == MatrixInstance.id)
        .join(Standard, MatrixRow.standard_id == Standard.id)
        .outerjoin(Clause, MatrixRow.clause_id == Clause.id)
        .outerjoin(Requirement, MatrixRow.requirement_id == Requirement.id)
        .outerjoin(Control, MatrixRow.control_id == Control.id)
        .outerjoin(
            evidence_agg,
            (evidence_agg.c.standard_id == MatrixRow.standard_id)
            & (evidence_agg.c.control_id == MatrixRow.control_id),
        )
        .outerjoin(
            risk_agg,
            (risk_agg.c.standard_id == MatrixRow.standard_id)
            & (risk_agg.c.control_id == MatrixRow.control_id),
        )
        .filter(
            MatrixRow.tenant_id == tenant_id,
            MatrixInstance.tenant_id == tenant_id,
            MatrixRow.control_id.isnot(None),
        )
    )

    if standard_id is not None:
        query = query.filter(
            MatrixRow.standard_id == standard_id,
            MatrixInstance.standard_id == standard_id,
        )
    else:
        latest_instance_id = (
            db.query(func.max(MatrixInstance.id))
            .filter(
                MatrixInstance.tenant_id == tenant_id,
                MatrixInstance.standard_id == MatrixRow.standard_id,
            )
            .correlate(MatrixRow)
            .scalar_subquery()
        )
        query = query.filter(MatrixInstance.id == latest_instance_id)

    rows = query.order_by(
        Standard.code,
        Clause.code,
        Requirement.code,
        Control.code,
        MatrixRow.id,
    ).all()

    return {
        "mode": "control",
        "rows": _rows_to_dict(rows),
    }
