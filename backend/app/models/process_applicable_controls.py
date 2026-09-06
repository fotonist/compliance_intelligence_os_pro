from sqlalchemy import Column, DateTime, ForeignKey, Integer
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.db.base import Base


class ProcessApplicableControl(Base):
    __tablename__ = "process_applicable_controls"

    id = Column(Integer, primary_key=True, index=True)

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    process_id = Column(
        Integer,
        ForeignKey("processes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    control_id = Column(
        Integer,
        ForeignKey("controls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    created_by_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    process = relationship("Process")
    control = relationship("Control")
    created_by = relationship("User", foreign_keys=[created_by_user_id])
