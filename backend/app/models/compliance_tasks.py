from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class ComplianceTask(Base):
    __tablename__ = "compliance_tasks"

    id = Column(Integer, primary_key=True, index=True)

    # Multi-tenant
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="RESTRICT"),
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
        ForeignKey("controls.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Intelligence fields
    priority_score = Column(Integer, nullable=False)

    owner_role = Column(String, nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=False)

    status = Column(String, nullable=False, default="open")

    # 🔥 ENTERPRISE SOURCE TRACKING (SAFE)
    source_type = Column(
        String,
        nullable=False,
        default="manual",          # ORM default
        server_default="manual",   # DB default
    )

    source_id = Column(Integer, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    title = Column(String, nullable=True)
    description = Column(String, nullable=True)

    process = relationship("Process")
    control = relationship(
    "Control",
    back_populates="tasks",
)