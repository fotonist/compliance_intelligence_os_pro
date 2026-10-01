from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.sql import func

from app.db.base import Base


class AuditMaturityTargetRevision(Base):
    __tablename__ = "audit_maturity_target_revisions"

    __table_args__ = (
        UniqueConstraint(
            "audit_maturity_target_id",
            "revision_no",
            name="uq_audit_maturity_target_revision_no",
        ),
    )

    id = Column(
        Integer,
        primary_key=True,
    )

    audit_maturity_target_id = Column(
        Integer,
        ForeignKey(
            "audit_maturity_targets.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    revision_no = Column(
        Integer,
        nullable=False,
    )

    tenant_id = Column(
        Integer,
        nullable=False,
        index=True,
    )

    pam_assessment_id = Column(
        Integer,
        nullable=False,
    )

    assessment_process_id = Column(
        Integer,
        nullable=False,
    )

    process_attribute_id = Column(
        Integer,
        nullable=False,
    )

    standard_indicator_id = Column(
        Integer,
        nullable=True,
    )

    auditor_id = Column(
        Integer,
        nullable=True,
    )

    pa_evaluation_id = Column(
        Integer,
        ForeignKey(
            "pam_process_attribute_evaluations.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    rating = Column(
        String,
        nullable=False,
    )

    rating_justification = Column(
        Text,
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

    result = Column(
        String(32),
        nullable=True,
    )

    started_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )

    completed_at = Column(
        DateTime(timezone=True),
        nullable=False,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
