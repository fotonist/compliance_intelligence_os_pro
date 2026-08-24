"""add evidence file lifecycle fields

Revision ID: d348d0458aee
Revises: 372d0b7ac33c
Create Date: 2026-08-23 16:05:12.213810
"""

from alembic import op
import sqlalchemy as sa


revision = "d348d0458aee"
down_revision = "372d0b7ac33c"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "evidence_files",
        sa.Column("rejected_by", sa.Integer(), nullable=True),
    )

    op.add_column(
        "evidence_files",
        sa.Column("archive_path", sa.String(), nullable=True),
    )

    op.add_column(
        "evidence_files",
        sa.Column("archived_at", sa.DateTime(), nullable=True),
    )

    op.create_foreign_key(
        "fk_evidence_files_rejected_by_users",
        "evidence_files",
        "users",
        ["rejected_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade():
    op.drop_constraint(
        "fk_evidence_files_rejected_by_users",
        "evidence_files",
        type_="foreignkey",
    )

    op.drop_column("evidence_files", "archived_at")
    op.drop_column("evidence_files", "archive_path")
    op.drop_column("evidence_files", "rejected_by")
