"""add canonical PAM indicator evaluation and evidence links

Revision ID: 20260911_pam_indicator_evaluation_layer
Revises: 20260911_pam_assessment_execution
Create Date: 2026-09-11
"""

from alembic import op
import sqlalchemy as sa


revision = "20260911_pam_indicator_evaluation_layer"
down_revision = "20260911_pam_assessment_execution"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "pam_indicator_evaluations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("assessment_process_id", sa.Integer(), nullable=False),
        sa.Column("indicator_type", sa.String(length=40), nullable=False),
        sa.Column("base_practice_id", sa.Integer(), nullable=True),
        sa.Column("work_product_id", sa.Integer(), nullable=True),
        sa.Column("generic_practice_id", sa.Integer(), nullable=True),
        sa.Column("generic_resource_id", sa.Integer(), nullable=True),
        sa.Column("generic_work_product_id", sa.Integer(), nullable=True),
        sa.Column("rating", sa.String(length=40), nullable=True),
        sa.Column("observation", sa.Text(), nullable=True),
        sa.Column("justification", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="draft"),
        sa.Column("evaluator_user_id", sa.Integer(), nullable=True),
        sa.Column("evaluated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["assessment_process_id"], ["pam_assessment_processes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["base_practice_id"], ["pam_base_practices.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["work_product_id"], ["pam_work_products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["generic_practice_id"], ["pam_generic_practices.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["generic_resource_id"], ["pam_generic_resources.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["generic_work_product_id"], ["pam_generic_work_products.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["evaluator_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint(
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
    for name, column in (
        ("ix_pam_indicator_evaluations_assessment_process_id", "assessment_process_id"),
        ("ix_pam_indicator_evaluations_indicator_type", "indicator_type"),
        ("ix_pam_indicator_evaluations_base_practice_id", "base_practice_id"),
        ("ix_pam_indicator_evaluations_work_product_id", "work_product_id"),
        ("ix_pam_indicator_evaluations_generic_practice_id", "generic_practice_id"),
        ("ix_pam_indicator_evaluations_generic_resource_id", "generic_resource_id"),
        ("ix_pam_indicator_evaluations_generic_work_product_id", "generic_work_product_id"),
        ("ix_pam_indicator_evaluations_status", "status"),
        ("ix_pam_indicator_evaluations_evaluator_user_id", "evaluator_user_id"),
    ):
        op.create_index(name, "pam_indicator_evaluations", [column])

    op.create_table(
        "pam_indicator_evidence_links",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("evaluation_id", sa.Integer(), nullable=False),
        sa.Column("evidence_id", sa.Integer(), nullable=False),
        sa.Column("relevance", sa.String(length=30), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["evaluation_id"], ["pam_indicator_evaluations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["evidence_id"], ["evidences.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("evaluation_id", "evidence_id", name="uq_pam_indicator_evidence_link"),
    )
    op.create_index("ix_pam_indicator_evidence_links_evaluation_id", "pam_indicator_evidence_links", ["evaluation_id"])
    op.create_index("ix_pam_indicator_evidence_links_evidence_id", "pam_indicator_evidence_links", ["evidence_id"])


def downgrade():
    op.drop_index("ix_pam_indicator_evidence_links_evidence_id", table_name="pam_indicator_evidence_links")
    op.drop_index("ix_pam_indicator_evidence_links_evaluation_id", table_name="pam_indicator_evidence_links")
    op.drop_table("pam_indicator_evidence_links")
    for name in (
        "ix_pam_indicator_evaluations_evaluator_user_id",
        "ix_pam_indicator_evaluations_status",
        "ix_pam_indicator_evaluations_generic_work_product_id",
        "ix_pam_indicator_evaluations_generic_resource_id",
        "ix_pam_indicator_evaluations_generic_practice_id",
        "ix_pam_indicator_evaluations_work_product_id",
        "ix_pam_indicator_evaluations_base_practice_id",
        "ix_pam_indicator_evaluations_indicator_type",
        "ix_pam_indicator_evaluations_assessment_process_id",
    ):
        op.drop_index(name, table_name="pam_indicator_evaluations")
    op.drop_table("pam_indicator_evaluations")
