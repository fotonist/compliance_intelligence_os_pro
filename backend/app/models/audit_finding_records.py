from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

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
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    # Workflow ownership
    assigned_owner_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    process_manager_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    requirement = Column(String(255), nullable=True)
    objective_evidence = Column(Text, nullable=True)
    severity = Column(String(32), nullable=False, default="MEDIUM", index=True)

    # Controlled finding lifecycle:
    # OPEN -> ASSIGNED -> OWNER_RESPONSE -> SUBMITTED_FOR_REVIEW ->
    # REVISION_REQUIRED -> PLAN_APPROVED -> IN_PROGRESS ->
    # READY_FOR_VERIFICATION -> VERIFICATION_FAILED -> CLOSED
    status = Column(String(40), nullable=False, default="OPEN", index=True)

    # Backward-compatible display field. New workflow uses assigned_owner_id.
    owner = Column(String(255), nullable=True)
    due_date = Column(Date, nullable=True)

    # Owner response
    root_cause = Column(Text, nullable=True)
    correction = Column(Text, nullable=True)
    corrective_action_plan = Column(Text, nullable=True)
    recommendation = Column(Text, nullable=True)
    owner_submitted_at = Column(DateTime, nullable=True)
    owner_submitted_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    # Process manager review
    manager_review_status = Column(String(32), nullable=False, default="NOT_SUBMITTED")
    manager_review_comment = Column(Text, nullable=True)
    manager_reviewed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    manager_reviewed_at = Column(DateTime, nullable=True)

    # Implementation / effectiveness
    implementation_status = Column(String(32), nullable=False, default="NOT_STARTED")
    implementation_completed_at = Column(DateTime, nullable=True)
    implementation_evidence = Column(Text, nullable=True)

    verification_status = Column(String(32), nullable=False, default="NOT_READY")
    verification_comment = Column(Text, nullable=True)
    verified_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    verified_at = Column(DateTime, nullable=True)

    # Final closure
    closed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    closed_at = Column(DateTime, nullable=True)
    closure_comment = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    assigned_owner = relationship("User", foreign_keys=[assigned_owner_id])
    process_manager = relationship("User", foreign_keys=[process_manager_id])
    creator = relationship("User", foreign_keys=[created_by])
    owner_submitter = relationship("User", foreign_keys=[owner_submitted_by])
    manager_reviewer = relationship("User", foreign_keys=[manager_reviewed_by])
    verifier = relationship("User", foreign_keys=[verified_by])
    closer = relationship("User", foreign_keys=[closed_by])
