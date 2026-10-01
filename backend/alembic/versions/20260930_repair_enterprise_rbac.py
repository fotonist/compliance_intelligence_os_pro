"""repair missing enterprise RBAC reference data

Revision ID: 20260930_repair_enterprise_rbac
Revises: 20260930_split_pa_eval_unique
Create Date: 2026-09-30

Restores missing canonical enterprise roles and their historical
role-permission associations.

The migration is intentionally idempotent and non-destructive:
- existing roles are preserved;
- existing permissions are preserved;
- existing role-permission associations are preserved;
- user-role assignments are not modified.
"""

from alembic import op
import sqlalchemy as sa


revision = "20260930_repair_enterprise_rbac"
down_revision = "20260930_split_pa_eval_unique"
branch_labels = None
depends_on = None


ROLES = {
    "Admin": "Enterprise administrator.",
    "ComplianceOfficer": "Compliance and governance manager.",
    "ControlOwner": "Control and evidence owner.",
    "Auditor": "Audit and assurance user.",
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
    "Admin": (
        "dashboard.view",
        "matrix.view",
        "matrix.edit",
        "control.view",
        "control.edit",
        "risk.view",
        "risk.edit",
        "evidence.view",
        "evidence.edit",
        "evidence.approve",
        "gap.view",
        "readiness.view",
        "executive.view",
        "analytics.view",
        "task.view",
        "task.edit",
        "ai.view",
        "user.view",
        "user.edit",
        "role.view",
        "role.edit",
        "permission.view",
        "permission.edit",
        "company.view",
        "company.edit",
    ),
    "ComplianceOfficer": (
        "dashboard.view",
        "matrix.view",
        "control.view",
        "control.edit",
        "risk.view",
        "risk.edit",
        "evidence.view",
        "evidence.edit",
        "evidence.approve",
        "gap.view",
        "readiness.view",
        "executive.view",
        "analytics.view",
        "task.view",
        "task.edit",
        "ai.view",
    ),
    "ControlOwner": (
        "dashboard.view",
        "matrix.view",
        "control.view",
        "control.edit",
        "risk.view",
        "evidence.view",
        "evidence.edit",
        "gap.view",
        "task.view",
        "task.edit",
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
    "TenantAdmin": (
        "dashboard.view",
        "matrix.view",
        "matrix.edit",
        "control.view",
        "control.edit",
        "risk.view",
        "risk.edit",
        "evidence.view",
        "evidence.edit",
        "evidence.approve",
        "gap.view",
        "readiness.view",
        "executive.view",
        "analytics.view",
        "task.view",
        "task.edit",
        "ai.view",
        "user.view",
        "user.edit",
        "role.view",
        "role.edit",
        "company.view",
        "company.edit",
    ),
    "ComplianceManager": (
        "dashboard.view",
        "matrix.view",
        "matrix.edit",
        "control.view",
        "control.edit",
        "risk.view",
        "risk.edit",
        "evidence.view",
        "evidence.edit",
        "evidence.approve",
        "gap.view",
        "readiness.view",
        "executive.view",
        "analytics.view",
        "task.view",
        "task.edit",
        "ai.view",
    ),
    "RiskManager": (
        "dashboard.view",
        "matrix.view",
        "control.view",
        "risk.view",
        "risk.edit",
        "evidence.view",
        "gap.view",
        "readiness.view",
        "analytics.view",
        "task.view",
        "task.edit",
    ),
    "AuditManager": (
        "dashboard.view",
        "matrix.view",
        "control.view",
        "risk.view",
        "evidence.view",
        "evidence.approve",
        "gap.view",
        "readiness.view",
        "executive.view",
        "analytics.view",
        "task.view",
        "task.edit",
    ),
    "EvidenceManager": (
        "dashboard.view",
        "matrix.view",
        "control.view",
        "risk.view",
        "evidence.view",
        "evidence.edit",
        "evidence.approve",
        "gap.view",
        "task.view",
        "task.edit",
    ),
    "ProcessOwner": (
        "dashboard.view",
        "matrix.view",
        "control.view",
        "control.edit",
        "risk.view",
        "evidence.view",
        "evidence.edit",
        "gap.view",
        "task.view",
        "task.edit",
    ),
    "Reviewer": (
        "dashboard.view",
        "matrix.view",
        "control.view",
        "risk.view",
        "evidence.view",
        "gap.view",
        "readiness.view",
        "analytics.view",
        "task.view",
    ),
    "Contributor": (
        "dashboard.view",
        "matrix.view",
        "control.view",
        "risk.view",
        "evidence.view",
        "evidence.edit",
        "task.view",
        "task.edit",
    ),
    "Viewer": (
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

    for name, description in ROLES.items():
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
                "name": name,
                "description": description,
            },
        )

    for role_name, permission_codes in ROLE_MATRIX.items():
        for permission_code in permission_codes:
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
    # Intentionally non-destructive.
    # Restored RBAC reference data may already be assigned to users.
    pass
