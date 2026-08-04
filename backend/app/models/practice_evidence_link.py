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


class PracticeEvidenceLink(Base):
    __tablename__ = "practice_evidence_links"

    id = Column(Integer, primary_key=True)

    practice_evaluation_id = Column(
        Integer,
        ForeignKey("maturity_practice_evaluations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    evidence_id = Column(
        Integer,
        ForeignKey("evidences.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    status = Column(String, default="draft")
    review_note = Column(Text, nullable=True)

    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, server_default=func.now())

    # ---------------- RELATIONS ----------------

    practice_evaluation = relationship(
        "MaturityPracticeEvaluation",
        back_populates="evidence_links",
    )

    evidence = relationship("Evidence")
