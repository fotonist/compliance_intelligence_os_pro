from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class PamAssessment(Base):
    __tablename__ = "pam_assessments"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    framework_adoption_id = Column(Integer, ForeignKey("framework_adoptions.id", ondelete="RESTRICT"), nullable=False, index=True)
    framework_model_id = Column(Integer, ForeignKey("framework_models.id", ondelete="RESTRICT"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    scope = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="DRAFT", index=True)
    assessor_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    sponsor_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    processes = relationship("PamAssessmentProcess", back_populates="assessment", cascade="all, delete-orphan")


class PamAssessmentProcess(Base):
    __tablename__ = "pam_assessment_processes"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(Integer, ForeignKey("pam_assessments.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_process_id = Column(Integer, ForeignKey("processes.id", ondelete="CASCADE"), nullable=False, index=True)
    pam_process_id = Column(Integer, ForeignKey("pam_processes.id", ondelete="RESTRICT"), nullable=False, index=True)
    in_scope = Column(Boolean, nullable=False, default=True)
    target_capability_level = Column(Integer, nullable=True)
    status = Column(String(32), nullable=False, default="NOT_STARTED", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    assessment = relationship("PamAssessment", back_populates="processes")
    tenant_process = relationship("Process")
    pam_process = relationship("PamProcess")
    attribute_evaluations = relationship("PamProcessAttributeEvaluation", back_populates="assessment_process", cascade="all, delete-orphan")


class PamProcessAttributeEvaluation(Base):
    __tablename__ = "pam_process_attribute_evaluations"

    id = Column(Integer, primary_key=True, index=True)
    assessment_process_id = Column(Integer, ForeignKey("pam_assessment_processes.id", ondelete="CASCADE"), nullable=False, index=True)
    process_attribute_id = Column(Integer, ForeignKey("pam_process_attributes.id", ondelete="RESTRICT"), nullable=False, index=True)
    rating = Column(String(32), nullable=True)
    justification = Column(Text, nullable=True)
    status = Column(String(32), nullable=False, default="DRAFT", index=True)
    evaluated_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    evaluated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    assessment_process = relationship("PamAssessmentProcess", back_populates="attribute_evaluations")
    process_attribute = relationship("PamProcessAttribute")
