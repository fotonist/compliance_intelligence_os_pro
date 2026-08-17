"""complete enterprise RBAC role matrix

Revision ID: 8d4f1c7a9b2e
Revises: 7c91e4b2a6d8
Create Date: 2026-08-17

Adds the remaining enterprise roles to the already-seeded RBAC model.
Existing roles, permissions and associations are preserved.
"""

from alembic import op
import sqlalchemy as sa


revision = "8d4f1c7a9b2e"
down_revision = "7c91e4b2a6d8"
branch_labels = None
depends_on = None


ROLES = {
    "TenantAdmin": "Tenant-level administrator.",
    "ComplianceManager": "Compliance management and governance owner.",
    "RiskManager": "Risk management owner.",
    "AuditManager": "Internal audit management owner.",
    "EvidenceManager": "Evidence lifecycle and approval owner.",
    "ProcessOwner": "Process and operational control owner.",
    "Reviewer": "Independent review and assurance user.",
    "Contributor": "Operational contributor.",
    "Viewer": "Read-only platform user.",
}

ROLE_MATRIX = {
    "TenantAdmin": (
        "dashboard.view",
        "matrix.view", "matrix.edit",
        "control.view", "control.edit",
        "risk.view", "risk.edit",
        "evidence.view", "evidence.edit", "evidence.approve",
        "gap.view", "readiness.view", "executive.view", "analytics.view",
        "task.view", "task.edit", "ai.view",
        "user.view", "user.edit",
        "role.view", "role.edit",
        "company.view", "company.edit",
    ),
    "ComplianceManager": (
        "dashboard.view",
        "matrix.view", "matrix.edit",
        "control.view", "control.edit",
        "risk.view", "risk.edit",
        "evidence.view", "evidence.edit", "evidence.approve",
        "gap.view", "readiness.view", "executive.view", "analytics.view",
        "task.view", "task.edit", "ai.view",
    ),
    "RiskManager": (
        "dashboard.view",
        "matrix.view",
        "control.view",
        "risk.view", "risk.edit",
        "evidence.view",
        "gap.view", "readiness.view", "analytics.view",
        "task.view", "task.edit",
    ),
    "AuditManager": (
        "dashboard.view",
        "matrix.view",
        "control.view",
        "risk.view",
        "evidence.view", "evidence.approve",
        "gap.view", "readiness.view", "executive.view", "analytics.view",
        "task.view", "task.edit",
    ),
    "EvidenceManager": (
        "dashboard.view",
        "matrix.view",
        "control.view",
        "risk.view",
        "evidence.view", "evidence.edit", "evidence.approve",
        "gap.view",
        "task.view", "task.edit",
    ),
    "ProcessOwner": (
        "dashboard.view",
        "matrix.view",
        "control.view", "control.edit",
        "risk.view",
        "evidence.view", "evidence.edit",
        "gap.view",
        "task.view", "task.edit",
    ),
    "Reviewer": (
        "dashboard.view",
        "matrix.view",
        "control.view",
        "risk.view",
        "evidence.view",
        "gap.view", "readiness.view", "analytics.view",
        "task.view",
    ),
    "Contributor": (
        "dashboard.view",
        "matrix.view",
        "control.view",
        "risk.view",
        "evidence.view", "evidence.edit",
        "task.view", "task.edit",
    ),
    "Viewer": (
        "dashboard.view",
        "matrix.view",
        "control.view",
        "risk.view",
        "evidence.view",
        "gap.view", "readiness.view", "executive.view", "analytics.view",
        "task.view",
    ),
}


def upgrade():
    bind = op.get_bind()

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
    pass
