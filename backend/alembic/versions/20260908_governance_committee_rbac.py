"""add governance committee RBAC permissions

Revision ID: 20260908_governance_committee_rbac
Revises: 20260908_governance_committee_history
Create Date: 2026-09-08

Adds enterprise RBAC permissions for the Governance Committee module.

This migration is intentionally data-only:
- no committee records
- no committee members
- no meetings
- no mock/demo data

Existing roles, permissions and role-permission associations are preserved.
Missing permission rows and missing role associations are inserted idempotently.
"""

from alembic import op
import sqlalchemy as sa


revision = "20260908_governance_committee_rbac"
down_revision = "20260908_governance_committee_history"
branch_labels = None
depends_on = None


PERMISSIONS = {
    "governance_committee.view": "Governance Committee View",
    "governance_committee.create": "Governance Committee Create",
    "governance_committee.edit": "Governance Committee Edit",
    "governance_committee.delete": "Governance Committee Delete",
    "governance_committee.manage_members": "Governance Committee Member Management",
    "governance_committee.manage_meetings": "Governance Committee Meeting Management",
    "governance_committee.history": "Governance Committee History",
}


ROLE_MATRIX = {
    "Super Admin": tuple(PERMISSIONS.keys()),
    "SuperAdmin": tuple(PERMISSIONS.keys()),
    "TenantAdmin": tuple(PERMISSIONS.keys()),

    "ComplianceManager": (
        "governance_committee.view",
        "governance_committee.create",
        "governance_committee.edit",
        "governance_committee.manage_members",
        "governance_committee.manage_meetings",
        "governance_committee.history",
    ),

    "RiskManager": (
        "governance_committee.view",
        "governance_committee.manage_meetings",
        "governance_committee.history",
    ),

    "AuditManager": (
        "governance_committee.view",
        "governance_committee.create",
        "governance_committee.edit",
        "governance_committee.manage_members",
        "governance_committee.manage_meetings",
        "governance_committee.history",
    ),

    "EvidenceManager": (
        "governance_committee.view",
        "governance_committee.manage_meetings",
        "governance_committee.history",
    ),

    "ProcessOwner": (
        "governance_committee.view",
        "governance_committee.manage_meetings",
        "governance_committee.history",
    ),

    "Reviewer": (
        "governance_committee.view",
        "governance_committee.manage_meetings",
        "governance_committee.history",
    ),

    "Contributor": (
        "governance_committee.view",
        "governance_committee.edit",
        "governance_committee.manage_members",
        "governance_committee.manage_meetings",
        "governance_committee.history",
    ),

    "Viewer": (
        "governance_committee.view",
        "governance_committee.history",
    ),

    # Legacy enterprise role retained by the deployed RBAC model.
    "Admin": tuple(PERMISSIONS.keys()),

    "ComplianceOfficer": (
        "governance_committee.view",
        "governance_committee.create",
        "governance_committee.edit",
        "governance_committee.manage_members",
        "governance_committee.manage_meetings",
        "governance_committee.history",
    ),

    "ControlOwner": (
        "governance_committee.view",
        "governance_committee.manage_meetings",
        "governance_committee.history",
    ),

    "Auditor": (
        "governance_committee.view",
        "governance_committee.history",
    ),
}


def upgrade():
    bind = op.get_bind()

    # ----------------------------------------------------------
    # 1. Permissions
    # ----------------------------------------------------------

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

    # ----------------------------------------------------------
    # 2. Role -> Permission matrix
    # ----------------------------------------------------------

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
    # Intentionally non-destructive.
    # Existing enterprise RBAC associations must not be removed.
    pass
