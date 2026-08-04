from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.base import Base


class MaturityAssessmentSession(Base):
    __tablename__ = "maturity_assessment_sessions"

    id = Column(Integer, primary_key=True)

    standard_id = Column(
        Integer,
        ForeignKey("standards.id"),
        nullable=False,
    )

    name = Column(String, nullable=False)
    status = Column(String, nullable=False, default="draft")

    created_at = Column(DateTime, default=datetime.utcnow)

    # =====================================================
    # ❌ KALDIRILDI
    # -----------------------------------------------------
    # evaluations = relationship(
    #     "MaturityPracticeEvaluation",
    #     back_populates="assessment",
    # )
    # =====================================================

    standard = relationship("Standard")
