"""add matrix_instances table

Revision ID: 9f4b1c2e7a01
Revises: 336472c6225c
Create Date: 2026-01-29
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "9f4b1c2e7a01"
down_revision = "336472c6225c"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "matrix_instances",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "standard_version_id",
            sa.Integer(),
            sa.ForeignKey("standard_versions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=32),
            nullable=False,
            server_default="generated",
        ),
        sa.Column(
            "created_by",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_matrix_instances_standard_version_id",
        "matrix_instances",
        ["standard_version_id"],
    )


def downgrade():
    op.drop_index(
        "ix_matrix_instances_standard_version_id",
        table_name="matrix_instances",
    )
    op.drop_table("matrix_instances")
