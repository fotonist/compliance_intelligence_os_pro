from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base


class AuditRiskSnapshot(Base):
    __tablename__ = "audit_risk_snapshots"

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

    risk_version_id = Column(
        Integer,
        ForeignKey("risk_versions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    impact = Column(Integer, nullable=True)
    likelihood = Column(Integer, nullable=True)
    score = Column(Integer, nullable=True)
    risk_level = Column(String(64), nullable=True)
    status = Column(String(64), nullable=True)

    snapshot_taken_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    audit_session = relationship(
        "AuditSession",
        back_populates="risk_snapshots",
    )

    audit_scope_entity = relationship(
        "AuditScopeEntity",
        back_populates="risk_snapshots",
    )
