from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class PamIndicatorEvaluation(Base):
    __tablename__ = "pam_indicator_evaluations"

    id = Column(Integer, primary_key=True, index=True)

    assessment_process_id = Column(
        Integer,
        ForeignKey("pam_assessment_processes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    indicator_type = Column(String(40), nullable=False, index=True)

    base_practice_id = Column(
        Integer,
        ForeignKey("pam_base_practices.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    work_product_id = Column(
        Integer,
        ForeignKey("pam_work_products.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    generic_practice_id = Column(
        Integer,
        ForeignKey("pam_generic_practices.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    generic_resource_id = Column(
        Integer,
        ForeignKey("pam_generic_resources.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    generic_work_product_id = Column(
        Integer,
        ForeignKey("pam_generic_work_products.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    rating = Column(String(40), nullable=True)
    observation = Column(Text, nullable=True)
    justification = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="draft", index=True)
    evaluator_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    evaluated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint(
            "assessment_process_id",
            "indicator_type",
            "base_practice_id",
            "work_product_id",
            "generic_practice_id",
            "generic_resource_id",
            "generic_work_product_id",
            name="uq_pam_indicator_evaluation_target",
        ),
    )

    assessment_process = relationship("PamAssessmentProcess", back_populates="indicator_evaluations")
    base_practice = relationship("PamBasePractice")
    work_product = relationship("PamWorkProduct")
    generic_practice = relationship("PamGenericPractice")
    generic_resource = relationship("PamGenericResource")
    generic_work_product = relationship("PamGenericWorkProduct")
    evidence_links = relationship(
        "PamIndicatorEvidenceLink",
        back_populates="evaluation",
        cascade="all, delete-orphan",
    )


class PamIndicatorEvidenceLink(Base):
    __tablename__ = "pam_indicator_evidence_links"

    id = Column(Integer, primary_key=True, index=True)
    evaluation_id = Column(
        Integer,
        ForeignKey("pam_indicator_evaluations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    evidence_id = Column(
        Integer,
        ForeignKey("evidences.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    relevance = Column(String(30), nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint(
            "evaluation_id",
            "evidence_id",
            name="uq_pam_indicator_evidence_link",
        ),
    )

    evaluation = relationship("PamIndicatorEvaluation", back_populates="evidence_links")
    evidence = relationship("Evidence")
