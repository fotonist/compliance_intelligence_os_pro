from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class GovernanceMeetingHistory(Base):
    __tablename__ = "governance_meeting_history"

    id = Column(Integer, primary_key=True, index=True)

    meeting_id = Column(
        Integer,
        ForeignKey("governance_meetings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    action = Column(String(100), nullable=False)

    field_name = Column(String(100), nullable=True)

    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)

    comment = Column(String(5000), nullable=True)

    performed_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    meeting = relationship(
        "GovernanceMeeting",
        back_populates="history",
    )

    user = relationship(
        "User",
        foreign_keys=[performed_by],
        lazy="joined",
    )
