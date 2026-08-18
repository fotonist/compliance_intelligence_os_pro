from typing import Optional, Any, Dict, List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import literal, func, case
import logging

from app.core.database import get_db
from app.core.security import get_current_user

# CONTROL MODELS
from app.models.standards import Standard
from app.models.clauses import Clause
from app.models.requirements import Requirement
from app.models.controls import Control

# MATRIX MODELS
from app.models.matrix_instance import MatrixInstance
from app.models.matrix_row import MatrixRow

# EVIDENCE & RISK
from app.models.evidences import Evidence
from app.models.risks import Risk

# MATURITY MODELS
from app.models.standard_process_area import StandardProcessArea
from app.models.standard_practice import StandardPractice

logger = logging.getLogger("matrix.debug")

router = APIRouter(prefix="/matrix", tags=["Matrix"])


# =====================================================
# HELPERS
# =====================================================
def _rows_to_dict(rows) -> List[Dict[str, Any]]:
    return [dict(r._mapping) for r in rows]


def _normalize(value: Optional[str]) -> str:
    return (value or "").strip().upper()


def _tenant_id(user: Any) -> int:
    """Return the authenticated tenant id or fail closed."""
    tenant_id = getattr(user, "tenant_id", None)
    if tenant_id is None and isinstance(user, dict):
        tenant_id = user.get("tenant_id")

    if tenant_id is None:
        raise ValueError("Authenticated user has no tenant context")

    return int(tenant_id)


def _latest_control_matrix_instance_ids(
    db: Session,
    tenant_id: int,
    standard_id: Optional[int],
) -> List[int]:
    """Resolve the latest tenant-owned control matrix instance per standard."""
    query = (
        db.query(MatrixInstance)
        .join(Standard, Standard.id == MatrixInstance.standard_id)
        .filter(
            MatrixInstance.tenant_id == tenant_id,
            Standard.type != "MATURITY_BASED",
        )
        .order_by(MatrixInstance.standard_id.asc(), MatrixInstance.id.desc())
    )

    if standard_id is not None:
        query = query.filter(MatrixInstance.standard_id == standard_id)

    instances = query.all()

    latest_by_standard: Dict[int, int] = {}
    for instance in instances:
        latest_by_standard.setdefault(
            int(instance.standard_id),
            int(instance.id),
        )

    return list(latest_by_standard.values())


