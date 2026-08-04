from sqlalchemy.orm import Session
from sqlalchemy import func

# CONTROL
from app.models.risks import Risk
from app.models.controls import Control
from app.models.requirements import Requirement
from app.models.clauses import Clause
from app.models.standards import Standard

# MATURITY
from app.models.standard_process_area import StandardProcessArea
from app.models.standard_practice import StandardPractice
from app.models.maturity_practice_evaluation import MaturityPracticeEvaluation
from app.models.practice_evidence_link import PracticeEvidenceLink


def build_matrix_response(db: Session, standard_id: int):
    standard = db.query(Standard).filter(Standard.id == standard_id).first()
    if not standard:
        return {"mode": "control", "rows": []}

    standard_type = getattr(standard, "type", None)
    standard_framework = getattr(standard, "framework", None)
    is_maturity_based = (standard_type == "MATURITY_BASED") or (
        standard_framework == "MATURITY_BASED"
    )

    if is_maturity_based:
        return _build_maturity_matrix(db=db, standard=standard)

    return _build_control_matrix(db=db, standard=standard)


def _build_maturity_matrix(db: Session, standard: Standard):
    rows = (
        db.query(
            # standard
            Standard.id.label("standard_id"),
            Standard.code.label("standard_code"),
            Standard.title.label("standard_title"),

            # process area
            StandardProcessArea.id.label("process_area_id"),
            StandardProcessArea.code.label("process_area_code"),
            StandardProcessArea.name.label("process_area_name"),

            # practice
            StandardPractice.id.label("practice_id"),
            StandardPractice.code.label("practice_code"),
            StandardPractice.title.label("practice_title"),
            StandardPractice.text.label("description"),
            StandardPractice.level.label("level"),

            # capability
            func.coalesce(
                func.max(MaturityPracticeEvaluation.capability_level),
                0
            ).label("capability_level"),

            # evidence
            func.count(PracticeEvidenceLink.id).label("evidence_count"),
        )
        .select_from(StandardProcessArea)
        .join(
            StandardPractice,
            StandardPractice.process_area_id == StandardProcessArea.id,
        )
        .join(
            Standard,
            Standard.id == StandardProcessArea.standard_id,
        )
        .outerjoin(
            MaturityPracticeEvaluation,
            MaturityPracticeEvaluation.practice_id == StandardPractice.id,
        )
        .outerjoin(
            PracticeEvidenceLink,
            PracticeEvidenceLink.practice_id == StandardPractice.id,
        )
        .filter(StandardProcessArea.standard_id == standard.id)
        .filter(StandardPractice.is_active == True)  # noqa
        .group_by(
            Standard.id,
            Standard.code,
            Standard.title,
            StandardProcessArea.id,
            StandardProcessArea.code,
            StandardProcessArea.name,
            StandardPractice.id,
            StandardPractice.code,
            StandardPractice.title,
            StandardPractice.text,
            StandardPractice.level,
        )
        .order_by(
            StandardProcessArea.sort_order,
            StandardPractice.sort_order,
        )
        .all()
    )

    return {
        "mode": "maturity",
        "rows": [dict(r._mapping) for r in rows],
    }


def _build_control_matrix(db: Session, standard: Standard):
    rows = (
        db.query(
            Standard.id.label("standard_id"),
            Standard.code.label("standard_code"),
            Standard.title.label("standard_title"),

            Clause.id.label("clause_id"),
            Clause.code.label("clause_code"),
            Clause.title.label("clause_title"),

            Requirement.id.label("requirement_id"),
            Requirement.code.label("requirement_code"),
            Requirement.title.label("requirement_title"),

            Control.id.label("control_id"),
            Control.code.label("control_code"),
            Control.title.label("control_title"),

            Risk.id.label("risk_id"),
            Risk.risk_level.label("risk_level"),
            Risk.status.label("risk_status"),
        )
        .select_from(Control)
        .join(Requirement, Requirement.id == Control.requirement_id)
        .join(Clause, Clause.id == Requirement.clause_id)
        .join(Standard, Standard.id == Clause.standard_id)
        .outerjoin(Risk, Risk.control_id == Control.id)
        .filter(Standard.id == standard.id)
        .order_by(
            Clause.id,
            Requirement.id,
            Control.id,
        )
        .all()
    )

    return {
        "mode": "control",
        "rows": [dict(r._mapping) for r in rows],
    }
