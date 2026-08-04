from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class AssessmentStatus(str, enum.Enum):
    draft = "draft"
    completed = "completed"
    cancelled = "cancelled"


class QuestionCategory(str, enum.Enum):
    likelihood = "likelihood"
    impact = "impact"


class AnswerValue(str, enum.Enum):
    yes = "yes"
    no = "no"
    partial = "partial"
    na = "na"


class RiskAssessmentSession(Base):
    __tablename__ = "risk_assessment_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Sizin security.py'de user.id int'e cast ediliyor → burada Integer olmalı.
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    status = Column(
        Enum(AssessmentStatus, name="assessment_status"),
        nullable=False,
        default=AssessmentStatus.draft,
    )

    started_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    calculated_likelihood = Column(Integer, nullable=True)  # 1..5
    calculated_impact = Column(Integer, nullable=True)      # 1..5
    calculated_risk_level = Column(String(32), nullable=True)

    answers = relationship(
        "RiskAssessmentAnswer",
        back_populates="session",
        cascade="all, delete-orphan",
    )


class RiskAssessmentQuestion(Base):
    __tablename__ = "risk_assessment_questions"

    id = Column(Integer, primary_key=True, autoincrement=True)

    code = Column(String(32), nullable=False, unique=True)
    category = Column(
        Enum(QuestionCategory, name="assessment_question_category"),
        nullable=False,
    )

    text = Column(Text, nullable=False)
    weight = Column(Integer, nullable=False, default=1)

    answers = relationship("RiskAssessmentAnswer", back_populates="question")


class RiskAssessmentAnswer(Base):
    __tablename__ = "risk_assessment_answers"
    __table_args__ = (
        UniqueConstraint("session_id", "question_id", name="uq_assessment_answer_session_question"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)

    session_id = Column(UUID(as_uuid=True), ForeignKey("risk_assessment_sessions.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("risk_assessment_questions.id"), nullable=False)

    answer = Column(Enum(AnswerValue, name="assessment_answer_value"), nullable=False)

    # normalize skor: yes=1, partial=0.5, no=0, na=None
    score = Column(Float, nullable=True)

    session = relationship("RiskAssessmentSession", back_populates="answers")
    question = relationship("RiskAssessmentQuestion", back_populates="answers")
