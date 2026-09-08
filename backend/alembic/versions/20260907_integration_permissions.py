"""add enterprise integration permissions

Revision ID: 20260907_integration_permissions
Revises: 20260906_action_lifecycle
Create Date: 2026-09-07

Adds integration management permissions and assigns them to
enterprise administration roles.
Existing roles, permissions and associations are preserved.
"""

from alembic import op
import sqlalchemy as sa


revision = "20260907_integration_permissions"
down_revision = "20260906_action_lifecycle"
branch_labels = None
depends_on = None


INTEGRATION_PERMISSIONS = {
    "integration.view": "Integration View",
    "integration.edit": "Integration Management Edit",
    "integration.test": "Integration Connection Test",
    "integration.sync": "Integration Task Sync",
}


INTEGRATION_ROLES = (
    "Admin",
    "TenantAdmin",
)


def upgrade():
    bind = op.get_bind()

    for code, description in INTEGRATION_PERMISSIONS.items():
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

    for role_name in INTEGRATION_ROLES:
        for permission_code in INTEGRATION_PERMISSIONS:
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
