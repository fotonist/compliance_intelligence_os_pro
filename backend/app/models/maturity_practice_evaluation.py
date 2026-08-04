from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    func,
)
from sqlalchemy.orm import relationship

from app.db.base import Base


class MaturityPracticeEvaluation(Base):
    __tablename__ = "maturity_practice_evaluations"

    id = Column(Integer, primary_key=True, index=True)

    session_id = Column(
        Integer,
        ForeignKey("maturity_workspace_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    practice_id = Column(
        Integer,
        ForeignKey("standard_practices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    result = Column(String, nullable=True)
    comment = Column(Text, nullable=True)

    evaluated_at = Column(DateTime, server_default=func.now())
    evaluator_user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    # ✅ TEK VE NET İLİŞKİ
    practice = relationship(
        "StandardPractice",
        back_populates="maturity_evaluations",
    )

    evidence_links = relationship(
        "PracticeEvidenceLink",
        back_populates="practice_evaluation",
        cascade="all, delete-orphan",
    )
