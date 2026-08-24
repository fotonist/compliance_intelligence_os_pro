"""add governance document history

Revision ID: 72e67c309203
Revises: 5686b206c979
Create Date: 2026-08-23 14:08:08.963730
"""

from alembic import op
import sqlalchemy as sa


revision = "72e67c309203"
down_revision = "5686b206c979"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "governance_document_history",
        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
        ),
        sa.Column(
            "document_id",
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
            sa.String(length=2000),
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
            ["document_id"],
            ["governance_procedure_documents.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["performed_by"],
            ["users.id"],
            ondelete="SET NULL",
        ),
    )


def downgrade():
    op.drop_table("governance_document_history")