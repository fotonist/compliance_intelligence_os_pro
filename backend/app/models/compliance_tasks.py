from datetime import datetime

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class ComplianceTask(Base):
    __tablename__ = "compliance_tasks"

    id = Column(Integer, primary_key=True, index=True)

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    process_id = Column(
        Integer,
        ForeignKey("processes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    control_id = Column(
        Integer,
        ForeignKey("controls.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    task_type = Column(
        String,
        nullable=True,
        default="COMPLIANCE_ACTION",
        server_default="COMPLIANCE_ACTION",
    )

    title = Column(String, nullable=True)
    description = Column(String, nullable=True)

    priority_score = Column(Integer, nullable=False)

    owner_role = Column(String, nullable=False)

    assignee_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    due_date = Column(DateTime(timezone=True), nullable=False)

    status = Column(
        String,
        nullable=False,
        default="OPEN",
        server_default="OPEN",
    )

    source_type = Column(
        String,
        nullable=False,
        default="manual",
        server_default="manual",
    )

    source_id = Column(Integer, nullable=True)

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

    process = relationship("Process")

    control = relationship(
        "Control",
        back_populates="tasks",
    )

    assignee = relationship(
        "User",
        foreign_keys=[assignee_user_id],
    )

    created_by = relationship(
        "User",
        foreign_keys=[created_by_user_id],
    )

    evidence_links = relationship(
        "TaskEvidenceLink",
        back_populates="task",
        cascade="all, delete-orphan",
    )

    evidence_requirements = relationship(
        "TaskEvidenceRequirement",
        back_populates="task",
        cascade="all, delete-orphan",
    )

    checklist_items = relationship(
        "TaskChecklistItem",
        back_populates="task",
        cascade="all, delete-orphan",
    )
