"""Add risk–evidence link table"""

from alembic import op
import sqlalchemy as sa

# This migration MUST come after: add_is_deleted_to_evidences
revision = "c8a12fdf8f15"
down_revision = "740b093cdd63"   # IMPORTANT: Correct chain
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "risk_evidence_link",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("risk_id", sa.Integer, sa.ForeignKey("risks.id", ondelete="CASCADE")),
        sa.Column("evidence_id", sa.Integer, sa.ForeignKey("evidences.id", ondelete="CASCADE")),
    )


def downgrade():
    op.drop_table("risk_evidence_link")
