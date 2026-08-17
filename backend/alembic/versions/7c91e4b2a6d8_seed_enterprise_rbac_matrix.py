"""seed enterprise RBAC roles, permissions and role matrix

Revision ID: 7c91e4b2a6d8
Revises: 43275d6db0d6
Create Date: 2026-08-17

This migration is intentionally data-only. The roles, permissions and
association tables are already part of the deployed schema/ORM. Existing
rows are preserved and missing rows are inserted idempotently.
"""

from alembic import op
import sqlalchemy as sa


revision = "7c91e4b2a6d8"
down_revision = "43275d6db0d6"
branch_labels = None
depends_on = None


ROLES = {
    "Super Admin": "Unrestricted platform administrator.",
    "SuperAdmin": "Unrestricted platform administrator.",
    "Admin": "Enterprise administrator.",
    "ComplianceOfficer": "Compliance and governance manager.",
    "ControlOwner": "Control and evidence owner.",
    "Auditor": "Audit and assurance user.",
}

PERMISSIONS = {
    "dashboard.view": "Dashboard View",
    "matrix.view": "Compliance Matrix View",
    "matrix.edit": "Compliance Matrix Edit",
    "control.view": "Control View",
    "control.edit": "Control Edit",
    "risk.view": "Risk View",
    "risk.edit": "Risk Edit",
    "evidence.view": "Evidence View",
    "evidence.edit": "Evidence Edit",
    "evidence.approve": "Evidence Approve",
    "gap.view": "Gap Intelligence",
    "readiness.view": "Executive Readiness",
    "executive.view": "Executive Intelligence",
    "analytics.view": "Analytics",
    "task.view": "Task View",
    "task.edit": "Task Edit",
    "ai.view": "AI Intelligence",
    "user.view": "User Management",
    "user.edit": "User Management Edit",
    "role.view": "Role Management",
    "role.edit": "Role Management Edit",
    "permission.view": "Permission Management",
    "permission.edit": "Permission Management Edit",
    "company.view": "Company Settings",
    "company.edit": "Company Settings Edit",
    "admin.full": "System Administrator",
}

ALL_PERMISSIONS = tuple(PERMISSIONS.keys())

ROLE_MATRIX = {
    "Super Admin": ALL_PERMISSIONS,
    "SuperAdmin": ALL_PERMISSIONS,
    "Admin": (
        "dashboard.view",
        "matrix.view", "matrix.edit",
        "control.view", "control.edit",
        "risk.view", "risk.edit",
        "evidence.view", "evidence.edit", "evidence.approve",
        "gap.view", "readiness.view", "executive.view", "analytics.view",
        "task.view", "task.edit", "ai.view",
        "user.view", "user.edit",
        "role.view", "role.edit",
        "permission.view", "permission.edit",
        "company.view", "company.edit",
    ),
    "ComplianceOfficer": (
        "dashboard.view",
        "matrix.view",
        "control.view", "control.edit",
        "risk.view", "risk.edit",
        "evidence.view", "evidence.edit", "evidence.approve",
        "gap.view", "readiness.view", "executive.view", "analytics.view",
        "task.view", "task.edit", "ai.view",
    ),
    "ControlOwner": (
        "dashboard.view",
        "matrix.view",
        "control.view", "control.edit",
        "risk.view",
        "evidence.view", "evidence.edit",
        "gap.view",
        "task.view", "task.edit",
    ),
    "Auditor": (
        "dashboard.view",
        "matrix.view",
        "control.view",
        "risk.view",
        "evidence.view",
        "gap.view",
        "readiness.view",
        "executive.view",
        "analytics.view",
        "task.view",
    ),
}


def upgrade():
    bind = op.get_bind()

    # ------------------------------------------------------------------
    # Roles: insert only missing roles; never rename/delete existing roles.
    # ------------------------------------------------------------------
    for name, description in ROLES.items():
        bind.execute(
            sa.text(
                """
                INSERT INTO roles (name, description, is_active)
                SELECT :name, :description, TRUE
                WHERE NOT EXISTS (
                    SELECT 1 FROM roles WHERE name = :name
                )
                """
            ),
            {"name": name, "description": description},
        )

    # ------------------------------------------------------------------
    # Permissions: insert only missing permission codes.
    # ------------------------------------------------------------------
    for code, description in PERMISSIONS.items():
        bind.execute(
            sa.text(
                """
                INSERT INTO permissions (code, description)
                SELECT :code, :description
                WHERE NOT EXISTS (
                    SELECT 1 FROM permissions WHERE code = :code
                )
                """
            ),
            {"code": code, "description": description},
        )

    # ------------------------------------------------------------------
    # Role -> Permission matrix. Existing associations are preserved.
    # ------------------------------------------------------------------
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
    # Data migration is intentionally non-destructive. Existing enterprise
    # roles/permissions may be used by tenants and must not be removed.
    pass
