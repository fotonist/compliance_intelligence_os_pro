from dataclasses import dataclass
from typing import List
from sqlalchemy.orm import Session

from app.domain.risk_enums import AnswerValue, QuestionCategory
from app.models.risk_assessment import RiskAssessmentAnswer


@dataclass
class EvalAnswer:
    category: QuestionCategory
    weight: int
    value: AnswerValue


def evaluate(items: List[EvalAnswer]) -> tuple[int, int, int]:
    likelihood_score = 0
    impact_score = 0

    for item in items:
        if item.category == QuestionCategory.likelihood:
            likelihood_score += item.weight * item.value.score
        elif item.category == QuestionCategory.impact:
            impact_score += item.weight * item.value.score

    # normalize (1–5 arası)
    likelihood_level = max(1, min(5, round(likelihood_score / 3)))
    impact_level = max(1, min(5, round(impact_score / 3)))

    score = likelihood_level * impact_level
    return likelihood_level, impact_level, score


# ✅ BU FONKSİYON EKSİKTİ
def evaluate_answers_for_session(db: Session, session_id: int):
    answers = (
        db.query(RiskAssessmentAnswer)
        .filter(RiskAssessmentAnswer.session_id == session_id)
        .all()
    )

    if not answers:
        return None

    items: List[EvalAnswer] = []

    for a in answers:
        items.append(
            EvalAnswer(
                category=a.question.category,
                weight=a.question.weight,
                value=a.answer_value,
            )
        )

    likelihood, impact, score = evaluate(items)

    class Result:
        pass

    result = Result()
    result.likelihood = likelihood
    result.impact = impact
    result.score = score

    return result
