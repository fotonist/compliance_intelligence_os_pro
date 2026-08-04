from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import List

from app.db.session import get_db
from app.services.risk_appetite_engine import RiskAppetiteEngine

router = APIRouter(prefix="/assessments", tags=["Assessments"])


# =====================================================
# ADIM 1 — START ASSESSMENT
# =====================================================
@router.post("/risks/{risk_id}/start")
def start_assessment(
    risk_id: int,
    db: Session = Depends(get_db),
):
    template = db.execute(
        text("""
            SELECT id
            FROM checklist_template
            WHERE status = 'active'
            ORDER BY version DESC
            LIMIT 1
        """)
    ).fetchone()

    if not template:
        raise HTTPException(
            status_code=400,
            detail="Active checklist template not found"
        )

    session = db.execute(
        text("""
            INSERT INTO risk_assessment_session (
                risk_id,
                template_id
            )
            VALUES (
                :risk_id,
                :template_id
            )
            RETURNING id
        """),
        {
            "risk_id": risk_id,
            "template_id": template.id,
        }
    ).fetchone()

    db.commit()

    return {
        "session_id": session.id,
        "risk_id": risk_id,
        "template_id": template.id,
        "status": "in_progress",
    }


# =====================================================
# ADIM 2 — GET QUESTIONS
# =====================================================
@router.get("/{session_id}/questions")
def get_assessment_questions(
    session_id: int,
    db: Session = Depends(get_db),
):
    session = db.execute(
        text("""
            SELECT template_id
            FROM risk_assessment_session
            WHERE id = :session_id
        """),
        {"session_id": session_id},
    ).fetchone()

    if not session:
        raise HTTPException(
            status_code=404,
            detail="Assessment session not found",
        )

    rows = db.execute(
        text("""
            SELECT
                q.id            AS question_id,
                q.key           AS question_key,
                q.dimension     AS dimension,
                q.text          AS question_text,
                q.order_no      AS order_no,
                r.choice_key    AS choice_key,
                r.label         AS choice_label
            FROM checklist_question q
            LEFT JOIN checklist_choice_rule r
                ON r.question_id = q.id
            WHERE q.template_id = :template_id
            ORDER BY q.dimension, q.order_no
        """),
        {"template_id": session.template_id},
    ).fetchall()

    questions = {}

    for row in rows:
        qid = row.question_id

        if qid not in questions:
            questions[qid] = {
                "id": qid,
                "key": row.question_key,
                "dimension": row.dimension,
                "text": row.question_text,
                "order": row.order_no,
                "choices": [],
            }

        if row.choice_key:
            questions[qid]["choices"].append(
                {
                    "key": row.choice_key,
                    "label": row.choice_label,
                }
            )

    return {
        "session_id": session_id,
        "questions": list(questions.values()),
    }


# =====================================================
# ADIM 3 — SAVE ANSWERS
# =====================================================
class AnswerIn(BaseModel):
    question_id: int
    choice_key: str


class AnswerPayload(BaseModel):
    answers: List[AnswerIn]


@router.post("/{session_id}/answers")
def save_answers(
    session_id: int,
    payload: AnswerPayload,
    db: Session = Depends(get_db),
):
    for ans in payload.answers:
        db.execute(
            text("""
                INSERT INTO risk_assessment_answer (
                    session_id,
                    question_id,
                    choice_key
                )
                VALUES (
                    :session_id,
                    :question_id,
                    :choice_key
                )
                ON CONFLICT (session_id, question_id)
                DO UPDATE SET
                    choice_key = EXCLUDED.choice_key,
                    answered_at = NOW()
            """),
            {
                "session_id": session_id,
                "question_id": ans.question_id,
                "choice_key": ans.choice_key,
            },
        )

    db.commit()

    return {"status": "saved"}


