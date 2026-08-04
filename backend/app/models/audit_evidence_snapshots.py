from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base


class AuditEvidenceSnapshot(Base):
    __tablename__ = "audit_evidence_snapshots"

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

    evidence_file_id = Column(
        Integer,
        ForeignKey("evidence_files.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Snapshot metadata
    file_name = Column(String(512), nullable=True)
    file_path = Column(String(1024), nullable=True)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(255), nullable=True)
    status = Column(String(32), nullable=True)

    uploaded_by = Column(Integer, nullable=True)
    uploaded_at = Column(DateTime(timezone=True), nullable=True)

    approved_by = Column(Integer, nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    snapshot_taken_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    audit_session = relationship(
        "AuditSession",
        back_populates="evidence_snapshots",
    )

    audit_scope_entity = relationship(
        "AuditScopeEntity",
        back_populates="evidence_snapshots",
    )
