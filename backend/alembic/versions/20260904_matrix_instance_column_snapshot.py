"""add column snapshot to matrix instances

Revision ID: 20260904_matrix_instance_column_snapshot
Revises: 20260903_framework_adoption
Create Date: 2026-09-04
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260904_matrix_instance_column_snapshot"
down_revision = "20260903_framework_adoption"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "matrix_instances",
        sa.Column(
            "column_snapshot",
            postgresql.JSONB(),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column(
        "matrix_instances",
        "column_snapshot",
    )
