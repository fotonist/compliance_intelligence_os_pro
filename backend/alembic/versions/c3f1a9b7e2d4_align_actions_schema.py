"""align actions table with current action ORM

Revision ID: c3f1a9b7e2d4
Revises: 7b8d2f1a4c6e
Create Date: 2026-08-16 10:10:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "c3f1a9b7e2d4"
down_revision = "7b8d2f1a4c6e"
branch_labels = None
depends_on = None


def upgrade():
    # Production actions table is legacy and currently contains zero rows.
    # Extend it without dropping or renaming existing id/description/user_id data.
    op.add_column("actions", sa.Column("requirement_id", sa.Integer(), nullable=True))
    op.add_column("actions", sa.Column("risk_id", sa.Integer(), nullable=True))
    op.add_column("actions", sa.Column("title", sa.String(length=255), nullable=True))
    op.add_column("actions", sa.Column("status", sa.String(length=50), nullable=True, server_default="OPEN"))
    op.add_column("actions", sa.Column("priority", sa.String(length=50), nullable=True, server_default="MEDIUM"))
    op.add_column("actions", sa.Column("due_date", sa.Date(), nullable=True))
    op.add_column("actions", sa.Column("created_at", sa.DateTime(), nullable=True, server_default=sa.func.now()))
    op.add_column("actions", sa.Column("updated_at", sa.DateTime(), nullable=True, server_default=sa.func.now()))

    op.create_index("ix_actions_requirement_id", "actions", ["requirement_id"])
    op.create_index("ix_actions_risk_id", "actions", ["risk_id"])

    op.create_foreign_key(
        "fk_actions_requirement_id",
        "actions",
        "requirements",
        ["requirement_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_actions_risk_id",
        "actions",
        "risks",
        ["risk_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Existing production rows are zero, so title can safely become required.
    op.alter_column("actions", "title", nullable=False, existing_type=sa.String(length=255))
    op.alter_column("actions", "status", nullable=False, server_default=None, existing_type=sa.String(length=50))
    op.alter_column("actions", "priority", nullable=False, server_default=None, existing_type=sa.String(length=50))
    op.alter_column("actions", "created_at", nullable=False, existing_type=sa.DateTime())
    op.alter_column("actions", "updated_at", nullable=False, existing_type=sa.DateTime())


def downgrade():
    op.drop_constraint("fk_actions_risk_id", "actions", type_="foreignkey")
    op.drop_constraint("fk_actions_requirement_id", "actions", type_="foreignkey")
    op.drop_index("ix_actions_risk_id", table_name="actions")
    op.drop_index("ix_actions_requirement_id", table_name="actions")
    op.drop_column("actions", "updated_at")
    op.drop_column("actions", "created_at")
    op.drop_column("actions", "due_date")
    op.drop_column("actions", "priority")
    op.drop_column("actions", "status")
    op.drop_column("actions", "title")
    op.drop_column("actions", "risk_id")
    op.drop_column("actions", "requirement_id")
