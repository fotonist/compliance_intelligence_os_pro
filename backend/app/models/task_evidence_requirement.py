from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    Boolean,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class TaskEvidenceRequirement(Base):
    __tablename__ = "task_evidence_requirements"

    __table_args__ = (
        UniqueConstraint(
            "task_id",
            "name",
            name="uq_task_evidence_requirement_name",
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
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    task_id = Column(
        Integer,
        ForeignKey(
            "compliance_tasks.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    name = Column(
        String,
        nullable=False,
    )

    description = Column(
        String,
        nullable=True,
    )

    evidence_type = Column(
        String,
        nullable=True,
    )

    required = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )

    status = Column(
        String,
        nullable=False,
        default="OPEN",
        server_default="OPEN",
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

    task = relationship(
        "ComplianceTask",
        back_populates="evidence_requirements",
    )
