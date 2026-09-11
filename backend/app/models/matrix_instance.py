# C:\Projects\compliance_app\backend\app\models\matrix_instances.py
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.base import Base
from app.models.mixins import TenantMixin


class MatrixInstance(Base, TenantMixin):
    __tablename__ = "matrix_instances"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False, index=True)
    standard_id = Column(Integer, ForeignKey("standards.id", ondelete="CASCADE"), nullable=False)
    standard_version_id = Column(Integer, ForeignKey("standard_versions.id", ondelete="CASCADE"), nullable=False)

    # Canonical framework lineage. These identify the definition snapshot,
    # not assessment results.
    framework_model_id = Column(Integer, ForeignKey("framework_models.id", ondelete="RESTRICT"), nullable=True, index=True)
    reference_model_id = Column(Integer, ForeignKey("framework_models.id", ondelete="RESTRICT"), nullable=True, index=True)
    capability_framework_id = Column(Integer, ForeignKey("framework_models.id", ondelete="RESTRICT"), nullable=True, index=True)
    framework_adoption_id = Column(Integer, ForeignKey("framework_adoptions.id", ondelete="RESTRICT"), nullable=True, index=True)

    status = Column(String(32), nullable=False, default="generated")

    # Retained for control-matrix presentation snapshots. PAM matrices do not
    # use configurable assessment columns.
    column_snapshot = Column(JSONB, nullable=True)

    started_at = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    created_by = Column(Integer, nullable=True)
    approved_by = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
