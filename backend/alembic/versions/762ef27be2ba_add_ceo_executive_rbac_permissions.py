"""add CEO executive RBAC permissions

Revision ID: 762ef27be2ba
Revises: 1255131dc9da
Create Date: 2026-08-25

Adds CEO-only executive reporting permissions and the CEO role.
Existing roles and permissions are preserved.
"""

from alembic import op
import sqlalchemy as sa


revision = "762ef27be2ba"
down_revision = "1255131dc9da"
branch_labels = None
depends_on = None


CEO_ROLE = "CEO"

CEO_PERMISSIONS = {
    "executive.view": "Executive Intelligence View",
    "executive.report": "Executive Reporting",
    "executive.dashboard": "Executive Dashboard",
    "ygg.view": "YGG Management Review View",
    "ygg.report": "YGG Management Review Reporting",
    "ai.dashboard": "AI Executive Dashboard",
    "ai.executive": "AI Executive Intelligence",
}


def upgrade():
    bind = op.get_bind()

    # ----------------------------------------------------------
    # CEO role
    # ----------------------------------------------------------

    bind.execute(
        sa.text(
            """
            INSERT INTO roles (
                name,
                description,
                is_active
            )
            SELECT
                :name,
                :description,
                TRUE
            WHERE NOT EXISTS (
                SELECT 1
                FROM roles
                WHERE name = :name
            )
            """
        ),
        {
            "name": CEO_ROLE,
            "description": (
                "Chief Executive Officer with exclusive "
                "access to executive intelligence, YGG, "
                "AI executive dashboards and management reporting."
            ),
        },
    )

    # ----------------------------------------------------------
    # CEO-only permissions
    # ----------------------------------------------------------

    for code, description in CEO_PERMISSIONS.items():

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

    # ----------------------------------------------------------
    # CEO -> permission matrix
    # ----------------------------------------------------------

    for permission_code in CEO_PERMISSIONS:

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
                "role_name": CEO_ROLE,
                "permission_code": permission_code,
            },
        )


def downgrade():
    bind = op.get_bind()

    # Remove only the associations created by this migration.

    bind.execute(
        sa.text(
            """
            DELETE FROM role_permissions
            WHERE role_id = (
                SELECT id
                FROM roles
                WHERE name = :role_name
            )
            AND permission_id IN (
                SELECT id
                FROM permissions
                WHERE code IN :permission_codes
            )
            """
        ),
        {
            "role_name": CEO_ROLE,
            "permission_codes": tuple(
                CEO_PERMISSIONS.keys()
            ),
        },
    )

    # Remove only CEO-specific permissions.

    bind.execute(
        sa.text(
            """
            DELETE FROM permissions
            WHERE code IN :permission_codes
            """
        ),
        {
            "permission_codes": tuple(
                CEO_PERMISSIONS.keys()
            ),
        },
    )

    # Remove CEO role only if it has no remaining assignments.

    bind.execute(
        sa.text(
            """
            DELETE FROM roles
            WHERE name = :role_name
              AND NOT EXISTS (
                  SELECT 1
                  FROM user_roles
                  WHERE user_roles.role_id = roles.id
              )
            """
        ),
        {
            "role_name": CEO_ROLE,
        },
    )
