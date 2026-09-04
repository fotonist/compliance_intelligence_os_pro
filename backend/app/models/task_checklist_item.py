from datetime import datetime

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship

from app.db.base import Base


class TaskChecklistItem(Base):
    __tablename__ = "task_checklist_items"

    id = Column(Integer, primary_key=True, index=True)

    task_id = Column(
        Integer,
        ForeignKey(
            "compliance_tasks.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    label = Column(String, nullable=False)

    required = Column(
        Boolean,
        nullable=False,
        default=True,
    )

    completed = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    task = relationship(
        "ComplianceTask",
        back_populates="checklist_items",
    )
