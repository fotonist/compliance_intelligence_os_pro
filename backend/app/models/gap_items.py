from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.base import Base


class GapItem(Base):
    __tablename__ = "gap_items"

    id = Column(Integer, primary_key=True, index=True)

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    risk_id = Column(
        Integer,
        ForeignKey("risks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    control_id = Column(
        Integer,
        ForeignKey("controls.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    forecast_id = Column(
        Integer,
        ForeignKey("risk_forecasts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    gap_type = Column(String, nullable=False)  
    # predictive | actual

    severity_score = Column(Float, nullable=True)

    status = Column(String, nullable=False, default="open")
    # open | in_progress | resolved | accepted

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    risk = relationship("Risk")
    control = relationship("Control")

    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "risk_id",
            "forecast_id",
            name="uq_gap_forecast_once"
        ),
    )