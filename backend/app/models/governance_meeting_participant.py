from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class GovernanceMeetingParticipant(Base):
    __tablename__ = "governance_meeting_participants"

    id = Column(Integer, primary_key=True, index=True)

    meeting_id = Column(
        Integer,
        ForeignKey("governance_meetings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    role = Column(
        String(50),
        nullable=False,
        default="ATTENDEE",
        server_default="ATTENDEE",
    )

    attendance_status = Column(
        String(50),
        nullable=False,
        default="INVITED",
        server_default="INVITED",
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    meeting = relationship(
        "GovernanceMeeting",
        back_populates="participants",
    )

    user = relationship(
        "User",
        lazy="joined",
    )
