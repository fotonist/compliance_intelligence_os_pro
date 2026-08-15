from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from app.db.base import Base
from app.models.mixins import TenantMixin


class AuditExecutionRecord(Base, TenantMixin):
    __tablename__ = "audit_execution_records"

    id = Column(Integer, primary_key=True, index=True)

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    audit_plan_id = Column(
        Integer,
        ForeignKey("audit_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    process_id = Column(
        Integer,
        ForeignKey("processes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    control_id = Column(
        Integer,
        ForeignKey("controls.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    auditor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    status = Column(String(32), nullable=False, default="READY", index=True)
    result = Column(String(32), nullable=True)
    observation = Column(Text, nullable=True)
    conclusion = Column(Text, nullable=True)

    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
