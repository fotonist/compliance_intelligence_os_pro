from __future__ import annotations

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class AuditMaturityFollowUpAction(Base):
    __tablename__ = "audit_maturity_follow_up_actions"

    id = Column(Integer, primary_key=True, index=True)

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    finding_id = Column(
        Integer,
        ForeignKey("audit_maturity_findings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    action_code = Column(
        String(50),
        nullable=False,
    )

    title = Column(
        String(255),
        nullable=False,
    )

    description = Column(
        Text,
        nullable=True,
    )

    assigned_owner_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    verifier_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    priority = Column(
        String(32),
        nullable=False,
        default="MEDIUM",
        server_default="MEDIUM",
    )

    due_date = Column(
        Date,
        nullable=True,
    )

    status = Column(
        String(32),
        nullable=False,
        default="OPEN",
        server_default="OPEN",
        index=True,
    )

    started_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    submitted_for_verification_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    verified_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    completed_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    completion_note = Column(
        Text,
        nullable=True,
    )

    verification_comment = Column(
        Text,
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    finding = relationship(
        "AuditMaturityFinding",
        foreign_keys=[finding_id],
    )

    assigned_owner = relationship(
        "User",
        foreign_keys=[assigned_owner_id],
    )

    creator = relationship(
        "User",
        foreign_keys=[created_by],
    )

    verifier = relationship(
        "User",
        foreign_keys=[verifier_id],
    )

    evidence_links = relationship(
        "AuditMaturityFollowUpEvidenceLink",
        back_populates="follow_up_action",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index(
            "ix_audit_maturity_follow_up_finding_status",
            "finding_id",
            "status",
        ),
        Index(
            "ix_audit_maturity_follow_up_owner_status",
            "assigned_owner_id",
            "status",
        ),
    )


class AuditMaturityFollowUpEvidenceLink(Base):
    __tablename__ = "audit_maturity_follow_up_evidence_links"

    id = Column(Integer, primary_key=True, index=True)

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    follow_up_action_id = Column(
        Integer,
        ForeignKey(
            "audit_maturity_follow_up_actions.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    evidence_id = Column(
        Integer,
        ForeignKey("evidences.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    linked_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    note = Column(
        Text,
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    follow_up_action = relationship(
        "AuditMaturityFollowUpAction",
        back_populates="evidence_links",
    )

    evidence = relationship(
        "Evidence",
        foreign_keys=[evidence_id],
    )

    linker = relationship(
        "User",
        foreign_keys=[linked_by],
    )

    __table_args__ = (
        Index(
            "uq_audit_maturity_follow_up_evidence",
            "follow_up_action_id",
            "evidence_id",
            unique=True,
        ),
    )
