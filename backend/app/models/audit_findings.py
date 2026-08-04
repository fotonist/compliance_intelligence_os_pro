from sqlalchemy import Column, Integer, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base


class AuditFinding(Base):
    __tablename__ = "audit_findings"

    id = Column(Integer, primary_key=True, index=True)

    audit_session_id = Column(
        Integer,
        ForeignKey("audit_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    audit_scope_entity_id = Column(
        Integer,
        ForeignKey("audit_scope_entities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Hybrid scoring outputs
    gap_level = Column(Integer, nullable=False, default=0)
    coverage_score = Column(Integer, nullable=True)
    risk_weight = Column(Integer, nullable=True)
    priority_score = Column(Integer, nullable=True)

    calculated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    audit_session = relationship(
        "AuditSession",
        back_populates="findings",
    )

    audit_scope_entity = relationship(
        "AuditScopeEntity",
        back_populates="findings",
    )
