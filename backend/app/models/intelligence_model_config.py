from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    Float,
    Text,
)

from app.db.base import Base


class IntelligenceModelConfig(Base):
    __tablename__ = "intelligence_model_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)

    tenant_id = Column(Integer, nullable=False, index=True)

    model_name = Column(
        String(128),
        nullable=False,
        default="UEE",
    )

    version = Column(Integer, nullable=False)

    status = Column(
        String(32),
        nullable=False,
        default="DRAFT",
    )

    risk_weight = Column(Float, nullable=False, default=0.35)
    coverage_weight = Column(Float, nullable=False, default=0.25)
    maturity_weight = Column(Float, nullable=False, default=0.15)
    evidence_weight = Column(Float, nullable=False, default=0.10)
    task_pressure_weight = Column(Float, nullable=False, default=0.15)

    # Control Health model weights
    control_health_coverage_weight = Column(
        Float,
        nullable=False,
        default=0.30,
    )

    control_health_evidence_weight = Column(
        Float,
        nullable=False,
        default=0.20,
    )

    control_health_risk_weight = Column(
        Float,
        nullable=False,
        default=0.20,
    )

    control_health_gap_weight = Column(
        Float,
        nullable=False,
        default=0.20,
    )

    control_health_remediation_weight = Column(
        Float,
        nullable=False,
        default=0.10,
    )

    effective_from = Column(
        DateTime,
        nullable=True,
    )

    change_reason = Column(
        Text,
        nullable=True,
    )

    created_by = Column(
        Integer,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    active = Column(
        Boolean,
        nullable=False,
        default=False,
    )
