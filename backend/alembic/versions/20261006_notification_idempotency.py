"""add notification idempotency

Revision ID: 20261006_notification_idempotency
Revises: f12gapremediation
"""

from alembic import op
import sqlalchemy as sa


revision = "20261006_notification_idempotency"
down_revision = "f12gapremediation"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "notifications",
        sa.Column(
            "idempotency_key",
            sa.String(length=255),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_notifications_idempotency_key",
        "notifications",
        ["idempotency_key"],
        unique=False,
    )

    op.create_unique_constraint(
        "uq_notifications_tenant_recipient_idempotency",
        "notifications",
        [
            "tenant_id",
            "recipient_user_id",
            "idempotency_key",
        ],
    )


def downgrade():
    op.drop_constraint(
        "uq_notifications_tenant_recipient_idempotency",
        "notifications",
        type_="unique",
    )

    op.drop_index(
        "ix_notifications_idempotency_key",
        table_name="notifications",
    )

    op.drop_column(
        "notifications",
        "idempotency_key",
    )