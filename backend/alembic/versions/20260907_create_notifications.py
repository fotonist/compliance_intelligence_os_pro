"""create notification management tables

Revision ID: 20260907_create_notifications
Revises: 20260907_assign_superadmin_integration_permissions
"""

from alembic import op
import sqlalchemy as sa


revision = "20260907_create_notifications"
down_revision = "20260907_assign_superadmin_integration_permissions"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "recipient_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False, server_default="INFO"),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=True),
        sa.Column("entity_id", sa.Integer(), nullable=True),
        sa.Column("action_url", sa.String(length=500), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "ix_notifications_tenant_id",
        "notifications",
        ["tenant_id"],
    )
    op.create_index(
        "ix_notifications_recipient_user_id",
        "notifications",
        ["recipient_user_id"],
    )
    op.create_index(
        "ix_notifications_category",
        "notifications",
        ["category"],
    )
    op.create_index(
        "ix_notifications_severity",
        "notifications",
        ["severity"],
    )
    op.create_index(
        "ix_notifications_entity_type",
        "notifications",
        ["entity_type"],
    )
    op.create_index(
        "ix_notifications_entity_id",
        "notifications",
        ["entity_id"],
    )
    op.create_index(
        "ix_notifications_is_read",
        "notifications",
        ["is_read"],
    )
    op.create_index(
        "ix_notifications_created_at",
        "notifications",
        ["created_at"],
    )

    op.create_table(
        "notification_deliveries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "notification_id",
            sa.Integer(),
            sa.ForeignKey("notifications.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("channel", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="PENDING"),
        sa.Column("provider", sa.String(length=50), nullable=True),
        sa.Column("provider_message_id", sa.String(length=255), nullable=True),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_attempt_at", sa.DateTime(), nullable=True),
        sa.Column("delivered_at", sa.DateTime(), nullable=True),
        sa.Column("failed_at", sa.DateTime(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "ix_notification_deliveries_notification_id",
        "notification_deliveries",
        ["notification_id"],
    )
    op.create_index(
        "ix_notification_deliveries_status",
        "notification_deliveries",
        ["status"],
    )

    op.create_unique_constraint(
        "uq_notification_delivery_channel",
        "notification_deliveries",
        ["notification_id", "channel"],
    )

    op.create_table(
        "notification_preferences",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("channel", sa.String(length=20), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "ix_notification_preferences_tenant_id",
        "notification_preferences",
        ["tenant_id"],
    )
    op.create_index(
        "ix_notification_preferences_user_id",
        "notification_preferences",
        ["user_id"],
    )
    op.create_index(
        "ix_notification_preferences_category",
        "notification_preferences",
        ["category"],
    )

    op.create_unique_constraint(
        "uq_notification_preference_user_category_channel",
        "notification_preferences",
        ["user_id", "category", "channel"],
    )


def downgrade():
    op.drop_constraint(
        "uq_notification_preference_user_category_channel",
        "notification_preferences",
        type_="unique",
    )

    op.drop_index(
        "ix_notification_preferences_category",
        table_name="notification_preferences",
    )
    op.drop_index(
        "ix_notification_preferences_user_id",
        table_name="notification_preferences",
    )
    op.drop_index(
        "ix_notification_preferences_tenant_id",
        table_name="notification_preferences",
    )

    op.drop_table("notification_preferences")

    op.drop_constraint(
        "uq_notification_delivery_channel",
        "notification_deliveries",
        type_="unique",
    )

    op.drop_index(
        "ix_notification_deliveries_status",
        table_name="notification_deliveries",
    )
    op.drop_index(
        "ix_notification_deliveries_notification_id",
        table_name="notification_deliveries",
    )

    op.drop_table("notification_deliveries")

    op.drop_index(
        "ix_notifications_created_at",
        table_name="notifications",
    )
    op.drop_index(
        "ix_notifications_is_read",
        table_name="notifications",
    )
    op.drop_index(
        "ix_notifications_entity_id",
        table_name="notifications",
    )
    op.drop_index(
        "ix_notifications_entity_type",
        table_name="notifications",
    )
    op.drop_index(
        "ix_notifications_severity",
        table_name="notifications",
    )
    op.drop_index(
        "ix_notifications_category",
        table_name="notifications",
    )
    op.drop_index(
        "ix_notifications_recipient_user_id",
        table_name="notifications",
    )
    op.drop_index(
        "ix_notifications_tenant_id",
        table_name="notifications",
    )

    op.drop_table("notifications")
