from datetime import datetime
from sqlalchemy.orm import Session

from app.services.risk_evaluator import evaluate
from app.domain.risk_enums import QuestionCategory
from app.models.risk_assessment_result import RiskAssessmentResult
from app.services.scoring_config_service import (
    get_active_scoring_config,
    resolve_risk_level,
)


def create_assessment_result(
    *,
    db: Session,
    session_id,
    answers: list,
):
    # answers: list[EvalAnswer]

    likelihood, impact, score = evaluate(answers)

    cfg = get_active_scoring_config(db)
    risk_level = resolve_risk_level(score, cfg["thresholds"])

    result = RiskAssessmentResult(
        session_id=session_id,
        likelihood=likelihood,
        impact=impact,
        score=score,
        risk_level=risk_level,
        calculation_version="v2",
        created_at=datetime.utcnow(),
    )

    db.add(result)
    db.commit()
    db.refresh(result)

    return result
