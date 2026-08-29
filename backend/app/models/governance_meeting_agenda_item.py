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


class GovernanceMeetingAgendaItem(Base):
    __tablename__ = "governance_meeting_agenda_items"

    id = Column(Integer, primary_key=True, index=True)

    meeting_id = Column(
        Integer,
        ForeignKey("governance_meetings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    item_order = Column(Integer, nullable=False)

    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)

    presenter_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    status = Column(
        String(50),
        nullable=False,
        default="PENDING",
        server_default="PENDING",
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    meeting = relationship(
        "GovernanceMeeting",
        back_populates="agenda_items",
    )

    presenter = relationship(
        "User",
        foreign_keys=[presenter_id],
        lazy="joined",
    )
