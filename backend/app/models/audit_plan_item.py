from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.base import Base


class AuditPlanItem(Base):
    __tablename__ = "audit_plan_items"

    id = Column(Integer, primary_key=True, index=True)

    # Multi-tenant
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

    process_id = Column(
        Integer,
        ForeignKey("processes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Forecast linkage
    forecast_id = Column(
        Integer,
        ForeignKey("risk_forecasts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    escalation_probability_30d = Column(Float, nullable=True)
    expected_score_delta = Column(Float, nullable=True)

    priority = Column(String, nullable=False)  # LOW / MEDIUM / HIGH / CRITICAL
    source = Column(String, nullable=False, default="forecast")  # forecast / manual

    status = Column(String, nullable=False, default="planned")  
    # planned | in_progress | completed | cancelled

    snapshot_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # relationships
    risk = relationship("Risk")
    control = relationship("Control")
    process = relationship("Process")

    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "risk_id",
            "forecast_id",
            name="uq_audit_plan_forecast_once"
        ),
    )