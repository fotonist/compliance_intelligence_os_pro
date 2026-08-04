from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    func,
)
from sqlalchemy.orm import relationship

from app.db.base import Base


class RiskAppetiteProfile(Base):
    __tablename__ = "risk_appetite_profiles"

    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)

    name = Column(String(100), nullable=False)
    description = Column(String(500))
    is_default = Column(Boolean, default=False, nullable=False)

    default_threshold = Column(Integer, default=16, nullable=False)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now()
    )

    process_overrides = relationship(
        "ProcessRiskAppetite",
        back_populates="profile",
        cascade="all, delete-orphan",
    )