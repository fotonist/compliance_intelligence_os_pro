from datetime import datetime
from sqlalchemy import Column, Integer, Numeric, String, DateTime
from app.db.base import Base


class RiskAssessmentResult(Base):
    __tablename__ = "risk_assessment_result"

    id = Column(Integer, primary_key=True, index=True)

    session_id = Column(Integer, nullable=False, index=True)

    # RAW values (NOT NULL in DB)
    likelihood_raw = Column(Numeric, nullable=False)
    impact_raw = Column(Numeric, nullable=False)

    # Calculated levels (NOT NULL in DB)
    likelihood_level = Column(Integer, nullable=False)
    impact_level = Column(Integer, nullable=False)

    # Final discrete values (optional but used by UI)
    likelihood = Column(Integer)
    impact = Column(Integer)

    # Final score
    score = Column(Numeric, nullable=False)

    # Ratings / levels (NOT NULL in DB)
    risk_rating = Column(String(50), nullable=False)
    risk_level = Column(String(50), nullable=False)

    calculation_version = Column(String(50), nullable=True)

    calculated_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
