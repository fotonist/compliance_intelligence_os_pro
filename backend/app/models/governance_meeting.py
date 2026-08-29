from sqlalchemy import (
    Boolean,
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


class GovernanceMeeting(Base):
    __tablename__ = "governance_meetings"

    id = Column(Integer, primary_key=True, index=True)

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    meeting_code = Column(String(100), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    meeting_type = Column(String(100), nullable=False, index=True)

    status = Column(
        String(50),
        nullable=False,
        default="SCHEDULED",
        server_default="SCHEDULED",
        index=True,
    )

    scheduled_at = Column(DateTime, nullable=False, index=True)
    duration_minutes = Column(Integer, nullable=True)
    location = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)

    chairperson_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    updated_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    is_deleted = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        index=True,
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

    tenant = relationship(
        "Tenant",
        lazy="joined",
    )

    chairperson = relationship(
        "User",
        foreign_keys=[chairperson_id],
        lazy="joined",
    )

    creator = relationship(
        "User",
        foreign_keys=[created_by],
        lazy="joined",
    )

    updater = relationship(
        "User",
        foreign_keys=[updated_by],
        lazy="joined",
    )

    participants = relationship(
        "GovernanceMeetingParticipant",
        back_populates="meeting",
        cascade="all, delete-orphan",
    )

    agenda_items = relationship(
        "GovernanceMeetingAgendaItem",
        back_populates="meeting",
        cascade="all, delete-orphan",
        order_by="GovernanceMeetingAgendaItem.item_order",
    )

    decision_links = relationship(
        "GovernanceMeetingDecision",
        back_populates="meeting",
        cascade="all, delete-orphan",
    )

    action_links = relationship(
        "GovernanceMeetingAction",
        back_populates="meeting",
        cascade="all, delete-orphan",
    )

    history = relationship(
        "GovernanceMeetingHistory",
        back_populates="meeting",
        cascade="all, delete-orphan",
        order_by="GovernanceMeetingHistory.created_at.desc()",
    )
