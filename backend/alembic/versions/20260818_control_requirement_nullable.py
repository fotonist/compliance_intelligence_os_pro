"""Allow controls to exist independently from requirements.

Revision ID: 20260818_control_requirement_nullable
Revises: 20260817_fix_control_coverage
"""

from alembic import op
import sqlalchemy as sa


revision = "20260818_control_requirement_nullable"
down_revision = "20260817_fix_control_coverage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "controls",
        "requirement_id",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "controls",
        "requirement_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
