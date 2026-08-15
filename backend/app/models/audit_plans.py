from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.models.mixins import TenantMixin


class AuditPlan(Base, TenantMixin):
    __tablename__ = "audit_plans"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    reference = Column(String(64), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    audit_type = Column(String(32), nullable=False, default="internal")
    objective = Column(Text, nullable=True)
    scope = Column(Text, nullable=True)

    standard_id = Column(
        Integer,
        ForeignKey("standards.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    standard_version_id = Column(
        Integer,
        ForeignKey("standard_versions.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    process_id = Column(
        Integer,
        ForeignKey("processes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    lead_auditor_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    planned_start = Column(Date, nullable=True)
    planned_end = Column(Date, nullable=True)
    status = Column(String(32), nullable=False, default="DRAFT", index=True)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    process = relationship("Process", foreign_keys=[process_id])
    standard = relationship("Standard", foreign_keys=[standard_id])
    standard_version = relationship("StandardVersion", foreign_keys=[standard_version_id])
    lead_auditor = relationship("User", foreign_keys=[lead_auditor_id])
    creator = relationship("User", foreign_keys=[created_by])
