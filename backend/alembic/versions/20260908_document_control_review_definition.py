"""add governance procedure review definition

Revision ID: 20260908_document_control_review_definition
Revises: 20260907_create_notification_permissions
Create Date: 2026-09-08
"""

from alembic import op
import sqlalchemy as sa


revision = "20260908_document_control_review_definition"
down_revision = "20260907_create_notification_permissions"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "governance_procedures",
        sa.Column(
            "review_definition",
            sa.String(length=50),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column(
        "governance_procedures",
        "review_definition",
    )