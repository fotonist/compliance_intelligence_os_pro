"""add change reason to risk history

Revision ID: b7c4d9e2f801
Revises: 50e8b05393c4
Create Date: 2026-08-22
"""

from alembic import op
import sqlalchemy as sa


revision = "b7c4d9e2f801"
down_revision = "50e8b05393c4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "risk_history",
        sa.Column(
            "change_reason",
            sa.Text(),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column(
        "risk_history",
        "change_reason",
    )