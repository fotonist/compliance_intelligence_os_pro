"""add governance meeting RBAC permissions

Revision ID: 20260828_governance_meeting_rbac
Revises: 20260828_governance_meetings
Create Date: 2026-08-28

Adds enterprise RBAC permissions for the Governance Meeting module.

This migration is intentionally data-only:
- no meeting records
- no participants
- no agenda items
- no decisions
- no actions
- no mock/demo data

Existing roles, permissions and role-permission associations are preserved.
Missing permission rows and missing role associations are inserted idempotently.
"""

from alembic import op
import sqlalchemy as sa


revision = "20260828_governance_meeting_rbac"
down_revision = "20260828_governance_meetings"
branch_labels = None
depends_on = None


PERMISSIONS = {
    "governance_meeting.view": "Governance Meeting View",
    "governance_meeting.create": "Governance Meeting Create",
    "governance_meeting.edit": "Governance Meeting Edit",
    "governance_meeting.delete": "Governance Meeting Delete",
    "governance_meeting.manage_participants": "Governance Meeting Participant Management",
    "governance_meeting.manage_agenda": "Governance Meeting Agenda Management",
    "governance_meeting.manage_decisions": "Governance Meeting Decision Management",
    "governance_meeting.manage_actions": "Governance Meeting Action Management",
    "governance_meeting.history": "Governance Meeting History",
}


ROLE_MATRIX = {
    "Super Admin": tuple(PERMISSIONS.keys()),
    "SuperAdmin": tuple(PERMISSIONS.keys()),

    "TenantAdmin": tuple(PERMISSIONS.keys()),

    "ComplianceManager": (
        "governance_meeting.view",
        "governance_meeting.create",
        "governance_meeting.edit",
        "governance_meeting.manage_participants",
        "governance_meeting.manage_agenda",
        "governance_meeting.manage_decisions",
        "governance_meeting.manage_actions",
        "governance_meeting.history",
    ),

    "RiskManager": (
        "governance_meeting.view",
        "governance_meeting.manage_decisions",
        "governance_meeting.manage_actions",
        "governance_meeting.history",
    ),

    "AuditManager": (
        "governance_meeting.view",
        "governance_meeting.create",
        "governance_meeting.edit",
        "governance_meeting.manage_participants",
        "governance_meeting.manage_agenda",
        "governance_meeting.manage_decisions",
        "governance_meeting.manage_actions",
        "governance_meeting.history",
    ),

    "EvidenceManager": (
        "governance_meeting.view",
        "governance_meeting.manage_actions",
        "governance_meeting.history",
    ),

    "ProcessOwner": (
        "governance_meeting.view",
        "governance_meeting.manage_agenda",
        "governance_meeting.manage_decisions",
        "governance_meeting.manage_actions",
        "governance_meeting.history",
    ),

    "Reviewer": (
        "governance_meeting.view",
        "governance_meeting.manage_decisions",
        "governance_meeting.manage_actions",
        "governance_meeting.history",
    ),

    "Contributor": (
        "governance_meeting.view",
        "governance_meeting.edit",
        "governance_meeting.manage_agenda",
        "governance_meeting.manage_actions",
        "governance_meeting.history",
    ),

    "Viewer": (
        "governance_meeting.view",
        "governance_meeting.history",
    ),

    # Legacy enterprise roles retained by the deployed RBAC model.
    "Admin": tuple(PERMISSIONS.keys()),

    "ComplianceOfficer": (
        "governance_meeting.view",
        "governance_meeting.create",
        "governance_meeting.edit",
        "governance_meeting.manage_participants",
        "governance_meeting.manage_agenda",
        "governance_meeting.manage_decisions",
        "governance_meeting.manage_actions",
        "governance_meeting.history",
    ),

    "ControlOwner": (
        "governance_meeting.view",
        "governance_meeting.manage_agenda",
        "governance_meeting.manage_actions",
        "governance_meeting.history",
    ),

    "Auditor": (
        "governance_meeting.view",
        "governance_meeting.history",
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
