"""assign integration permissions to SuperAdmin

Revision ID: 20260907_assign_superadmin_integration_permissions
Revises: 20260907_integration_permissions
Create Date: 2026-09-07
"""

from alembic import op
import sqlalchemy as sa


revision = "20260907_assign_superadmin_integration_permissions"
down_revision = "20260907_integration_permissions"
branch_labels = None
depends_on = None


INTEGRATION_PERMISSIONS = (
    "integration.view",
    "integration.edit",
    "integration.test",
    "integration.sync",
)


def upgrade():
    bind = op.get_bind()

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
                WHERE r.name = 'SuperAdmin'
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
                "permission_code": permission_code,
            },
        )


def downgrade():
    pass
