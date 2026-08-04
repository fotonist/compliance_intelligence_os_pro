from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

from app.models.mixins import TenantMixin
from sqlalchemy import Column, Boolean

is_deleted = Column(Boolean, nullable=False, default=False)


class Risk(Base, TenantMixin):
    __tablename__ = "risks"

    id = Column(Integer, primary_key=True, index=True)

    # ✅ MULTI-TENANT
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # 🔑 RELATIONS
    control_id = Column(
        Integer,
        ForeignKey("controls.id", ondelete="SET NULL"),
        nullable=True,
    )
    standard_id = Column(
        Integer,
        ForeignKey("standards.id", ondelete="SET NULL"),
        nullable=True,
    )
    requirement_id = Column(
        Integer,
        ForeignKey("requirements.id", ondelete="SET NULL"),
        nullable=True,
    )

    control = relationship("Control", back_populates="risks")

    # ✅ Process ↔ Risk link (many-to-many via ProcessRiskLink)
    process_links = relationship(
        "ProcessRiskLink",
        primaryjoin="Risk.id==ProcessRiskLink.risk_id",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # Core fields
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)

    impact = Column(Integer, nullable=False)
    likelihood = Column(Integer, nullable=False)

    score = Column(Integer, nullable=False)
    risk_level = Column(String, nullable=False)
    appetite_threshold = Column(Integer, nullable=True)
    appetite_status = Column(String(20), nullable=True)
    appetite_deviation = Column(Integer, nullable=True)
    status = Column(String, nullable=False)
    treatment = Column(String, nullable=True)
    action = Column(String, nullable=True)

    # Coverage
    control_coverage_status = Column(String, nullable=True)

    # History
    prev_impact = Column(Integer, nullable=True)
    prev_likelihood = Column(Integer, nullable=True)
    previous_score = Column(Integer, nullable=True)
    prev_risk_level = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    history = relationship(
        "RiskHistory",
        back_populates="risk",
        cascade="all, delete-orphan",
    )
