from sqlalchemy import (
    Index,
    Table,
    Date,
    Numeric,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.sql import func

from app.db.base import Base


class FrameworkModel(Base):
    __tablename__ = "framework_models"

    id = Column(Integer, primary_key=True)
    standard_version_id = Column(
        Integer,
        ForeignKey("standard_versions.id", ondelete="CASCADE"),
        nullable=False,
    )
    model_type = Column(String, nullable=False)
    code = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String, nullable=False)
    is_canonical = Column(Boolean, nullable=False)
    model_metadata = Column("metadata", JSON, nullable=True)
    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )


class PamAssessment(Base):
    __tablename__ = "pam_assessments"

    id = Column(Integer, primary_key=True)
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )
    framework_adoption_id = Column(
        Integer,
        ForeignKey("framework_adoptions.id", ondelete="RESTRICT"),
        nullable=False,
    )
    framework_model_id = Column(
        Integer,
        ForeignKey("framework_models.id", ondelete="RESTRICT"),
        nullable=False,
    )
    name = Column(String, nullable=False)
    scope = Column(Text, nullable=True)
    status = Column(String, nullable=False)
    assessor_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    sponsor_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    audit_plan_id = Column(
        Integer,
        ForeignKey("audit_plans.id", ondelete="RESTRICT"),
        nullable=True,
    )


class PamAssessmentProcess(Base):
    __tablename__ = "pam_assessment_processes"
    __table_args__ = (
        UniqueConstraint(
            "assessment_id",
            "pam_process_id",
            name="uq_pam_assessment_process_pam_target",
        ),
    )

    id = Column(Integer, primary_key=True)
    assessment_id = Column(
        Integer,
        ForeignKey("pam_assessments.id", ondelete="CASCADE"),
        nullable=False,
    )
    tenant_process_id = Column(
        Integer,
        ForeignKey("processes.id", ondelete="CASCADE"),
        nullable=True,
    )
    pam_process_id = Column(
        Integer,
        ForeignKey("pam_processes.id", ondelete="RESTRICT"),
        nullable=False,
    )
    in_scope = Column(Boolean, nullable=False)
    target_capability_level = Column(Integer, nullable=True)
    status = Column(String, nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class PamProcessCategory(Base):
    __tablename__ = "pam_process_categories"
    __table_args__ = (
        UniqueConstraint(
            "framework_model_id",
            "code",
            name="uq_pam_process_category_model_code",
        ),
    )

    id = Column(Integer, primary_key=True)
    framework_model_id = Column(
        Integer,
        ForeignKey("framework_models.id", ondelete="CASCADE"),
        nullable=False,
    )
    code = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False)
    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )


class PamProcessGroup(Base):
    __tablename__ = "pam_process_groups"
    __table_args__ = (
        UniqueConstraint(
            "category_id",
            "code",
            name="uq_pam_process_group_category_code",
        ),
    )

    id = Column(Integer, primary_key=True)
    category_id = Column(
        Integer,
        ForeignKey("pam_process_categories.id", ondelete="CASCADE"),
        nullable=False,
    )
    code = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False)
    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )


class PamProcess(Base):
    __tablename__ = "pam_processes"
    __table_args__ = (
        UniqueConstraint(
            "framework_model_id",
            "code",
            name="uq_pam_process_model_code",
        ),
    )

    id = Column(Integer, primary_key=True)
    framework_model_id = Column(
        Integer,
        ForeignKey("framework_models.id", ondelete="CASCADE"),
        nullable=False,
    )
    process_group_id = Column(
        Integer,
        ForeignKey("pam_process_groups.id", ondelete="CASCADE"),
        nullable=False,
    )
    code = Column(String, nullable=False)
    name = Column(String, nullable=False)
    purpose = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False)
    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )


class PamProcessOutcome(Base):
    __tablename__ = "pam_process_outcomes"
    __table_args__ = (
        UniqueConstraint(
            "process_id",
            "code",
            name="uq_pam_process_outcome_process_code",
        ),
    )

    id = Column(Integer, primary_key=True)
    process_id = Column(
        Integer,
        ForeignKey("pam_processes.id", ondelete="CASCADE"),
        nullable=False,
    )
    code = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    sort_order = Column(Integer, nullable=False)
    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )


class PamBasePractice(Base):
    __tablename__ = "pam_base_practices"
    __table_args__ = (
        UniqueConstraint(
            "process_id",
            "code",
            name="uq_pam_base_practice_process_code",
        ),
    )

    id = Column(Integer, primary_key=True)
    process_id = Column(
        Integer,
        ForeignKey("pam_processes.id", ondelete="CASCADE"),
        nullable=False,
    )
    code = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    guidance = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False)
    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )


