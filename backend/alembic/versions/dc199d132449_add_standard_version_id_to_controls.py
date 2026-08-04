"""add standard_version_id to controls

Revision ID: dc199d132449
Revises: 024f475f731c
Create Date: 2026-01-27 19:50:18.233331
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "dc199d132449"
down_revision = "024f475f731c"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "controls",
        sa.Column(
            "standard_version_id",
            sa.Integer(),
            sa.ForeignKey("standard_versions.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_controls_standard_version_id",
        "controls",
        ["standard_version_id"],
    )


def downgrade():
    op.drop_index(
        "ix_controls_standard_version_id",
        table_name="controls",
    )
    op.drop_column("controls", "standard_version_id")
