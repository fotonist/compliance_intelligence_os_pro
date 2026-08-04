# C:\Projects\compliance_app\backend\app\models\evidence_files.py
from __future__ import annotations

from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship

from app.db.base import Base

from app.models.mixins import TenantMixin

class EvidenceFile(Base, TenantMixin):

    __tablename__ = "evidence_files"

    id = Column(Integer, primary_key=True, index=True)

    # ✅ MULTI TENANT (join safety)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False, index=True)

    evidence_id = Column(Integer, ForeignKey("evidences.id"), nullable=False, index=True)

    # Versioning
    version = Column(Integer, nullable=False, default=1)

    # Who uploaded this file version
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # File metadata
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    mime_type = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)

    # Approval workflow (4-eyes)
    # Draft -> PendingApproval -> Approved/Rejected
    status = Column(String, nullable=False, default="Draft")

    submitted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    submitted_at = Column(DateTime, nullable=True)

    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)

    approval_comment = Column(Text, nullable=True)
    rejected_at = Column(DateTime, nullable=True)

    # Rollback lineage (audit safe)
    rolled_from_file_id = Column(Integer, ForeignKey("evidence_files.id"), nullable=True)

    tenant = relationship("Tenant", lazy="joined")

    # Relationships
    evidence = relationship("Evidence", back_populates="files", lazy="selectin")
