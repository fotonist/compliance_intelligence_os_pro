"""add governance approval RBAC permissions

Revision ID: 20260908_governance_approval_rbac
Revises: 20260908_governance_approvals
Create Date: 2026-09-08
"""

from alembic import op
import sqlalchemy as sa


revision = "20260908_governance_approval_rbac"
down_revision = "20260908_governance_approvals"
branch_labels = None
depends_on = None


PERMISSIONS = {
    "governance_approval.view": "Governance Approval View",
    "governance_approval.create": "Governance Approval Create",
    "governance_approval.edit": "Governance Approval Edit",
    "governance_approval.delete": "Governance Approval Delete",
    "governance_approval.history": "Governance Approval History",
}


ROLE_MATRIX = {
    "Super Admin": tuple(PERMISSIONS.keys()),
    "SuperAdmin": tuple(PERMISSIONS.keys()),
}


def upgrade():
    bind = op.get_bind()

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