# =====================================================
# ADIM 4 — COMPLETE ASSESSMENT
# =====================================================
@router.post("/{session_id}/complete")
def complete_assessment(
    session_id: int,
    db: Session = Depends(get_db),
):
    db.execute(
        text("""
            WITH raw AS (
                SELECT
                    a.session_id,
                    SUM(
                        CASE
                            WHEN q.dimension = 'likelihood'
                            THEN (
                                r.score_delta
                                * COALESCE(r.multiplier,1)
                                * q.weight
                            )
                            ELSE 0
                        END
                    ) AS likelihood_raw,
                    SUM(
                        CASE
                            WHEN q.dimension = 'impact'
                            THEN (
                                r.score_delta
                                * COALESCE(r.multiplier,1)
                                * q.weight
                            )
                            ELSE 0
                        END
                    ) AS impact_raw
                FROM risk_assessment_answer a
                JOIN checklist_question q
                    ON q.id = a.question_id
                JOIN checklist_choice_rule r
                    ON r.question_id = q.id
                   AND r.choice_key = a.choice_key
                WHERE a.session_id = :session_id
                GROUP BY a.session_id
            ),
            norm AS (
                SELECT
                    session_id,
                    likelihood_raw,
                    impact_raw,
                    GREATEST(
                        1,
                        LEAST(
                            5,
                            CEIL(5.0 * likelihood_raw / 15.0)
                        )
                    )::int AS likelihood_level,
                    GREATEST(
                        1,
                        LEAST(
                            5,
                            CEIL(5.0 * impact_raw / 15.0)
                        )
                    )::int AS impact_level
                FROM raw
            )
            INSERT INTO risk_assessment_result (
                session_id,
                likelihood_raw,
                impact_raw,
                likelihood_level,
                impact_level,
                score,
                risk_rating,
                calculation_version
            )
            SELECT
                session_id,
                likelihood_raw,
                impact_raw,
                likelihood_level,
                impact_level,
                (likelihood_level * impact_level),
                CASE
                    WHEN (likelihood_level * impact_level) <= 5
                        THEN 'low'
                    WHEN (likelihood_level * impact_level) <= 12
                        THEN 'medium'
                    WHEN (likelihood_level * impact_level) <= 20
                        THEN 'high'
                    ELSE 'critical'
                END::risk_rating_level,
                'v1'
            FROM norm
            ON CONFLICT (session_id)
            DO UPDATE SET
                likelihood_raw   = EXCLUDED.likelihood_raw,
                impact_raw       = EXCLUDED.impact_raw,
                likelihood_level = EXCLUDED.likelihood_level,
                impact_level     = EXCLUDED.impact_level,
                score            = EXCLUDED.score,
                risk_rating      = EXCLUDED.risk_rating,
                calculated_at    = NOW();
        """),
        {"session_id": session_id},
    )

    db.execute(
        text("""
            UPDATE risk_assessment_session
            SET
                status = 'completed',
                completed_at = NOW()
            WHERE id = :session_id
        """),
        {"session_id": session_id},
    )

    result = db.execute(
        text("""
            SELECT
                likelihood_level,
                impact_level,
                score,
                risk_rating
            FROM risk_assessment_result
            WHERE session_id = :session_id
        """),
        {"session_id": session_id},
    ).fetchone()

    risk_row = db.execute(
        text("""
            SELECT risk_id
            FROM risk_assessment_session
            WHERE id = :session_id
        """),
        {"session_id": session_id},
    ).fetchone()

    risk_id = risk_row.risk_id

    tenant_row = db.execute(
        text("""
            SELECT tenant_id
            FROM risks
            WHERE id = :risk_id
        """),
        {"risk_id": risk_id},
    ).fetchone()

    tenant_id = tenant_row.tenant_id

    process_row = db.execute(
        text("""
            SELECT process_id
            FROM process_risk_links
            WHERE risk_id = :risk_id
            LIMIT 1
        """),
        {"risk_id": risk_id},
    ).fetchone()

    process_id = (
        process_row.process_id
        if process_row
        else None
    )

    threshold = RiskAppetiteEngine.get_threshold(
        db=db,
        tenant_id=tenant_id,
        process_id=process_id,
    )

    evaluation = RiskAppetiteEngine.evaluate(
        score=result.score,
        threshold=threshold,
    )

    db.execute(
        text("""
            UPDATE risks
            SET
                appetite_threshold = :threshold,
                appetite_status = :status,
                appetite_deviation = :deviation
            WHERE id = :risk_id
        """),
        {
            "risk_id": risk_id,
            "threshold": threshold,
            "status": evaluation["status"],
            "deviation": evaluation["deviation"],
        },
    )

    db.commit()

    return {
        "session_id": session_id,
        "likelihood": result.likelihood_level,
        "impact": result.impact_level,
        "score": result.score,
        "rating": result.risk_rating,
        "appetite_threshold": threshold,
        "appetite_status": evaluation["status"],
        "appetite_deviation": evaluation["deviation"],
    }