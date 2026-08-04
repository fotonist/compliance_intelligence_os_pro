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

# EVIDENCE & RISK
from app.models.evidences import Evidence
from app.models.risks import Risk
from app.models.risk_evidence_link import RiskEvidenceLink

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


# =====================================================
# CORE QUERY
# =====================================================
def build_matrix_rows(
    db: Session,
    standard_id: Optional[int],
):
    selected_standard: Optional[Standard] = None

    # ---------------------------------------------
    # Resolve standard
    # ---------------------------------------------
    if standard_id is not None:
        selected_standard = (
            db.query(Standard)
            .filter(Standard.id == standard_id)
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
    # CONTROL MODE (EVIDENCE + RISK)
    # =================================================

    # Risk severity ranking
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

    # Coverage calculation
    coverage_case = case(
        (func.count(Evidence.id) == 0, literal("UNKNOWN")),
        (
            func.sum(
                case(
                    (func.lower(Evidence.status) == "approved", 1),
                    else_=0,
                )
            ) > 0,
            literal("ACHIEVED"),
        ),
        else_=literal("PARTIAL"),
    )

    q = (
        db.query(
            Standard.code.label("standard_code"),
            Clause.code.label("clause_code"),
            Requirement.code.label("requirement_code"),
            Control.code.label("control_code"),

            func.count(Evidence.id).label("evidence_count"),
            func.sum(
                case(
                    (func.lower(Evidence.status) == "approved", 1),
                    else_=0,
                )
            ).label("approved_evidence_count"),

            coverage_case.label("coverage_status"),
            max_risk_level.label("risk_level"),
        )
        .select_from(Control)
        .join(Requirement, Requirement.id == Control.requirement_id)
        .join(Clause, Clause.id == Requirement.clause_id)
        .join(Standard, Standard.id == Clause.standard_id)

        # Control → Evidence (DOĞRU FİLTRELER)
        .outerjoin(
            Evidence,
            (Evidence.control_id == Control.id)
            & (Evidence.is_deleted == False)
            & (
                Evidence.standard_id == selected_standard.id
                if selected_standard
                else literal(True)
            )
        )

        # Evidence → Risk (M2M ORM)
        .outerjoin(
            RiskEvidenceLink,
            RiskEvidenceLink.evidence_id == Evidence.id,
        )
        .outerjoin(
            Risk,
            Risk.id == RiskEvidenceLink.risk_id,
        )
    )

    if selected_standard is not None:
        q = q.filter(Standard.id == selected_standard.id)

    rows = (
        q.group_by(
            Standard.code,
            Clause.code,
            Requirement.code,
            Control.code,
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
    mode, rows = build_matrix_rows(db, standard_id)
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
    mode, rows = build_matrix_rows(db, standard_id)
    return {"mode": mode, "rows": _rows_to_dict(rows)}
