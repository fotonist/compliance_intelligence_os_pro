from app.models.risk_assessment import AnswerValue
from app.services.scoring_data import scoring_data


ANSWER_SCORE = {
    AnswerValue.yes: 1.0,
    AnswerValue.partial: 0.5,
    AnswerValue.no: 0.0,
    AnswerValue.na: None,  # ignored
}


def calculate_likelihood_and_impact(rows):
    """
    rows: List of tuples -> (RiskAssessmentAnswer, RiskAssessmentQuestion)
    """
    likelihood_total = 0.0
    likelihood_weight = 0
    impact_total = 0.0
    impact_weight = 0

    for answer, question in rows:
        score = ANSWER_SCORE.get(answer.answer)
        if score is None:
            continue

        weighted = score * question.weight

        if question.category == "likelihood":
            likelihood_total += weighted
            likelihood_weight += question.weight
        else:
            impact_total += weighted
            impact_weight += question.weight

    likelihood = round(1 + (likelihood_total / likelihood_weight) * 4) if likelihood_weight else 1
    impact = round(1 + (impact_total / impact_weight) * 4) if impact_weight else 1

    return int(likelihood), int(impact)


def resolve_risk_level(likelihood: int, impact: int) -> str:
    total_score = likelihood * impact

    for level, r in scoring_data["thresholds"].items():
        if r["min"] <= total_score <= r["max"]:
            return level

    return "Unknown"
