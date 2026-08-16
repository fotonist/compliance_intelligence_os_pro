from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from app.db.base import Base
from app.models.mixins import TenantMixin


class AuditFindingWorkflowEvent(Base, TenantMixin):
    __tablename__ = "audit_finding_workflow_events"

    id = Column(Integer, primary_key=True, index=True)

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    finding_id = Column(
        Integer,
        ForeignKey("audit_finding_records.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    actor_role = Column(String(100), nullable=True)
    action = Column(String(64), nullable=False)
    from_status = Column(String(40), nullable=True)
    to_status = Column(String(40), nullable=True)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
