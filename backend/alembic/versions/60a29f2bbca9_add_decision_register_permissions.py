"""add decision register permissions

Revision ID: 60a29f2bbca9
Revises: 97314cc580f0
Create Date: 2026-08-25

Adds enterprise RBAC permissions for the Decision Register module.

This migration is intentionally data-only.
Existing permission and role-permission rows are preserved.
Missing permission rows and missing role associations are inserted
idempotently.
"""

from alembic import op
import sqlalchemy as sa


revision = "60a29f2bbca9"
down_revision = "97314cc580f0"
branch_labels = None
depends_on = None


PERMISSIONS = {
    "decision_register.view": "Decision Register View",
    "decision_register.create": "Decision Register Create",
    "decision_register.edit": "Decision Register Edit",
    "decision_register.delete": "Decision Register Delete",
    "decision_register.approve": "Decision Register Approve",
    "decision_register.manage_links": "Decision Register Relationship Management",
    "decision_register.history": "Decision Register History",
}


ROLE_MATRIX = {
    "Super Admin": tuple(PERMISSIONS.keys()),
    "SuperAdmin": tuple(PERMISSIONS.keys()),

    "Admin": (
        "decision_register.view",
        "decision_register.create",
        "decision_register.edit",
        "decision_register.delete",
        "decision_register.approve",
        "decision_register.manage_links",
        "decision_register.history",
    ),

    "ComplianceOfficer": (
        "decision_register.view",
        "decision_register.create",
        "decision_register.edit",
        "decision_register.approve",
        "decision_register.manage_links",
        "decision_register.history",
    ),

    "ControlOwner": (
        "decision_register.view",
        "decision_register.manage_links",
        "decision_register.history",
    ),

    "Auditor": (
        "decision_register.view",
        "decision_register.history",
    ),
}


def upgrade():
    bind = op.get_bind()

    # ==========================================================
    # 1. Permissions
    # ==========================================================

    for code, description in PERMISSIONS.items():
        bind.execute(
            sa.text(
                """
                INSERT INTO permissions (code, description)
                SELECT :code, :description
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

    # ==========================================================
    # 2. Role -> Permission matrix
    # ==========================================================

    for role_name, permission_codes in ROLE_MATRIX.items():
        for permission_code in permission_codes:
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
                    "role_name": role_name,
                    "permission_code": permission_code,
                },
            )


def downgrade():
    bind = op.get_bind()

    # ==========================================================
    # 1. Remove only role associations introduced by this
    #    migration.
    # ==========================================================

    for role_name, permission_codes in ROLE_MATRIX.items():
        for permission_code in permission_codes:
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
                    "role_name": role_name,
                    "permission_code": permission_code,
                },
            )

    # ==========================================================
    # 2. Remove Decision Register permissions.
    #    They are module-specific permissions introduced by this
    #    migration.
    # ==========================================================

    bind.execute(
        sa.text(
            """
            DELETE FROM permissions
            WHERE code IN :permission_codes
            """
        ),
        {
            "permission_codes": tuple(PERMISSIONS.keys()),
        },
    )
