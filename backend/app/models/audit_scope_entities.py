from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base


class AuditScopeEntity(Base):
    __tablename__ = "audit_scope_entities"

    id = Column(Integer, primary_key=True, index=True)

    audit_session_id = Column(
        Integer,
        ForeignKey("audit_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Entity type: CLAUSE / REQUIREMENT / CONTROL / PRACTICE
    entity_type = Column(String(32), nullable=False, index=True)

    # Original ID reference
    original_entity_id = Column(Integer, nullable=True, index=True)

    # Snapshot metadata
    entity_code = Column(String(64), nullable=True)
    entity_title = Column(String(512), nullable=True)
    entity_description = Column(Text, nullable=True)

    clause_code = Column(String(64), nullable=True)
    requirement_code = Column(String(64), nullable=True)
    control_code = Column(String(64), nullable=True)

    applicability_dimensions = Column(JSONB, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # ---------------------------------------------------------
    # RELATIONSHIPS
    # ---------------------------------------------------------

    audit_session = relationship(
        "AuditSession",
        back_populates="scope_entities",
    )

    evidence_snapshots = relationship(
        "AuditEvidenceSnapshot",
        back_populates="audit_scope_entity",
        cascade="all, delete-orphan",
    )

    risk_snapshots = relationship(
        "AuditRiskSnapshot",
        back_populates="audit_scope_entity",
        cascade="all, delete-orphan",
    )

    findings = relationship(
        "AuditFinding",
        back_populates="audit_scope_entity",
        cascade="all, delete-orphan",
    )
