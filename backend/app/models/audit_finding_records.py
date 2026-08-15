from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from app.db.base import Base
from app.models.mixins import TenantMixin


class AuditFindingRecord(Base, TenantMixin):
    __tablename__ = "audit_finding_records"

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
    execution_id = Column(
        Integer,
        ForeignKey("audit_execution_records.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    process_id = Column(Integer, ForeignKey("processes.id", ondelete="SET NULL"), nullable=True, index=True)
    control_id = Column(Integer, ForeignKey("controls.id", ondelete="RESTRICT"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    requirement = Column(String(255), nullable=True)
    objective_evidence = Column(Text, nullable=True)
    severity = Column(String(32), nullable=False, default="MEDIUM", index=True)
    status = Column(String(32), nullable=False, default="OPEN", index=True)
    owner = Column(String(255), nullable=True)
    due_date = Column(Date, nullable=True)
    root_cause = Column(Text, nullable=True)
    recommendation = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
