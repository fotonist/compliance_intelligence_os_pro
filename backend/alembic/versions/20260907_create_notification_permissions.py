"""add notification management permissions

Revision ID: 20260907_create_notification_permissions
Revises: 20260907_create_notifications
"""

from alembic import op
import sqlalchemy as sa


revision = "20260907_create_notification_permissions"
down_revision = "20260907_create_notifications"
branch_labels = None
depends_on = None


NOTIFICATION_PERMISSIONS = {
    "notification.view": "Notification View",
    "notification.manage": "Notification Management",
}

NOTIFICATION_ROLES = (
    "SuperAdmin",
)


def upgrade():
    bind = op.get_bind()

    for code, description in NOTIFICATION_PERMISSIONS.items():
        bind.execute(
            sa.text(
                """
                INSERT INTO permissions (
                    code,
                    description
                )
                SELECT
                    :code,
                    :description
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM permissions
                    WHERE code = :code
                )
                """
            ),
            {
                "code": code,
                "description": description,
            },
        )

    for role_name in NOTIFICATION_ROLES:
        for permission_code in NOTIFICATION_PERMISSIONS:
            bind.execute(
                sa.text(
                    """
                    INSERT INTO role_permissions (
                        role_id,
                        permission_id
                    )
                    SELECT
                        r.id,
                        p.id
                    FROM roles r
                    CROSS JOIN permissions p
                    WHERE r.name = :role_name
                      AND p.code = :permission_code
                      AND NOT EXISTS (
                          SELECT 1
                          FROM role_permissions rp
                          WHERE rp.role_id = r.id
                            AND rp.permission_id = p.id
                    )
                    """
                ),
                {
                    "role_name": role_name,
                    "permission_code": permission_code,
                },
            )


def downgrade():
    pass
