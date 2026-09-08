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


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    recipient_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    category = Column(
        String(50),
        nullable=False,
        index=True,
    )

    severity = Column(
        String(20),
        nullable=False,
        default="INFO",
        index=True,
    )

    title = Column(
        String(255),
        nullable=False,
    )

    message = Column(
        Text,
        nullable=False,
    )

    entity_type = Column(
        String(50),
        nullable=True,
        index=True,
    )

    entity_id = Column(
        Integer,
        nullable=True,
        index=True,
    )

    action_url = Column(
        String(500),
        nullable=True,
    )

    is_read = Column(
        Boolean,
        nullable=False,
        default=False,
        index=True,
    )

    read_at = Column(
        DateTime,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        index=True,
    )

    recipient = relationship(
        "User",
        foreign_keys=[recipient_user_id],
    )

    tenant = relationship(
        "Tenant",
    )

    deliveries = relationship(
        "NotificationDelivery",
        back_populates="notification",
        cascade="all, delete-orphan",
    )


class NotificationDelivery(Base):
    __tablename__ = "notification_deliveries"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    notification_id = Column(
        Integer,
        ForeignKey(
            "notifications.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    channel = Column(
        String(20),
        nullable=False,
    )

    status = Column(
        String(20),
        nullable=False,
        default="PENDING",
        index=True,
    )

    provider = Column(
        String(50),
        nullable=True,
    )

    provider_message_id = Column(
        String(255),
        nullable=True,
    )

    attempt_count = Column(
        Integer,
        nullable=False,
        default=0,
    )

    last_attempt_at = Column(
        DateTime,
        nullable=True,
    )

    delivered_at = Column(
        DateTime,
        nullable=True,
    )

    failed_at = Column(
        DateTime,
        nullable=True,
    )

    error_message = Column(
        Text,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )

    notification = relationship(
        "Notification",
        back_populates="deliveries",
    )
class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    category = Column(
        String(50),
        nullable=False,
        index=True,
    )

    channel = Column(
        String(20),
        nullable=False,
    )

    enabled = Column(
        Boolean,
        nullable=False,
        default=True,
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
    )

    user = relationship(
        "User",
    )
