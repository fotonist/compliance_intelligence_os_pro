from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class ActionLifecycleHistory(Base):
    __tablename__ = "action_lifecycle_history"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    action_id = Column(
        Integer,
        ForeignKey("actions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    from_status = Column(
        String(40),
        nullable=True,
    )

    to_status = Column(
        String(40),
        nullable=False,
    )

    performed_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    comment = Column(
        Text,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True,
    )

    action = relationship("Action")

    performed_by = relationship(
        "User",
        foreign_keys=[performed_by_user_id],
    )
