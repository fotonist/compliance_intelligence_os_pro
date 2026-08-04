from alembic import op
import sqlalchemy as sa


revision = "4fe65f64b6b7_add_actions_table"
down_revision = "<son_revizyon_id>"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "actions",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("requirement_id", sa.Integer, sa.ForeignKey("requirements.id", ondelete="CASCADE"), nullable=False),
        sa.Column("risk_id", sa.Integer, sa.ForeignKey("risks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("owner_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="OPEN"),
        sa.Column("priority", sa.String(length=50), nullable=False, server_default="MEDIUM"),
        sa.Column("due_date", sa.Date, nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )


def downgrade():
    op.drop_table("actions")
