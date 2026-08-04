from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class RiskForecastSnapshot(Base):
    __tablename__ = "risk_forecast_snapshots"

    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), index=True, nullable=False)
    risk_id = Column(Integer, ForeignKey("risks.id", ondelete="CASCADE"), nullable=False)

    snapshot_time = Column(DateTime, default=datetime.utcnow, index=True)

    features = Column(JSON, nullable=False)
    label_escalated_30d = Column(Integer, nullable=True)

    risk = relationship("Risk")