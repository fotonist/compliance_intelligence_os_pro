"""add canonical PAM assessment execution layer

Revision ID: 20260911_pam_assessment_execution
Revises: 20260911_process_pam_mappings
Create Date: 2026-09-11
"""

from alembic import op
import sqlalchemy as sa


revision = "20260911_pam_assessment_execution"
down_revision = "20260911_process_pam_mappings"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "pam_assessments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("framework_adoption_id", sa.Integer(), nullable=False),
        sa.Column("framework_model_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("scope", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="DRAFT"),
        sa.Column("assessor_user_id", sa.Integer(), nullable=True),
        sa.Column("sponsor_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["framework_adoption_id"], ["framework_adoptions.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["framework_model_id"], ["framework_models.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["assessor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["sponsor_user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_pam_assessments_tenant_id", "pam_assessments", ["tenant_id"])
    op.create_index("ix_pam_assessments_framework_adoption_id", "pam_assessments", ["framework_adoption_id"])
    op.create_index("ix_pam_assessments_framework_model_id", "pam_assessments", ["framework_model_id"])
    op.create_index("ix_pam_assessments_status", "pam_assessments", ["status"])

    op.create_table(
        "pam_assessment_processes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("assessment_id", sa.Integer(), nullable=False),
        sa.Column("tenant_process_id", sa.Integer(), nullable=False),
        sa.Column("pam_process_id", sa.Integer(), nullable=False),
        sa.Column("in_scope", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("target_capability_level", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="NOT_STARTED"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["assessment_id"], ["pam_assessments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_process_id"], ["processes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["pam_process_id"], ["pam_processes.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("assessment_id", "tenant_process_id", "pam_process_id", name="uq_pam_assessment_process_pair"),
    )
    op.create_index("ix_pam_assessment_processes_assessment_id", "pam_assessment_processes", ["assessment_id"])
    op.create_index("ix_pam_assessment_processes_tenant_process_id", "pam_assessment_processes", ["tenant_process_id"])
    op.create_index("ix_pam_assessment_processes_pam_process_id", "pam_assessment_processes", ["pam_process_id"])
    op.create_index("ix_pam_assessment_processes_status", "pam_assessment_processes", ["status"])

    op.create_table(
        "pam_process_attribute_evaluations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("assessment_process_id", sa.Integer(), nullable=False),
        sa.Column("process_attribute_id", sa.Integer(), nullable=False),
        sa.Column("rating", sa.String(length=32), nullable=True),
        sa.Column("justification", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="DRAFT"),
        sa.Column("evaluated_by", sa.Integer(), nullable=True),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["assessment_process_id"], ["pam_assessment_processes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["process_attribute_id"], ["pam_process_attributes.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["evaluated_by"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("assessment_process_id", "process_attribute_id", name="uq_pam_attribute_evaluation"),
    )
    op.create_index("ix_pam_process_attribute_evaluations_assessment_process_id", "pam_process_attribute_evaluations", ["assessment_process_id"])
    op.create_index("ix_pam_process_attribute_evaluations_process_attribute_id", "pam_process_attribute_evaluations", ["process_attribute_id"])
    op.create_index("ix_pam_process_attribute_evaluations_status", "pam_process_attribute_evaluations", ["status"])


def downgrade():
    op.drop_table("pam_process_attribute_evaluations")
    op.drop_table("pam_assessment_processes")
    op.drop_table("pam_assessments")
