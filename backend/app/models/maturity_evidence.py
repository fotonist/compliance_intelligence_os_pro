from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base import Base


class MaturityEvidence(Base):
    __tablename__ = "maturity_evidences"

    id = Column(Integer, primary_key=True, index=True)

    session_id = Column(
        Integer,
        ForeignKey("maturity_assessment_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )

    evaluation_id = Column(
        Integer,
        ForeignKey("maturity_practice_evaluations.id", ondelete="CASCADE"),
        nullable=False,
    )

    practice_id = Column(
        Integer,
        ForeignKey("standard_practices.id", ondelete="CASCADE"),
        nullable=False,
    )

    # 🔴 DB NOT NULL → DEFAULT + SERVER_DEFAULT
    evidence_type = Column(
        String,
        nullable=False,
        default="maturity",
        server_default="maturity",
    )

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    status = Column(
        String,
        nullable=False,
        default="draft",
        server_default="draft",
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    evaluation = relationship("MaturityPracticeEvaluation")
