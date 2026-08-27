from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    ForeignKey,
    DateTime,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class DecisionRegisterHistory(Base):
    __tablename__ = "decision_register_history"

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

    action = Column(
        String(50),
        nullable=False,
        index=True,
    )

    field_name = Column(
        String(100),
        nullable=True,
    )

    old_value = Column(
        Text,
        nullable=True,
    )

    new_value = Column(
        Text,
        nullable=True,
    )

    comment = Column(
        Text,
        nullable=True,
    )

    performed_by = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    decision_register = relationship(
        "DecisionRegister",
        backref="history",
        passive_deletes=True,
    )

    user = relationship(
        "User",
        lazy="joined",
    )
