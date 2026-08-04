"""Add is_deleted column to evidences"""

from alembic import op
import sqlalchemy as sa

revision = "740b093cdd63"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "evidences",
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false")
    )


def downgrade():
    op.drop_column("evidences", "is_deleted")
