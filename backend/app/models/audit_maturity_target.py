from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)

from app.db.base import Base
from app.models.mixins import TenantMixin


class AuditMaturityTarget(Base, TenantMixin):
    __tablename__ = "audit_maturity_targets"

    __table_args__ = (
        UniqueConstraint(
            "audit_plan_id",
            "assessment_process_id",
            "process_attribute_id",
            "standard_indicator_id",
            name="uq_audit_maturity_target_scope",
        ),
    )

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    tenant_id = Column(
        Integer,
        ForeignKey(
            "tenants.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    audit_plan_id = Column(
        Integer,
        ForeignKey(
            "audit_plans.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    pam_assessment_id = Column(
        Integer,
        ForeignKey(
            "pam_assessments.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    assessment_process_id = Column(
        Integer,
        ForeignKey(
            "pam_assessment_processes.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    process_attribute_id = Column(
        Integer,
        ForeignKey(
            "pam_process_attributes.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    standard_indicator_id = Column(
        Integer,
        ForeignKey(
            "standard_indicators.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    status = Column(
        String(32),
        nullable=False,
        default="READY",
    )

    result = Column(
        String(32),
        nullable=True,
    )

    observation = Column(
        Text,
        nullable=True,
    )

    conclusion = Column(
        Text,
        nullable=True,
    )

    auditor_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    started_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    completed_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
