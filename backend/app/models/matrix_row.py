# C:\Projects\compliance_app\backend\app\models\matrix_rows.py
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.base import Base
from app.models.mixins import TenantMixin


class MatrixRow(Base, TenantMixin):
    __tablename__ = "matrix_rows"

    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False, index=True)
    instance_id = Column(Integer, ForeignKey("matrix_instances.id", ondelete="CASCADE"), nullable=False, index=True)
    standard_id = Column(Integer, ForeignKey("standards.id"), nullable=False)

    clause_id = Column(Integer, ForeignKey("clauses.id"), nullable=True)
    requirement_id = Column(Integer, ForeignKey("requirements.id"), nullable=True)
    control_id = Column(Integer, ForeignKey("controls.id"), nullable=True)

    # Legacy maturity references remain nullable for backward compatibility.
    process_area_id = Column(Integer, ForeignKey("standard_process_areas.id"), nullable=True)
    practice_id = Column(Integer, ForeignKey("standard_practices.id"), nullable=True)

    # Canonical PAM structural lineage.
    framework_model_id = Column(Integer, ForeignKey("framework_models.id", ondelete="RESTRICT"), nullable=True, index=True)
    pam_process_category_id = Column(Integer, ForeignKey("pam_process_categories.id", ondelete="RESTRICT"), nullable=True, index=True)
    pam_process_group_id = Column(Integer, ForeignKey("pam_process_groups.id", ondelete="RESTRICT"), nullable=True, index=True)
    pam_process_id = Column(Integer, ForeignKey("pam_processes.id", ondelete="RESTRICT"), nullable=True, index=True)

    mode = Column(String(20), nullable=False)
    row_key = Column(String, nullable=False)
    payload = Column(JSONB, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
