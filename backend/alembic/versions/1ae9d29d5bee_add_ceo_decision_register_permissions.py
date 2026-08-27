"""add CEO decision register permissions

Revision ID: 1ae9d29d5bee
Revises: 60a29f2bbca9
Create Date: 2026-08-25

Adds Decision Register permissions to the existing CEO role.

This migration is intentionally data-only and idempotent.
Existing permission and role-permission rows are preserved.
"""

from alembic import op
import sqlalchemy as sa


revision = "1ae9d29d5bee"
down_revision = "60a29f2bbca9"
branch_labels = None
depends_on = None


CEO_PERMISSIONS = (
    "decision_register.view",
    "decision_register.approve",
    "decision_register.history",
)


def upgrade():
    bind = op.get_bind()

    for permission_code in CEO_PERMISSIONS:
        bind.execute(
            sa.text(
                """
                INSERT INTO role_permissions (role_id, permission_id)
                SELECT r.id, p.id
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
                "role_name": "CEO",
                "permission_code": permission_code,
            },
        )


def downgrade():
    bind = op.get_bind()

    for permission_code in CEO_PERMISSIONS:
        bind.execute(
            sa.text(
                """
                DELETE FROM role_permissions
                WHERE role_id IN (
                    SELECT id
                    FROM roles
                    WHERE name = :role_name
                )
                AND permission_id IN (
                    SELECT id
                    FROM permissions
                    WHERE code = :permission_code
                )
                """
            ),
            {
                "role_name": "CEO",
                "permission_code": permission_code,
            },
        )
