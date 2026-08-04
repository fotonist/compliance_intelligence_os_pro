from uuid import uuid4
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.risk_assessment import (
    RiskAssessmentQuestion,
    RiskAssessmentSession,
    RiskAssessmentAnswer,
)
from app.schemas.risk_assessment import (
    AssessmentQuestionOut,
    AssessmentAnswerIn,
    RiskAssessmentSessionOut,
)

router = APIRouter(
    prefix="/risk-assessments",
    tags=["Risk Assessment"]
)

# ------------------------------------------------------------------
# QUESTIONS
# ------------------------------------------------------------------
@router.get(
    "/questions",
    response_model=list[AssessmentQuestionOut]
)
def list_risk_assessment_questions(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return (
        db.query(RiskAssessmentQuestion)
        .order_by(
            RiskAssessmentQuestion.category,
            RiskAssessmentQuestion.code
        )
        .all()
    )


# ------------------------------------------------------------------
# CREATE SESSION  ✅ FIXED (user_id SET)
# ------------------------------------------------------------------
@router.post(
    "/sessions",
    response_model=RiskAssessmentSessionOut,
    status_code=201,
)
def create_risk_assessment_session(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    session = RiskAssessmentSession(
        id=uuid4(),
        user_id=user.id,              # 🔴 KRİTİK SATIR (FIX)
        status="draft",
        started_at=datetime.utcnow(),
    )

    db.add(session)
    db.commit()
    db.refresh(session)

    return session


# ------------------------------------------------------------------
# SAVE ANSWERS
# ------------------------------------------------------------------
@router.post(
    "/sessions/{session_id}/answers",
    status_code=200,
)
def save_answers(
    session_id: str,
    answers: list[AssessmentAnswerIn],
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    session = (
        db.query(RiskAssessmentSession)
        .filter(RiskAssessmentSession.id == session_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # delete old answers (idempotent)
    db.query(RiskAssessmentAnswer).filter(
        RiskAssessmentAnswer.session_id == session_id
    ).delete()

    for ans in answers:
        db.add(
            RiskAssessmentAnswer(
                session_id=session_id,
                question_id=ans.question_id,
                answer=ans.answer,
            )
        )

    db.commit()
    return {"status": "ok"}


# ------------------------------------------------------------------
# EVALUATE
# ------------------------------------------------------------------
@router.post(
    "/sessions/{session_id}/evaluate",
    status_code=200,
)
def evaluate_session(
    session_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    session = (
        db.query(RiskAssessmentSession)
        .filter(RiskAssessmentSession.id == session_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # 🔥 burada evaluator servisinin bağlanacağı yer
    # session.calculated_likelihood = ...
    # session.calculated_impact = ...
    # session.calculated_risk_level = ...

    db.commit()
    return {"status": "evaluated"}


# ------------------------------------------------------------------
# COMPLETE
# ------------------------------------------------------------------
@router.post(
    "/sessions/{session_id}/complete",
    status_code=200,
)
def complete_session(
    session_id: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    session = (
        db.query(RiskAssessmentSession)
        .filter(RiskAssessmentSession.id == session_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.status = "completed"
    session.completed_at = datetime.utcnow()
    db.commit()

    return {"status": "completed"}
