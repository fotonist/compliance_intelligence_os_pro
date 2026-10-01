from __future__ import annotations

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.sql import func

from app.db.base import Base


class AuditMaturityFollowUpWorkflowEvent(Base):
    __tablename__ = "audit_maturity_follow_up_workflow_events"

    id = Column(Integer, primary_key=True, index=True)

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    follow_up_action_id = Column(
        Integer,
        ForeignKey(
            "audit_maturity_follow_up_actions.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    actor_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    actor_role = Column(
        String(64),
        nullable=True,
    )

    action = Column(
        String(64),
        nullable=False,
    )

    from_status = Column(
        String(32),
        nullable=True,
    )

    to_status = Column(
        String(32),
        nullable=True,
    )

    comment = Column(
        Text,
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )

    __table_args__ = (
        Index(
            "ix_audit_maturity_follow_up_event_action_time",
            "follow_up_action_id",
            "created_at",
        ),
    )