class PamWorkProduct(Base):
    __tablename__ = "pam_work_products"
    __table_args__ = (
        UniqueConstraint(
            "framework_model_id",
            "code",
            name="uq_pam_work_product_model_code",
        ),
    )

    id = Column(Integer, primary_key=True)
    framework_model_id = Column(
        Integer,
        ForeignKey("framework_models.id", ondelete="CASCADE"),
        nullable=False,
    )
    code = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    characteristics = Column(JSON, nullable=True)
    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )


class PamProcessWorkProduct(Base):
    __tablename__ = "pam_process_work_products"
    __table_args__ = (
        CheckConstraint(
            "upper(direction) IN ('INPUT', 'OUTPUT', 'BOTH')",
            name="ck_pam_process_work_product_direction",
        ),
        UniqueConstraint(
            "process_id",
            "work_product_id",
            "direction",
            name="uq_pam_process_work_product_direction",
        ),
    )

    id = Column(Integer, primary_key=True)
    process_id = Column(
        Integer,
        ForeignKey("pam_processes.id", ondelete="CASCADE"),
        nullable=False,
    )
    work_product_id = Column(
        Integer,
        ForeignKey("pam_work_products.id", ondelete="CASCADE"),
        nullable=False,
    )
    direction = Column(String, nullable=False)
    sort_order = Column(Integer, nullable=False)


class PamRatingOption(Base):
    __tablename__ = "pam_rating_options"
    __table_args__ = (
        UniqueConstraint(
            "framework_model_id",
            "code",
            name="uq_pam_rating_option_model_code",
        ),
        UniqueConstraint(
            "framework_model_id",
            "sort_order",
            name="uq_pam_rating_option_model_sort_order",
        ),
    )

    id = Column(Integer, primary_key=True)
    framework_model_id = Column(
        Integer,
        ForeignKey("framework_models.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code = Column(String(32), nullable=False)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    numeric_value = Column(Float, nullable=True)
    lower_bound = Column(Float, nullable=True)
    upper_bound = Column(Float, nullable=True)
    sort_order = Column(Integer, nullable=False)
    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )


class PamCapabilityLevel(Base):
    __tablename__ = "pam_capability_levels"

    id = Column(Integer, primary_key=True)
    framework_model_id = Column(
        Integer,
        ForeignKey("framework_models.id", ondelete="CASCADE"),
        nullable=False,
    )
    level = Column(Integer, nullable=False)
    code = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False)
    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )


class PamProcessAttribute(Base):
    __tablename__ = "pam_process_attributes"

    id = Column(Integer, primary_key=True)
    capability_level_id = Column(
        Integer,
        ForeignKey("pam_capability_levels.id", ondelete="CASCADE"),
        nullable=False,
    )
    code = Column(String, nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False)
    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )


class PamGenericPractice(Base):
    __tablename__ = "pam_generic_practices"

    id = Column(Integer, primary_key=True)
    process_attribute_id = Column(
        Integer,
        ForeignKey("pam_process_attributes.id", ondelete="CASCADE"),
        nullable=False,
    )
    code = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    guidance = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False)
    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )


class PamGenericResource(Base):
    __tablename__ = "pam_generic_resources"

    id = Column(Integer, primary_key=True)
    process_attribute_id = Column(
        Integer,
        ForeignKey("pam_process_attributes.id", ondelete="CASCADE"),
        nullable=False,
    )
    code = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    guidance = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False)
    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )


class PamGenericWorkProduct(Base):
    __tablename__ = "pam_generic_work_products"

    id = Column(Integer, primary_key=True)
    process_attribute_id = Column(
        Integer,
        ForeignKey("pam_process_attributes.id", ondelete="CASCADE"),
        nullable=False,
    )
    code = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    guidance = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False)
    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )


