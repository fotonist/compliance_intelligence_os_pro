from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base import Base


class ComplianceObligation(Base):
    __tablename__ = "compliance_obligations"

    id = Column(Integer, primary_key=True, index=True)

    # ---------------------------------------------------------
    # TENANT
    # ---------------------------------------------------------
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ---------------------------------------------------------
    # IDENTIFICATION
    # ---------------------------------------------------------
    code = Column(
        String(100),
        nullable=False,
        index=True,
    )

    title = Column(
        String(500),
        nullable=False,
    )

    description = Column(
        Text,
        nullable=True,
    )

    # ---------------------------------------------------------
    # SOURCE / LEGAL CONTEXT
    # ---------------------------------------------------------
    source_authority = Column(
        String(255),
        nullable=True,
    )

    regulation_name = Column(
        String(500),
        nullable=True,
    )

    jurisdiction = Column(
        String(255),
        nullable=True,
    )

    reference_url = Column(
        String(1000),
        nullable=True,
    )

    # ---------------------------------------------------------
    # LIFECYCLE
    # ---------------------------------------------------------
    effective_date = Column(
        Date,
        nullable=True,
    )

    expiry_date = Column(
        Date,
        nullable=True,
    )

    review_date = Column(
        Date,
        nullable=True,
        index=True,
    )

    status = Column(
        String(32),
        nullable=False,
        default="active",
        index=True,
    )

    criticality = Column(
        String(32),
        nullable=False,
        default="medium",
        index=True,
    )

    # ---------------------------------------------------------
    # OWNERSHIP
    # ---------------------------------------------------------
    owner_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # ---------------------------------------------------------
    # APPLICABILITY
    # ---------------------------------------------------------
    applicability_status = Column(
        String(32),
        nullable=False,
        default="under_review",
        index=True,
    )

    applicability_reason = Column(
        Text,
        nullable=True,
    )

    # ---------------------------------------------------------
    # AUDIT / TIMESTAMPS
    # ---------------------------------------------------------
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ---------------------------------------------------------
    # RELATIONSHIPS
    # ---------------------------------------------------------
    tenant = relationship("Tenant")

    owner = relationship(
        "User",
        foreign_keys=[owner_user_id],
    )
