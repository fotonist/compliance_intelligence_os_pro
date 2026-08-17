"""add findings permissions and intelligence analytics

Revision ID: 9e2b7c4d1f60
Revises: 8d4f1c7a9b2e
Create Date: 2026-08-17

Adds finding/capa/verification permissions and exposes audit-finding
intelligence metrics through the analytics schema. Existing data is
preserved; no finding records are modified.
"""

from alembic import op
import sqlalchemy as sa

revision = "9e2b7c4d1f60"
down_revision = "8d4f1c7a9b2e"
branch_labels = None
depends_on = None

PERMISSIONS = {
    "finding.view": "Audit Finding View",
    "finding.create": "Audit Finding Create",
    "finding.edit": "Audit Finding Edit",
    "finding.assign": "Audit Finding Assign",
    "finding.verify": "Audit Finding Verify",
    "finding.close": "Audit Finding Close",
    "capa.view": "Corrective Action Plan View",
    "capa.edit": "Corrective Action Plan Edit",
    "capa.approve": "Corrective Action Plan Approve",
    "verification.view": "Finding Verification View",
    "verification.execute": "Finding Verification Execute",
}

ROLE_MATRIX = {
    "Super Admin": tuple(PERMISSIONS),
    "SuperAdmin": tuple(PERMISSIONS),
    "TenantAdmin": tuple(PERMISSIONS),
    "ComplianceManager": tuple(PERMISSIONS),
    "AuditManager": tuple(PERMISSIONS),
    "Auditor": (
        "finding.view",
        "finding.create",
        "finding.edit",
        "finding.assign",
        "finding.verify",
        "capa.view",
        "capa.edit",
        "verification.view",
        "verification.execute",
    ),
    "Reviewer": (
        "finding.view",
        "finding.verify",
        "capa.view",
        "verification.view",
        "verification.execute",
    ),
    "ProcessOwner": (
        "finding.view",
        "finding.edit",
        "finding.assign",
        "capa.view",
        "capa.edit",
        "verification.view",
    ),
    "ControlOwner": (
        "finding.view",
        "finding.edit",
        "capa.view",
        "capa.edit",
    ),
    "EvidenceManager": (
        "finding.view",
        "capa.view",
        "verification.view",
    ),
    "RiskManager": (
        "finding.view",
        "capa.view",
    ),
    "Contributor": (
        "finding.view",
        "finding.edit",
        "capa.view",
        "capa.edit",
    ),
    "Viewer": (
        "finding.view",
        "capa.view",
        "verification.view",
    ),
    "ComplianceOfficer": tuple(PERMISSIONS),
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
                    SELECT 1 FROM permissions WHERE code = :code
                )
                """
            ),
            {"code": code, "description": description},
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
                {"role_name": role_name, "permission_code": permission_code},
            )

    op.execute("""
        CREATE OR REPLACE VIEW analytics.v_finding_intelligence AS
        SELECT
            afr.tenant_id,
            COUNT(*) AS total_findings,
            COUNT(*) FILTER (
                WHERE UPPER(COALESCE(afr.status, '')) NOT IN
                    ('CLOSED', 'VERIFIED', 'RESOLVED')
            ) AS open_findings,
            COUNT(*) FILTER (
                WHERE UPPER(COALESCE(afr.severity, '')) = 'CRITICAL'
                  AND UPPER(COALESCE(afr.status, '')) NOT IN
                    ('CLOSED', 'VERIFIED', 'RESOLVED')
            ) AS open_critical_findings,
            COUNT(*) FILTER (
                WHERE UPPER(COALESCE(afr.severity, '')) = 'HIGH'
                  AND UPPER(COALESCE(afr.status, '')) NOT IN
                    ('CLOSED', 'VERIFIED', 'RESOLVED')
            ) AS open_high_findings,
            COUNT(*) FILTER (
                WHERE UPPER(COALESCE(afr.severity, '')) = 'MEDIUM'
                  AND UPPER(COALESCE(afr.status, '')) NOT IN
                    ('CLOSED', 'VERIFIED', 'RESOLVED')
            ) AS open_medium_findings,
            COUNT(*) FILTER (
                WHERE UPPER(COALESCE(afr.severity, '')) = 'LOW'
                  AND UPPER(COALESCE(afr.status, '')) NOT IN
                    ('CLOSED', 'VERIFIED', 'RESOLVED')
            ) AS open_low_findings,
            COUNT(*) FILTER (
                WHERE UPPER(COALESCE(afr.manager_review_status, '')) IN
                    ('PENDING', 'SUBMITTED', 'IN_REVIEW')
            ) AS pending_manager_reviews,
            COUNT(*) FILTER (
                WHERE UPPER(COALESCE(afr.verification_status, '')) IN
                    ('READY', 'PENDING', 'NOT_READY')
                  AND UPPER(COALESCE(afr.status, '')) NOT IN
                    ('CLOSED', 'VERIFIED', 'RESOLVED')
            ) AS pending_verifications,
            COALESCE(SUM(
                CASE
                    WHEN UPPER(COALESCE(afr.status, '')) IN
                        ('CLOSED', 'VERIFIED', 'RESOLVED') THEN 0
                    WHEN UPPER(COALESCE(afr.severity, '')) = 'CRITICAL' THEN 4
                    WHEN UPPER(COALESCE(afr.severity, '')) = 'HIGH' THEN 3
                    WHEN UPPER(COALESCE(afr.severity, '')) = 'MEDIUM' THEN 2
                    WHEN UPPER(COALESCE(afr.severity, '')) = 'LOW' THEN 1
                    ELSE 1
                END
            ), 0) AS open_finding_pressure
        FROM audit_finding_records afr
        GROUP BY afr.tenant_id;
    """)

    op.execute("""
        CREATE OR REPLACE VIEW analytics.v_control_finding_intelligence AS
        SELECT
            afr.tenant_id,
            afr.control_id,
            COUNT(*) AS finding_count,
            COUNT(*) FILTER (
                WHERE UPPER(COALESCE(afr.status, '')) NOT IN
                    ('CLOSED', 'VERIFIED', 'RESOLVED')
            ) AS open_finding_count,
            COUNT(*) FILTER (
                WHERE UPPER(COALESCE(afr.severity, '')) IN ('CRITICAL', 'HIGH')
                  AND UPPER(COALESCE(afr.status, '')) NOT IN
                    ('CLOSED', 'VERIFIED', 'RESOLVED')
            ) AS open_high_critical_count
        FROM audit_finding_records afr
        WHERE afr.control_id IS NOT NULL
        GROUP BY afr.tenant_id, afr.control_id;
    """)


def downgrade():
    op.execute("DROP VIEW IF EXISTS analytics.v_control_finding_intelligence;")
    op.execute("DROP VIEW IF EXISTS analytics.v_finding_intelligence;")
    # Permission rows and role associations are intentionally preserved.
