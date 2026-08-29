from sqlalchemy import Column, Integer, Float, DateTime, String, ForeignKey
from sqlalchemy.sql import func

from app.db.base import Base


class BenchmarkSnapshot(Base):
    __tablename__ = "benchmark_snapshots"

    id = Column(Integer, primary_key=True, index=True)

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Measurement / period
    snapshot_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    period_start = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    period_end = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Canonical UEE metrics
    uee_score = Column(Float, nullable=False)

    compliance_health_index = Column(
        Float,
        nullable=False,
    )

    # UEE component indices
    risk_index = Column(Float, nullable=False)
    coverage_index = Column(Float, nullable=False)
    maturity_index = Column(Float, nullable=False)
    evidence_index = Column(Float, nullable=False)
    task_pressure_index = Column(Float, nullable=False)

    # Source population
    risk_count = Column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    control_count = Column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    evidence_count = Column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    # Data quality
    data_quality_score = Column(
        Float,
        nullable=True,
    )

    # Traceability
    source = Column(
        String(64),
        nullable=False,
        default="UEE",
        server_default="UEE",
    )

    engine_version = Column(
        String(64),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
