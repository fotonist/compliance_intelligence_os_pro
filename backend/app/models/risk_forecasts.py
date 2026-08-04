from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class RiskForecast(Base):
    __tablename__ = "risk_forecasts"

    id = Column(Integer, primary_key=True)

    tenant_id = Column(Integer, ForeignKey("tenants.id"), index=True, nullable=False)
    risk_id = Column(Integer, ForeignKey("risks.id", ondelete="CASCADE"), nullable=False)

    model_version = Column(String, nullable=False)

    escalation_probability_30d = Column(Float, nullable=False)
    expected_score_delta = Column(Float, nullable=False)

    explanation = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    risk = relationship("Risk")