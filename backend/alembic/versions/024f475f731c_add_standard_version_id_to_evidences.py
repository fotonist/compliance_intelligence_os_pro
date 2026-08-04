"""add standard_version_id to evidences

Revision ID: 024f475f731c
Revises: a9fdd4e7b6e0
Create Date: 2026-01-27
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "024f475f731c"
down_revision = "a9fdd4e7b6e0"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "evidences",
        sa.Column(
            "standard_version_id",
            sa.Integer(),
            sa.ForeignKey("standard_versions.id", ondelete="CASCADE"),
            nullable=True,  # geçici
        ),
    )

    op.create_index(
        "ix_evidences_standard_version_id",
        "evidences",
        ["standard_version_id"],
    )


def downgrade():
    op.drop_index(
        "ix_evidences_standard_version_id",
        table_name="evidences",
    )
    op.drop_column("evidences", "standard_version_id")
