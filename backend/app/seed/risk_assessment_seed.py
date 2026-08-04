from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.risk_assessment import QuestionCategory, RiskAssessmentQuestion


DEFAULT_QUESTIONS = [
    # =========================
    # Likelihood Questions
    # =========================
    (
        "Q_L_01",
        QuestionCategory.likelihood,
        "Has this risk occurred before?",
        3,
    ),
    (
        "Q_L_02",
        QuestionCategory.likelihood,
        "Are there existing controls in place and are they effective?",
        4,
    ),
    (
        "Q_L_03",
        QuestionCategory.likelihood,
        "Is the threat currently active?",
        3,
    ),
    (
        "Q_L_04",
        QuestionCategory.likelihood,
        "Is the process manual, or is there automation in place?",
        2,
    ),
    (
        "Q_L_05",
        QuestionCategory.likelihood,
        "Is there any external dependency involved?",
        2,
    ),

    # =========================
    # Impact Questions
    # =========================
    (
        "Q_I_01",
        QuestionCategory.impact,
        "Would this risk result in financial loss?",
        4,
    ),
    (
        "Q_I_02",
        QuestionCategory.impact,
        "Could this risk lead to legal or regulatory penalties?",
        4,
    ),
    (
        "Q_I_03",
        QuestionCategory.impact,
        "Would this risk cause operational disruption?",
        3,
    ),
    (
        "Q_I_04",
        QuestionCategory.impact,
        "Could this risk lead to reputational damage?",
        3,
    ),
    (
        "Q_I_05",
        QuestionCategory.impact,
        "Would this risk result in a regulatory or compliance violation?",
        5,
    ),
]


def seed_risk_assessment_questions(db: Session) -> int:
    """
    Idempotent seed function for risk assessment checklist questions.

    - If a question with the same code exists, it is updated if necessary.
    - If it does not exist, it is created.
    - Safe to run on every application startup.
    """
    existing = {q.code: q for q in db.query(RiskAssessmentQuestion).all()}
    created = 0

    for code, category, text, weight in DEFAULT_QUESTIONS:
        if code in existing:
            q = existing[code]
            changed = False

            if q.category != category:
                q.category = category
                changed = True
            if q.text != text:
                q.text = text
                changed = True
            if q.weight != weight:
                q.weight = weight
                changed = True

            if changed:
                db.add(q)
            continue

        db.add(
            RiskAssessmentQuestion(
                code=code,
                category=category,
                text=text,
                weight=weight,
            )
        )
        created += 1

    db.commit()
    return created
