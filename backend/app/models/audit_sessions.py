from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.models.mixins import TenantMixin

class AuditSession(Base, TenantMixin):
    __tablename__ = "audit_sessions"

    id = Column(Integer, primary_key=True, index=True)

    # Multi-tenant
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Standard context
    standard_id = Column(
        Integer,
        ForeignKey("standards.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    standard_version_id = Column(
        Integer,
        ForeignKey("standard_versions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Lifecycle
    status = Column(
        String(16),
        nullable=False,
        default="ACTIVE",  # ACTIVE / OUTDATED / CLOSED
        index=True,
    )

    type = Column(String(32), nullable=True)  # internal / external / pre-audit
    target_maturity_level = Column(Integer, nullable=True)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    closed_at = Column(DateTime(timezone=True), nullable=True)

    # ---------------------------------------------------------
    # RELATIONSHIPS
    # ---------------------------------------------------------

    scope_entities = relationship(
        "AuditScopeEntity",
        back_populates="audit_session",
        cascade="all, delete-orphan",
    )

    evidence_snapshots = relationship(
        "AuditEvidenceSnapshot",
        back_populates="audit_session",
        cascade="all, delete-orphan",
    )

    risk_snapshots = relationship(
        "AuditRiskSnapshot",
        back_populates="audit_session",
        cascade="all, delete-orphan",
    )

    findings = relationship(
        "AuditFinding",
        back_populates="audit_session",
        cascade="all, delete-orphan",
    )
