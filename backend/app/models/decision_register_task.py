from sqlalchemy import (
    Column,
    Integer,
    ForeignKey,
    DateTime,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class DecisionRegisterTask(Base):
    __tablename__ = "decision_register_tasks"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    decision_register_id = Column(
        Integer,
        ForeignKey(
            "decision_registers.id",
            ondelete="CASCADE",
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

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )

    decision_register = relationship(
        "DecisionRegister",
        backref="task_links",
    )

    task = relationship(
        "ComplianceTask",
        backref="decision_register_links",
    )

    __table_args__ = (
        UniqueConstraint(
            "decision_register_id",
            "task_id",
            name="uq_decision_register_task",
        ),
    )
