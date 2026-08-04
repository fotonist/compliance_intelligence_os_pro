from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base


class TaskExternalLink(Base):
    __tablename__ = "task_external_links"

    id = Column(Integer, primary_key=True)

    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    task_id = Column(Integer, ForeignKey("compliance_tasks.id", ondelete="CASCADE"), nullable=False)

    provider = Column(String(30), nullable=False)
    external_key = Column(String(200), nullable=False)

    sync_status = Column(String(30), nullable=False, default="synced")
    last_synced_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())