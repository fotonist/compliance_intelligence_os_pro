"""add canonical risk owner

Revision ID: 20261006_risk_owner
Revises: 20261006_notification_idempotency
"""

from alembic import op
import sqlalchemy as sa


revision = "20261006_risk_owner"
down_revision = "20261006_notification_idempotency"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "risks",
        sa.Column(
            "owner_user_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    op.create_foreign_key(
        "fk_risks_owner_user_id_users",
        "risks",
        "users",
        ["owner_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index(
        "ix_risks_owner_user_id",
        "risks",
        ["owner_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_risks_owner_user_id",
        table_name="risks",
    )

    op.drop_constraint(
        "fk_risks_owner_user_id_users",
        "risks",
        type_="foreignkey",
    )

    op.drop_column(
        "risks",
        "owner_user_id",
    )
