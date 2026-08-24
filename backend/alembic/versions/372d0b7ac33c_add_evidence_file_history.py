"""add evidence file history

Revision ID: 372d0b7ac33c
Revises: 72e67c309203
Create Date: 2026-08-23 15:10:11.614505
"""

from alembic import op
import sqlalchemy as sa


revision = "372d0b7ac33c"
down_revision = "72e67c309203"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "evidence_file_history",
        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "evidence_file_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "action",
            sa.String(length=50),
            nullable=False,
        ),
        sa.Column(
            "old_status",
            sa.String(length=50),
            nullable=True,
        ),
        sa.Column(
            "new_status",
            sa.String(length=50),
            nullable=True,
        ),
        sa.Column(
            "comment",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "performed_by",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["evidence_file_id"],
            ["evidence_files.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["performed_by"],
            ["users.id"],
            ondelete="SET NULL",
        ),
    )

    op.create_index(
        "ix_evidence_file_history_id",
        "evidence_file_history",
        ["id"],
    )

    op.create_index(
        "ix_evidence_file_history_evidence_file_id",
        "evidence_file_history",
        ["evidence_file_id"],
    )

    op.create_index(
        "ix_evidence_file_history_performed_by",
        "evidence_file_history",
        ["performed_by"],
    )


def downgrade():
    op.drop_index(
        "ix_evidence_file_history_performed_by",
        table_name="evidence_file_history",
    )

    op.drop_index(
        "ix_evidence_file_history_evidence_file_id",
        table_name="evidence_file_history",
    )

    op.drop_index(
        "ix_evidence_file_history_id",
        table_name="evidence_file_history",
    )

    op.drop_table("evidence_file_history")