from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Action(Base):
    __tablename__ = "actions"

    id = Column(Integer, primary_key=True, index=True)

    requirement_id = Column(
        Integer,
        ForeignKey("requirements.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    risk_id = Column(
        Integer,
        ForeignKey("risks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # The production database already uses actions.user_id.
    # Keep the domain-level Python name owner_id without forcing a destructive
    # database rename. This preserves existing data and keeps the API contract
    # as owner_id.
    owner_id = Column(
        "user_id",
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="OPEN", server_default="OPEN")
    priority = Column(String(50), nullable=False, default="MEDIUM", server_default="MEDIUM")
    due_date = Column(Date, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    user = relationship(
        "User",
        foreign_keys=[owner_id],
        back_populates="actions",
    )
    requirement = relationship("Requirement")
    risk = relationship("Risk")
