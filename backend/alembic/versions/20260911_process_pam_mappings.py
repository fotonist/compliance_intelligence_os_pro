"""add tenant process to canonical PAM mappings

Revision ID: 20260911_process_pam_mappings
Revises: 20260911_pam_capability_dimension
Create Date: 2026-09-11
"""

from alembic import op
import sqlalchemy as sa


revision = "20260911_process_pam_mappings"
down_revision = "20260911_pam_capability_dimension"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "process_pam_mappings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("process_id", sa.Integer(), nullable=False),
        sa.Column("pam_process_id", sa.Integer(), nullable=False),
        sa.Column("mapping_type", sa.String(length=30), nullable=False, server_default="PRIMARY"),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["process_id"], ["processes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["pam_process_id"], ["pam_processes.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("process_id", "pam_process_id", name="uq_process_pam_mapping"),
    )
    op.create_index("ix_process_pam_mappings_process_id", "process_pam_mappings", ["process_id"])
    op.create_index("ix_process_pam_mappings_pam_process_id", "process_pam_mappings", ["pam_process_id"])


def downgrade():
    op.drop_index("ix_process_pam_mappings_pam_process_id", table_name="process_pam_mappings")
    op.drop_index("ix_process_pam_mappings_process_id", table_name="process_pam_mappings")
    op.drop_table("process_pam_mappings")
