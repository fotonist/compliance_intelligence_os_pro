from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class GovernanceMeetingAction(Base):
    __tablename__ = "governance_meeting_actions"

    id = Column(Integer, primary_key=True, index=True)

    meeting_id = Column(
        Integer,
        ForeignKey("governance_meetings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    action_id = Column(
        Integer,
        ForeignKey("actions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    meeting = relationship(
        "GovernanceMeeting",
        back_populates="action_links",
    )

    action = relationship(
        "Action",
        lazy="joined",
    )
