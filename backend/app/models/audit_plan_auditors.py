from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.models.mixins import TenantMixin


class AuditPlanAuditor(Base, TenantMixin):
    __tablename__ = "audit_plan_auditors"

    id = Column(Integer, primary_key=True, index=True)

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    audit_plan_id = Column(
        Integer,
        ForeignKey("audit_plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    assignment_role = Column(
        String(32),
        nullable=False,
        default="AUDITOR",
        index=True,
    )

    assigned_scope = Column(Text, nullable=True)

    assigned_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "audit_plan_id",
            "user_id",
            name="uq_audit_plan_auditor",
        ),
    )

    audit_plan = relationship("AuditPlan")
    user = relationship("User")
