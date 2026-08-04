from sqlalchemy import (
    Column,
    Integer,
    DateTime,
    ForeignKey,
    func,
)
from sqlalchemy.orm import relationship

from app.db.base import Base


class ProcessRiskAppetite(Base):
    __tablename__ = "process_risk_appetite"

    id = Column(Integer, primary_key=True)

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id"),
        nullable=False,
    )

    process_id = Column(
        Integer,
        ForeignKey("processes.id"),
        nullable=False,
        unique=True,
    )

    profile_id = Column(
        Integer,
        ForeignKey("risk_appetite_profiles.id"),
        nullable=False,
    )

    threshold_override = Column(Integer)

    created_at = Column(
        DateTime,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )

    profile = relationship(
        "RiskAppetiteProfile",
        back_populates="process_overrides",
    )

    process = relationship("Process")