# =====================================================
# CORE QUERY
# =====================================================
def build_matrix_rows(
    db: Session,
    standard_id: Optional[int],
    tenant_id: int,
):
    selected_standard: Optional[Standard] = None

    # ---------------------------------------------
    # Resolve standard inside tenant-owned matrix scope
    # ---------------------------------------------
    if standard_id is not None:
        instance = (
            db.query(MatrixInstance)
            .join(Standard, Standard.id == MatrixInstance.standard_id)
            .filter(
                MatrixInstance.tenant_id == tenant_id,
                MatrixInstance.standard_id == standard_id,
            )
            .order_by(MatrixInstance.id.desc())
            .first()
        )

        if not instance:
            return "control", []

        selected_standard = (
            db.query(Standard)
            .filter(Standard.id == instance.standard_id)
            .first()
        )

        if not selected_standard:
            return "control", []

    std_type = (
        _normalize(getattr(selected_standard, "type", None))
        if selected_standard
        else None
    )

    # =================================================
    # MATURITY MODE
    # =================================================
    if selected_standard and std_type == "MATURITY_BASED":
        rows = (
            db.query(
                Standard.code.label("standard_code"),

                StandardProcessArea.code.label("process_area_code"),
                StandardProcessArea.name.label("process_area_title"),

                StandardPractice.code.label("practice_code"),
                StandardPractice.title.label("practice_title"),
                StandardPractice.text.label("practice_description"),

                StandardPractice.level.label("target_level"),
                literal(0).label("achieved_level"),
                literal(0).label("evidence_count"),
            )
            .select_from(StandardPractice)
            .join(
                StandardProcessArea,
                StandardProcessArea.id == StandardPractice.process_area_id,
            )
            .join(Standard, Standard.id == StandardPractice.standard_id)
            .filter(Standard.id == selected_standard.id)
            .order_by(
                StandardProcessArea.code,
                StandardPractice.code,
            )
            .all()
        )

        return "maturity", rows

    # =================================================
    # CONTROL MODE — CANONICAL MATRIX INSTANCE
    # =================================================
    # The matrix is driven by matrix_rows, not by controls directly.
    # This is what preserves clause-only rows (23 rows for clauses 4–10)
    # together with the 93 Annex A control rows: 116 rows in total.
    instance_ids = _latest_control_matrix_instance_ids(
        db=db,
        tenant_id=tenant_id,
        standard_id=standard_id,
    )

    if not instance_ids:
        return "control", []

    # Risk severity ranking. Risk is linked directly to the control in the
    # current schema; risk_evidence_link is deliberately not used here.
    risk_rank = case(
        (func.lower(Risk.risk_level) == "critical", 4),
        (func.lower(Risk.risk_level) == "high", 3),
        (func.lower(Risk.risk_level) == "medium", 2),
        (func.lower(Risk.risk_level) == "low", 1),
        else_=0,
    )

    max_risk_level = case(
        (func.max(risk_rank) == 4, literal("CRITICAL")),
        (func.max(risk_rank) == 3, literal("HIGH")),
        (func.max(risk_rank) == 2, literal("MEDIUM")),
        (func.max(risk_rank) == 1, literal("LOW")),
        else_=literal(None),
    )

    approved_evidence_count = func.count(
        func.distinct(
            case(
                (func.lower(Evidence.status) == "approved", Evidence.id),
                else_=None,
            )
        )
    )

    evidence_count = func.count(func.distinct(Evidence.id))

    coverage_case = case(
        (evidence_count == 0, literal("NOT_COVERED")),
        (approved_evidence_count > 0, literal("ACHIEVED")),
        else_=literal("PARTIAL"),
    )

    q = (
        db.query(
            MatrixRow.id.label("id"),
            MatrixRow.standard_id.label("standard_id"),
            MatrixRow.instance_id.label("matrix_instance_id"),
            MatrixRow.clause_id.label("clause_id"),
            MatrixRow.requirement_id.label("requirement_id"),
            MatrixRow.control_id.label("control_id"),
            MatrixRow.row_key.label("row_key"),

            Standard.code.label("standard_code"),

            Clause.code.label("clause_code"),
            Clause.title.label("clause_title"),
            Clause.description.label("clause_description"),

            Requirement.code.label("requirement_code"),
            Requirement.title.label("requirement_title"),
            Requirement.description.label("requirement_description"),

            Control.code.label("control_code"),
            Control.title.label("control_title"),
            Control.description.label("control_description"),

            evidence_count.label("evidence_count"),
            approved_evidence_count.label("approved_evidence_count"),
            coverage_case.label("coverage_status"),
            max_risk_level.label("risk_level"),
        )
        .select_from(MatrixRow)
        .join(
            MatrixInstance,
            (MatrixInstance.id == MatrixRow.instance_id)
            & (MatrixInstance.tenant_id == tenant_id),
        )
        .join(Standard, Standard.id == MatrixRow.standard_id)
        .outerjoin(Clause, Clause.id == MatrixRow.clause_id)
        .outerjoin(Requirement, Requirement.id == MatrixRow.requirement_id)
        .outerjoin(Control, Control.id == MatrixRow.control_id)
        .outerjoin(
            Evidence,
            (Evidence.control_id == MatrixRow.control_id)
            & (Evidence.tenant_id == tenant_id)
            & (Evidence.is_deleted == False)
            & (
                Evidence.standard_version_id == MatrixInstance.standard_version_id
            ),
        )
        .outerjoin(
            Risk,
            (Risk.control_id == MatrixRow.control_id)
            & (Risk.tenant_id == tenant_id),
        )
        .filter(
            MatrixRow.tenant_id == tenant_id,
            MatrixRow.instance_id.in_(instance_ids),
        )
    )

    if selected_standard is not None:
        q = q.filter(MatrixRow.standard_id == selected_standard.id)

    rows = (
        q.group_by(
            MatrixRow.id,
            MatrixRow.standard_id,
            MatrixRow.instance_id,
            MatrixRow.clause_id,
            MatrixRow.requirement_id,
            MatrixRow.control_id,
            MatrixRow.row_key,
            Standard.code,
            Clause.code,
            Clause.title,
            Clause.description,
            Requirement.code,
            Requirement.title,
            Requirement.description,
            Control.code,
            Control.title,
            Control.description,
        )
        .order_by(
            Standard.code.asc(),
            Clause.code.asc(),
            Requirement.code.asc().nullslast(),
            Control.code.asc().nullslast(),
            MatrixRow.id.asc(),
        )
        .all()
    )

    return "control", rows


# =====================================================
# PREVIEW
# =====================================================
@router.get("/preview")
def preview_matrix(
    standard_id: int = Query(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    logger.info("=== MATRIX PREVIEW HIT ===")
    tenant_id = _tenant_id(user)
    mode, rows = build_matrix_rows(db, standard_id, tenant_id)
    return {"mode": mode, "rows": _rows_to_dict(rows)}


# =====================================================
# MATRIX ROOT
# =====================================================
@router.get("/")
def get_matrix(
    standard_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    logger.info("=== MATRIX ROOT HIT ===")
    tenant_id = _tenant_id(user)
    mode, rows = build_matrix_rows(db, standard_id, tenant_id)
    return {"mode": mode, "rows": _rows_to_dict(rows)}
