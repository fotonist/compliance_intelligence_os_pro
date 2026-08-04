from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

from app.models.mixins import TenantMixin

class Evidence(Base, TenantMixin):

    __tablename__ = "evidences"

    id = Column(Integer, primary_key=True, index=True)

    # ✅ MULTI-TENANT
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Soft Delete
    is_deleted = Column(Boolean, nullable=False, default=False)

    # 🔒 VERSION CONTEXT (kritik)
    standard_version_id = Column(
        Integer,
        ForeignKey("standard_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Foreign keys
    control_id = Column(Integer, ForeignKey("controls.id"), nullable=True)
    requirement_id = Column(Integer, ForeignKey("requirements.id"), nullable=True)

    # STANDARD (root context)
    standard_id = Column(
        Integer,
        ForeignKey("standards.id"),
        nullable=False,
        index=True,
    )

    # Core fields
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    regulation = Column(String(50), nullable=True)
    source_url = Column(String, nullable=True)

    # Assessment type (control / maturity)
    assessment_type = Column(
        String(20),
        nullable=False,
        default="control",
        index=True,
    )

       # Evidence workflow status
    status = Column(
        String(20),
        nullable=False,
        default="Uploaded",
    )

    # Evidence approval workflow
    approval_status = Column(
        String(30),
        nullable=False,
        default="PENDING_REVIEW",
        index=True,

    )

    # -----------------
    # RELATIONSHIPS
    # -----------------
    control = relationship("Control", back_populates="evidences", lazy="joined")
    requirement = relationship("Requirement", back_populates="evidences", lazy="joined")

    standard = relationship("Standard", lazy="joined")
    standard_version = relationship("StandardVersion", lazy="joined")

    # Review / Approval info
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Evidence files
    files = relationship(
        "EvidenceFile",
        back_populates="evidence",
        cascade="all, delete-orphan",
    )

   
