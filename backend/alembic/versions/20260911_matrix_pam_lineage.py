"""add canonical PAM lineage to matrix storage

Revision ID: 20260911_matrix_pam_lineage
Revises: 20260911_pam_indicator_evaluation_layer
Create Date: 2026-09-11
"""

from alembic import op
import sqlalchemy as sa

revision = "20260911_matrix_pam_lineage"
down_revision = "20260911_pam_indicator_evaluation_layer"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("matrix_instances", sa.Column("framework_model_id", sa.Integer(), nullable=True))
    op.add_column("matrix_instances", sa.Column("reference_model_id", sa.Integer(), nullable=True))
    op.add_column("matrix_instances", sa.Column("capability_framework_id", sa.Integer(), nullable=True))
    op.add_column("matrix_instances", sa.Column("framework_adoption_id", sa.Integer(), nullable=True))
    op.create_index("ix_matrix_instances_framework_model_id", "matrix_instances", ["framework_model_id"])
    op.create_index("ix_matrix_instances_reference_model_id", "matrix_instances", ["reference_model_id"])
    op.create_index("ix_matrix_instances_capability_framework_id", "matrix_instances", ["capability_framework_id"])
    op.create_index("ix_matrix_instances_framework_adoption_id", "matrix_instances", ["framework_adoption_id"])
    op.create_foreign_key("fk_matrix_instances_framework_model", "matrix_instances", "framework_models", ["framework_model_id"], ["id"], ondelete="RESTRICT")
    op.create_foreign_key("fk_matrix_instances_reference_model", "matrix_instances", "framework_models", ["reference_model_id"], ["id"], ondelete="RESTRICT")
    op.create_foreign_key("fk_matrix_instances_capability_framework", "matrix_instances", "framework_models", ["capability_framework_id"], ["id"], ondelete="RESTRICT")
    op.create_foreign_key("fk_matrix_instances_framework_adoption", "matrix_instances", "framework_adoptions", ["framework_adoption_id"], ["id"], ondelete="RESTRICT")

    op.add_column("matrix_rows", sa.Column("framework_model_id", sa.Integer(), nullable=True))
    op.add_column("matrix_rows", sa.Column("pam_process_category_id", sa.Integer(), nullable=True))
    op.add_column("matrix_rows", sa.Column("pam_process_group_id", sa.Integer(), nullable=True))
    op.add_column("matrix_rows", sa.Column("pam_process_id", sa.Integer(), nullable=True))
    op.create_index("ix_matrix_rows_framework_model_id", "matrix_rows", ["framework_model_id"])
    op.create_index("ix_matrix_rows_pam_process_category_id", "matrix_rows", ["pam_process_category_id"])
    op.create_index("ix_matrix_rows_pam_process_group_id", "matrix_rows", ["pam_process_group_id"])
    op.create_index("ix_matrix_rows_pam_process_id", "matrix_rows", ["pam_process_id"])
    op.create_foreign_key("fk_matrix_rows_framework_model", "matrix_rows", "framework_models", ["framework_model_id"], ["id"], ondelete="RESTRICT")
    op.create_foreign_key("fk_matrix_rows_pam_process_category", "matrix_rows", "pam_process_categories", ["pam_process_category_id"], ["id"], ondelete="RESTRICT")
    op.create_foreign_key("fk_matrix_rows_pam_process_group", "matrix_rows", "pam_process_groups", ["pam_process_group_id"], ["id"], ondelete="RESTRICT")
    op.create_foreign_key("fk_matrix_rows_pam_process", "matrix_rows", "pam_processes", ["pam_process_id"], ["id"], ondelete="RESTRICT")


def downgrade():
    for name in ("fk_matrix_rows_pam_process", "fk_matrix_rows_pam_process_group", "fk_matrix_rows_pam_process_category", "fk_matrix_rows_framework_model"):
        op.drop_constraint(name, "matrix_rows", type_="foreignkey")
    for name in ("ix_matrix_rows_pam_process_id", "ix_matrix_rows_pam_process_group_id", "ix_matrix_rows_pam_process_category_id", "ix_matrix_rows_framework_model_id"):
        op.drop_index(name, table_name="matrix_rows")
    for col in ("pam_process_id", "pam_process_group_id", "pam_process_category_id", "framework_model_id"):
        op.drop_column("matrix_rows", col)

    for name in ("fk_matrix_instances_framework_adoption", "fk_matrix_instances_capability_framework", "fk_matrix_instances_reference_model", "fk_matrix_instances_framework_model"):
        op.drop_constraint(name, "matrix_instances", type_="foreignkey")
    for name in ("ix_matrix_instances_framework_adoption_id", "ix_matrix_instances_capability_framework_id", "ix_matrix_instances_reference_model_id", "ix_matrix_instances_framework_model_id"):
        op.drop_index(name, table_name="matrix_instances")
    for col in ("framework_adoption_id", "capability_framework_id", "reference_model_id", "framework_model_id"):
        op.drop_column("matrix_instances", col)
