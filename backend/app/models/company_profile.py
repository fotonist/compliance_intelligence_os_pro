from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from app.db.base import Base


class CompanyProfile(Base):
    __tablename__ = "company_profiles"

    id = Column(Integer, primary_key=True)

    # ==========================================================
    # TENANT ISOLATION
    # ==========================================================

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ==========================================================
    # BASIC INFORMATION
    # ==========================================================

    legal_name = Column(
        String(255),
        nullable=False,
    )

    # Canonical company / trade name.
    # Frontend "company_name" is mapped to this field.
    trade_name = Column(
        String(255),
        nullable=True,
    )

    tax_id = Column(
        String(100),
        nullable=True,
    )

    registration_no = Column(
        String(100),
        nullable=True,
    )

    industry = Column(
        String(255),
        nullable=True,
    )

    employee_count = Column(
        Integer,
        nullable=True,
    )

    headquarters_address = Column(
        Text,
        nullable=True,
    )

    website = Column(
        String(255),
        nullable=True,
    )

    # ==========================================================
    # CONTEXT OF THE ORGANIZATION
    # ISO 9001 / ISO 27001
    # ==========================================================

    internal_issues = Column(
        Text,
        nullable=True,
    )

    external_issues = Column(
        Text,
        nullable=True,
    )

    strategic_objectives = Column(
        Text,
        nullable=True,
    )

    # ==========================================================
    # MANAGEMENT COMMITMENT
    # ==========================================================

    policy_summary = Column(
        Text,
        nullable=True,
    )

    leadership_representative = Column(
        String(255),
        nullable=True,
    )

    compliance_officer = Column(
        String(255),
        nullable=True,
    )

    # ==========================================================
    # SYSTEM SCOPE
    # ==========================================================

    scope_description = Column(
        Text,
        nullable=True,
    )

    included_locations = Column(
        JSONB,
        nullable=False,
        default=list,
        server_default="[]",
    )

    excluded_activities = Column(
        Text,
        nullable=True,
    )

    # ==========================================================
    # LIFECYCLE / PUBLICATION STATUS
    # ==========================================================

    status = Column(
        String(50),
        nullable=False,
        default="draft",
        server_default="draft",
    )

    # ==========================================================
    # AUDIT TIMESTAMPS
    # ==========================================================

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