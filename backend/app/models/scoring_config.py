from __future__ import annotations

from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON
from app.db.base import Base


class RiskScoringConfig(Base):
    __tablename__ = "risk_scoring_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)

    name = Column(String(128), nullable=False)
    version = Column(Integer, nullable=False)

    # weights per question code or category
    likelihood_weights = Column(JSON, nullable=False)
    impact_weights = Column(JSON, nullable=False)

    # matrix thresholds
    risk_matrix = Column(JSON, nullable=False)
    # example:
    # {
    #   "critical": {"l": 4, "i": 4},
    #   "high": {"l": 4, "i": 3},
    #   "medium": {"l": 3, "i": 3}
    # }

    effective_from = Column(DateTime, nullable=False, default=datetime.utcnow)
    active = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