class PamProcessAttributeEvaluation(Base):
    __tablename__ = "pam_process_attribute_evaluations"
    __table_args__ = (
        Index(
            "uq_pam_pa_eval_legacy_scope",
            "assessment_process_id",
            "process_attribute_id",
            unique=True,
            postgresql_where=text(
                "audit_maturity_target_id IS NULL"
            ),
        ),
        Index(
            "uq_pam_pa_eval_target_attribute",
            "audit_maturity_target_id",
            "process_attribute_id",
            unique=True,
            postgresql_where=text(
                "audit_maturity_target_id IS NOT NULL"
            ),
        ),
    )

    id = Column(Integer, primary_key=True)
    assessment_process_id = Column(
        Integer,
        ForeignKey("pam_assessment_processes.id", ondelete="CASCADE"),
        nullable=False,
    )
    process_attribute_id = Column(
        Integer,
        ForeignKey("pam_process_attributes.id", ondelete="RESTRICT"),
        nullable=False,
    )
    audit_maturity_target_id = Column(
        Integer,
        ForeignKey("audit_maturity_targets.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    rating = Column(String, nullable=True)
    justification = Column(Text, nullable=True)
    status = Column(String, nullable=False)
    evaluated_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    evaluated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class PamIndicatorEvaluation(Base):
    __tablename__ = "pam_indicator_evaluations"
    __table_args__ = (
        CheckConstraint(
            """
            (
                upper(indicator_type) = 'BASE_PRACTICE'
                AND base_practice_id IS NOT NULL
                AND work_product_id IS NULL
                AND generic_practice_id IS NULL
                AND generic_resource_id IS NULL
                AND generic_work_product_id IS NULL
            )
            OR
            (
                upper(indicator_type) = 'WORK_PRODUCT'
                AND base_practice_id IS NULL
                AND work_product_id IS NOT NULL
                AND generic_practice_id IS NULL
                AND generic_resource_id IS NULL
                AND generic_work_product_id IS NULL
            )
            OR
            (
                upper(indicator_type) = 'GENERIC_PRACTICE'
                AND base_practice_id IS NULL
                AND work_product_id IS NULL
                AND generic_practice_id IS NOT NULL
                AND generic_resource_id IS NULL
                AND generic_work_product_id IS NULL
            )
            OR
            (
                upper(indicator_type) = 'GENERIC_RESOURCE'
                AND base_practice_id IS NULL
                AND work_product_id IS NULL
                AND generic_practice_id IS NULL
                AND generic_resource_id IS NOT NULL
                AND generic_work_product_id IS NULL
            )
            OR
            (
                upper(indicator_type) = 'GENERIC_WORK_PRODUCT'
                AND base_practice_id IS NULL
                AND work_product_id IS NULL
                AND generic_practice_id IS NULL
                AND generic_resource_id IS NULL
                AND generic_work_product_id IS NOT NULL
            )
            """,
            name="ck_pam_indicator_evaluation_target",
        ),
    )

    id = Column(Integer, primary_key=True)
    assessment_process_id = Column(
        Integer,
        ForeignKey("pam_assessment_processes.id", ondelete="CASCADE"),
        nullable=False,
    )
    indicator_type = Column(String, nullable=False)
    base_practice_id = Column(
        Integer,
        ForeignKey("pam_base_practices.id", ondelete="RESTRICT"),
        nullable=True,
    )
    work_product_id = Column(
        Integer,
        ForeignKey("pam_work_products.id", ondelete="RESTRICT"),
        nullable=True,
    )
    generic_practice_id = Column(
        Integer,
        ForeignKey("pam_generic_practices.id", ondelete="RESTRICT"),
        nullable=True,
    )
    generic_resource_id = Column(
        Integer,
        ForeignKey("pam_generic_resources.id", ondelete="RESTRICT"),
        nullable=True,
    )
    generic_work_product_id = Column(
        Integer,
        ForeignKey("pam_generic_work_products.id", ondelete="RESTRICT"),
        nullable=True,
    )
    rating = Column(String, nullable=True)
    observation = Column(Text, nullable=True)
    justification = Column(Text, nullable=True)
    status = Column(String, nullable=False)
    evaluator_user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )
    evaluated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class PamIndicatorEvidenceLink(Base):
    __tablename__ = "pam_indicator_evidence_links"
    __table_args__ = (
        UniqueConstraint(
            "evaluation_id",
            "evidence_id",
            name="uq_pam_indicator_evidence_link",
        ),
    )

    id = Column(Integer, primary_key=True)
    evaluation_id = Column(
        Integer,
        ForeignKey("pam_indicator_evaluations.id", ondelete="CASCADE"),
        nullable=False,
    )
    evidence_id = Column(
        Integer,
        ForeignKey("evidences.id", ondelete="CASCADE"),
        nullable=False,
    )
    relevance = Column(String, nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


class PamBasePracticeOutcome(Base):
    __tablename__ = "pam_base_practice_outcomes"
    __table_args__ = (
        UniqueConstraint(
            "base_practice_id",
            "outcome_id",
            name="uq_pam_base_practice_outcome_link",
        ),
    )

    id = Column(Integer, primary_key=True)
    base_practice_id = Column(
        Integer,
        ForeignKey("pam_base_practices.id", ondelete="CASCADE"),
        nullable=False,
    )
    outcome_id = Column(
        Integer,
        ForeignKey("pam_process_outcomes.id", ondelete="CASCADE"),
        nullable=False,
    )


class ProcessPamMapping(Base):
    __tablename__ = "process_pam_mappings"
    __table_args__ = (
        UniqueConstraint(
            "framework_adoption_id",
            "process_id",
            "pam_process_id",
            name="uq_process_pam_mapping_adoption",
        ),
    )

    id = Column(Integer, primary_key=True)
    process_id = Column(
        Integer,
        ForeignKey("processes.id", ondelete="CASCADE"),
        nullable=False,
    )
    pam_process_id = Column(
        Integer,
        ForeignKey("pam_processes.id", ondelete="CASCADE"),
        nullable=False,
    )
    mapping_type = Column(String, nullable=False)
    confidence = Column(Float, nullable=True)
    rationale = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    framework_adoption_id = Column(
        Integer,
        ForeignKey("framework_adoptions.id", ondelete="CASCADE"),
        nullable=False,
    )


class PamStandardBasePracticeEvaluation(Base):
    __tablename__ = "pam_base_practice_evaluations"

    id = Column(Integer, primary_key=True)
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
    )
    standard_version_id = Column(
        Integer,
        ForeignKey("standard_versions.id", ondelete="CASCADE"),
        nullable=False,
    )
    base_practice_id = Column(
        Integer,
        ForeignKey("standard_base_practices.id", ondelete="CASCADE"),
        nullable=False,
    )
    status = Column(
        String,
        nullable=False,
        server_default="not_assessed",
    )
    finding = Column(Text, nullable=True)
    action = Column(Text, nullable=True)
    evaluated_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )
    evaluated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)


