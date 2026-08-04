from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base


class Task(Base):
    __tablename__ = "compliance_tasks"

    id = Column(Integer, primary_key=True)

    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)

    process_id = Column(Integer, ForeignKey("processes.id"), nullable=False)
    control_id = Column(Integer, ForeignKey("controls.id"), nullable=False)

    # 🔥 BU ALAN DB'DE VAR
    priority_score = Column(Integer, nullable=False)

    owner_role = Column(String, nullable=False)

    status = Column(String, nullable=False, default="open")

    source_type = Column(String, nullable=False)
    source_id = Column(Integer, nullable=True)

    title = Column(String, nullable=False)
    description = Column(String, nullable=True)

    due_date = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)