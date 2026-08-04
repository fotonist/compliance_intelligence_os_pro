from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class ClauseWeightOverride(Base):
    __tablename__ = "clause_weight_overrides"

    id = Column(Integer, primary_key=True, index=True)

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    standard_id = Column(
        Integer,
        ForeignKey("standards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    clause_id = Column(
        Integer,
        ForeignKey("clauses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # weight in percentage (0-100)
    weight_pct = Column(Float, nullable=False)

    rationale = Column(String, nullable=True)

    is_active = Column(Boolean, nullable=False, server_default="true")

    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    standard = relationship("Standard")
    clause = relationship("Clause")
    tenant = relationship("Tenant")