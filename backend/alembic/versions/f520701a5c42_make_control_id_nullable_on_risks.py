"""make control_id nullable on risks

Revision ID: f520701a5c42
Revises: c8a12fdf8f15
Create Date: 2025-12-13 07:31:56.890159
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "f520701a5c42"
down_revision = "c8a12fdf8f15"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "risks",
        "control_id",
        existing_type=sa.Integer(),
        nullable=True
    )


def downgrade():
    op.alter_column(
        "risks",
        "control_id",
        existing_type=sa.Integer(),
        nullable=False
    )
