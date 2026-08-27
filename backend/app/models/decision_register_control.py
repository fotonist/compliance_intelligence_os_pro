from sqlalchemy import (
    Column,
    Integer,
    ForeignKey,
    DateTime,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class DecisionRegisterControl(Base):
    __tablename__ = "decision_register_controls"

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

    control_id = Column(
        Integer,
        ForeignKey(
            "controls.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False,
    )

    decision_register = relationship(
        "DecisionRegister",
        backref="control_links",
    )

    control = relationship(
        "Control",
        backref="decision_register_links",
    )

    __table_args__ = (
        UniqueConstraint(
            "decision_register_id",
            "control_id",
            name="uq_decision_register_control",
        ),
    )
