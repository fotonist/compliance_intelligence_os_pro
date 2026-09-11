"""add canonical ISO 15504 PAM capability dimension

Revision ID: 20260911_pam_capability_dimension
Revises: 20260911_pam_process_dimension
Create Date: 2026-09-11
"""

from alembic import op
import sqlalchemy as sa


revision = "20260911_pam_capability_dimension"
down_revision = "20260911_pam_process_dimension"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "pam_capability_levels",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("framework_model_id", sa.Integer(), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["framework_model_id"], ["framework_models.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("framework_model_id", "level", name="uq_pam_capability_model_level"),
        sa.UniqueConstraint("framework_model_id", "code", name="uq_pam_capability_model_code"),
    )
    op.create_index("ix_pam_capability_levels_framework_model_id", "pam_capability_levels", ["framework_model_id"])

    op.create_table(
        "pam_process_attributes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("capability_level_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["capability_level_id"], ["pam_capability_levels.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("capability_level_id", "code", name="uq_pam_process_attribute_level_code"),
    )
    op.create_index("ix_pam_process_attributes_capability_level_id", "pam_process_attributes", ["capability_level_id"])

    op.create_table(
        "pam_generic_practices",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("process_attribute_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("guidance", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["process_attribute_id"], ["pam_process_attributes.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("process_attribute_id", "code", name="uq_pam_generic_practice_attribute_code"),
    )
    op.create_index("ix_pam_generic_practices_process_attribute_id", "pam_generic_practices", ["process_attribute_id"])

    op.create_table(
        "pam_generic_resources",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("process_attribute_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("guidance", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["process_attribute_id"], ["pam_process_attributes.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("process_attribute_id", "code", name="uq_pam_generic_resource_attribute_code"),
    )
    op.create_index("ix_pam_generic_resources_process_attribute_id", "pam_generic_resources", ["process_attribute_id"])

    op.create_table(
        "pam_generic_work_products",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("process_attribute_id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("guidance", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["process_attribute_id"], ["pam_process_attributes.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("process_attribute_id", "code", name="uq_pam_generic_wp_attribute_code"),
    )
    op.create_index("ix_pam_generic_work_products_process_attribute_id", "pam_generic_work_products", ["process_attribute_id"])


def downgrade():
    op.drop_table("pam_generic_work_products")
    op.drop_table("pam_generic_resources")
    op.drop_table("pam_generic_practices")
    op.drop_table("pam_process_attributes")
    op.drop_table("pam_capability_levels")
