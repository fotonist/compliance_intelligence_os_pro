"""add canonical ISO 15504 PAM process dimension

Revision ID: 20260911_pam_process_dimension
Revises: 20260911_framework_models
Create Date: 2026-09-11
"""

from alembic import op
import sqlalchemy as sa


revision = "20260911_pam_process_dimension"
down_revision = "20260911_framework_models"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "pam_process_categories",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("framework_model_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["framework_model_id"], ["framework_models.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("framework_model_id", "code", name="uq_pam_category_model_code"),
    )
    op.create_index("ix_pam_process_categories_framework_model_id", "pam_process_categories", ["framework_model_id"])

    op.create_table(
        "pam_process_groups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["category_id"], ["pam_process_categories.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("category_id", "code", name="uq_pam_group_category_code"),
    )
    op.create_index("ix_pam_process_groups_category_id", "pam_process_groups", ["category_id"])

    op.create_table(
        "pam_processes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("framework_model_id", sa.Integer(), nullable=False),
        sa.Column("process_group_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("purpose", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["framework_model_id"], ["framework_models.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["process_group_id"], ["pam_process_groups.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("framework_model_id", "code", name="uq_pam_process_model_code"),
    )
    op.create_index("ix_pam_processes_framework_model_id", "pam_processes", ["framework_model_id"])
    op.create_index("ix_pam_processes_process_group_id", "pam_processes", ["process_group_id"])

    op.create_table(
        "pam_process_outcomes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("process_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["process_id"], ["pam_processes.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("process_id", "code", name="uq_pam_outcome_process_code"),
    )
    op.create_index("ix_pam_process_outcomes_process_id", "pam_process_outcomes", ["process_id"])

    op.create_table(
        "pam_base_practices",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("process_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("guidance", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["process_id"], ["pam_processes.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("process_id", "code", name="uq_pam_base_practice_process_code"),
    )
    op.create_index("ix_pam_base_practices_process_id", "pam_base_practices", ["process_id"])

    op.create_table(
        "pam_base_practice_outcomes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("base_practice_id", sa.Integer(), nullable=False),
        sa.Column("outcome_id", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["base_practice_id"], ["pam_base_practices.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["outcome_id"], ["pam_process_outcomes.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("base_practice_id", "outcome_id", name="uq_pam_base_practice_outcome"),
    )
    op.create_index("ix_pam_base_practice_outcomes_base_practice_id", "pam_base_practice_outcomes", ["base_practice_id"])
    op.create_index("ix_pam_base_practice_outcomes_outcome_id", "pam_base_practice_outcomes", ["outcome_id"])

    op.create_table(
        "pam_work_products",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("framework_model_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("characteristics", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["framework_model_id"], ["framework_models.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("framework_model_id", "code", name="uq_pam_work_product_model_code"),
    )
    op.create_index("ix_pam_work_products_framework_model_id", "pam_work_products", ["framework_model_id"])

    op.create_table(
        "pam_process_work_products",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("process_id", sa.Integer(), nullable=False),
        sa.Column("work_product_id", sa.Integer(), nullable=False),
        sa.Column("direction", sa.String(length=20), nullable=False, server_default="BOTH"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["process_id"], ["pam_processes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["work_product_id"], ["pam_work_products.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("process_id", "work_product_id", "direction", name="uq_pam_process_work_product"),
    )
    op.create_index("ix_pam_process_work_products_process_id", "pam_process_work_products", ["process_id"])
    op.create_index("ix_pam_process_work_products_work_product_id", "pam_process_work_products", ["work_product_id"])


def downgrade():
    op.drop_table("pam_process_work_products")
    op.drop_table("pam_work_products")
    op.drop_table("pam_base_practice_outcomes")
    op.drop_table("pam_base_practices")
    op.drop_table("pam_process_outcomes")
    op.drop_table("pam_processes")
    op.drop_table("pam_process_groups")
    op.drop_table("pam_process_categories")
