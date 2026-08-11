from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    Boolean,
)
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.base import Base
from app.models.mixins import TenantMixin


class Evidence(Base, TenantMixin):

    __tablename__ = "evidences"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    # =========================================================
    # MULTI-TENANT
    # =========================================================

    tenant_id = Column(
        Integer,
        ForeignKey(
            "tenants.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    # =========================================================
    # SOFT DELETE
    # =========================================================

    is_deleted = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    # =========================================================
    # VERSION CONTEXT
    # =========================================================

    standard_version_id = Column(
        Integer,
        ForeignKey(
            "standard_versions.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # =========================================================
    # FOREIGN KEYS
    # =========================================================

    control_id = Column(
        Integer,
        ForeignKey("controls.id"),
        nullable=True,
    )

    requirement_id = Column(
        Integer,
        ForeignKey("requirements.id"),
        nullable=True,
    )

    # =========================================================
    # STANDARD ROOT CONTEXT
    # =========================================================

    standard_id = Column(
        Integer,
        ForeignKey("standards.id"),
        nullable=False,
        index=True,
    )

    # =========================================================
    # CORE FIELDS
    # =========================================================

    title = Column(
        String,
        nullable=False,
    )

    description = Column(
        String,
        nullable=True,
    )

    regulation = Column(
        String(50),
        nullable=True,
    )

    source_url = Column(
        String,
        nullable=True,
    )

    # =========================================================
    # ASSESSMENT TYPE
    # =========================================================

    assessment_type = Column(
        String(20),
        nullable=False,
        default="control",
        index=True,
    )

    # =========================================================
    # EVIDENCE WORKFLOW STATUS
    #
    # IMPORTANT:
    # The production DB does NOT contain approval_status.
    #
    # Evidence approval is derived from the latest
    # EvidenceFile.status.
    #
    # EvidenceFile.status:
    #   uploaded
    #   waiting_approval
    #   approved
    #   rejected
    #
    # Evidence-level status remains the existing DB field.
    # =========================================================

    status = Column(
        String(20),
        nullable=False,
        default="Uploaded",
    )

    # =========================================================
    # RELATIONSHIPS
    # =========================================================

    control = relationship(
        "Control",
        back_populates="evidences",
        lazy="joined",
    )

    requirement = relationship(
        "Requirement",
        back_populates="evidences",
        lazy="joined",
    )

    standard = relationship(
        "Standard",
        lazy="joined",
    )

    standard_version = relationship(
        "StandardVersion",
        lazy="joined",
    )

    # =========================================================
    # REVIEW / APPROVAL INFORMATION
    #
    # Approval state is represented through EvidenceFile.status.
    # Reviewer metadata remains stored at Evidence level.
    # =========================================================

    reviewed_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    reviewed_at = Column(
        DateTime,
        nullable=True,
    )

    # =========================================================
    # METADATA
    # =========================================================

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    # =========================================================
    # EVIDENCE FILES
    # =========================================================

    files = relationship(
        "EvidenceFile",
        back_populates="evidence",
        cascade="all, delete-orphan",
    )