class PamStandardBasePracticeEvidenceLink(Base):
    __tablename__ = "pam_base_practice_evidence_links"
    __table_args__ = (
        UniqueConstraint(
            "base_practice_id",
            "evidence_id",
            name="uq_pam_bp_evidence_link_base_practice_evidence",
        ),
    )

    id = Column(Integer, primary_key=True)
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
    )
    base_practice_id = Column(
        Integer,
        ForeignKey("standard_base_practices.id", ondelete="CASCADE"),
        nullable=False,
    )
    evidence_id = Column(
        Integer,
        ForeignKey("evidences.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at = Column(DateTime, nullable=False)



# Reference-only metadata registration for an existing canonical table.
# The physical table is managed by the standard definition layer.
standard_indicators_reference = Table(
    "standard_indicators",
    Base.metadata,
    Column("id", Integer, primary_key=True),
    extend_existing=True,
)


class PamProcessPerformanceObjective(Base):
    __tablename__ = "pam_process_performance_objectives"

    __table_args__ = (
        UniqueConstraint(
            "assessment_process_id",
            "code",
            name="uq_pam_process_performance_objective_code",
        ),
    )

    id = Column(Integer, primary_key=True)

    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    assessment_process_id = Column(
        Integer,
        ForeignKey(
            "pam_assessment_processes.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    process_attribute_id = Column(
        Integer,
        ForeignKey(
            "pam_process_attributes.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    standard_indicator_id = Column(
        Integer,
        ForeignKey(
            "standard_indicators.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    code = Column(
        String(100),
        nullable=False,
    )

    title = Column(
        String(255),
        nullable=False,
    )

    description = Column(
        Text,
        nullable=True,
    )

    measurement_method = Column(
        Text,
        nullable=True,
    )

    unit = Column(
        String(50),
        nullable=True,
    )

    target_value = Column(
        Numeric(18, 4),
        nullable=True,
    )

    direction = Column(
        String(20),
        nullable=True,
    )

    owner_user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    status = Column(
        String(32),
        nullable=False,
    )

    created_by = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class PamProcessPerformanceMeasurement(Base):
    __tablename__ = "pam_process_performance_measurements"

    id = Column(Integer, primary_key=True)

    objective_id = Column(
        Integer,
        ForeignKey(
            "pam_process_performance_objectives.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    period_start = Column(
        Date,
        nullable=True,
    )

    period_end = Column(
        Date,
        nullable=True,
    )

    measured_value = Column(
        Numeric(18, 4),
        nullable=False,
    )

    target_value_snapshot = Column(
        Numeric(18, 4),
        nullable=True,
    )

    variance = Column(
        Numeric(18, 4),
        nullable=True,
    )

    achievement_result = Column(
        String(32),
        nullable=True,
    )

    measurement_source = Column(
        String(255),
        nullable=True,
    )

    evidence_id = Column(
        Integer,
        ForeignKey(
            "evidences.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    measured_by = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    measured_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    note = Column(
        Text,
        nullable=True,
    )

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
