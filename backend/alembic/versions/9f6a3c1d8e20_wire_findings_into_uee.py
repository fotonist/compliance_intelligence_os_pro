"""wire audit findings into UEE risk exposure

Revision ID: 9f6a3c1d8e20
Revises: 9e2b7c4d1f60
Create Date: 2026-08-17

Open audit findings are evidence of control weakness. This migration keeps
existing risk/evidence calculations intact and adds a deterministic finding
pressure multiplier to analytics.v_risk_exposure. UEE already consumes that
view, so UEE risk and coverage pressure become finding-aware without changing
its configured weights.
"""

from alembic import op

revision = "9f6a3c1d8e20"
down_revision = "9e2b7c4d1f60"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE OR REPLACE VIEW analytics.v_risk_exposure AS
        WITH finding_pressure AS (
            SELECT
                afr.tenant_id,
                afr.control_id,
                COUNT(*) FILTER (
                    WHERE UPPER(COALESCE(afr.status, '')) NOT IN
                        ('CLOSED', 'VERIFIED', 'RESOLVED')
                ) AS open_findings,
                COUNT(*) FILTER (
                    WHERE UPPER(COALESCE(afr.severity, '')) IN ('CRITICAL', 'HIGH')
                      AND UPPER(COALESCE(afr.status, '')) NOT IN
                        ('CLOSED', 'VERIFIED', 'RESOLVED')
                ) AS open_high_critical_findings,
                COUNT(*) FILTER (
                    WHERE UPPER(COALESCE(afr.severity, '')) = 'MEDIUM'
                      AND UPPER(COALESCE(afr.status, '')) NOT IN
                        ('CLOSED', 'VERIFIED', 'RESOLVED')
                ) AS open_medium_findings,
                COUNT(*) FILTER (
                    WHERE UPPER(COALESCE(afr.severity, '')) = 'LOW'
                      AND UPPER(COALESCE(afr.status, '')) NOT IN
                        ('CLOSED', 'VERIFIED', 'RESOLVED')
                ) AS open_low_findings
            FROM audit_finding_records afr
            GROUP BY afr.tenant_id, afr.control_id
        ),
        evidence_state AS (
            SELECT
                rv.tenant_id,
                rv.id AS risk_version_id,
                rv.risk_id,
                rv.score AS risk_score,
                COUNT(DISTINCT rel.evidence_file_id) AS linked_evidence_count,
                COUNT(
                    DISTINCT CASE
                        WHEN ef.status = 'Approved' THEN ef.id
                    END
                ) AS approved_evidence_count
            FROM risk_versions rv
            LEFT JOIN risk_evidence_link rel
                ON rel.risk_version_id = rv.id
                AND rel.tenant_id = rv.tenant_id
            LEFT JOIN evidence_files ef
                ON ef.id = rel.evidence_file_id
                AND ef.tenant_id = rv.tenant_id
            GROUP BY
                rv.tenant_id,
                rv.id,
                rv.risk_id,
                rv.score
        )
        SELECT
            es.tenant_id,
            es.risk_version_id,
            es.risk_score,
            es.linked_evidence_count,
            es.approved_evidence_count,
            (
                es.approved_evidence_count > 0
                AND COALESCE(fp.open_findings, 0) = 0
            ) AS is_covered,
            LEAST(
                100,
                (
                    es.risk_score *
                    CASE
                        WHEN es.approved_evidence_count > 0
                             AND COALESCE(fp.open_findings, 0) = 0
                            THEN 0.2
                        WHEN es.approved_evidence_count > 0
                            THEN 0.5
                        ELSE 1.0
                    END
                ) *
                (
                    1.0 + LEAST(
                        1.0,
                        COALESCE(fp.open_high_critical_findings, 0) * 0.25
                        + COALESCE(fp.open_medium_findings, 0) * 0.10
                        + COALESCE(fp.open_low_findings, 0) * 0.05
                    )
                )
            ) AS exposure_score,
            COALESCE(fp.open_findings, 0) AS open_findings,
            COALESCE(fp.open_high_critical_findings, 0) AS open_high_critical_findings,
            COALESCE(fp.open_medium_findings, 0) AS open_medium_findings,
            COALESCE(fp.open_low_findings, 0) AS open_low_findings
        FROM evidence_state es
        INNER JOIN risks r
            ON r.id = es.risk_id
            AND r.tenant_id = es.tenant_id
        LEFT JOIN finding_pressure fp
            ON fp.tenant_id = es.tenant_id
            AND fp.control_id = r.control_id;
    """)


def downgrade():
    # Restores the pre-findings version of the view. The original definition
    # is owned by migration 0cead64a939d.
    op.execute("""
        CREATE OR REPLACE VIEW analytics.v_risk_exposure AS
        SELECT
            rv.tenant_id,
            rv.id AS risk_version_id,
            rv.score AS risk_score,
            COUNT(DISTINCT rel.evidence_file_id) AS linked_evidence_count,
            COUNT(
                DISTINCT CASE
                    WHEN ef.status='Approved' THEN ef.id
                END
            ) AS approved_evidence_count,
            CASE
                WHEN COUNT(
                    DISTINCT CASE WHEN ef.status='Approved' THEN ef.id END
                ) > 0 THEN TRUE
                ELSE FALSE
            END AS is_covered,
            (
                rv.score *
                CASE
                    WHEN COUNT(
                        DISTINCT CASE WHEN ef.status='Approved' THEN ef.id END
                    ) > 0 THEN 0.2
                    ELSE 1
                END
            ) AS exposure_score
        FROM risk_versions rv
        LEFT JOIN risk_evidence_link rel
            ON rel.risk_version_id = rv.id
            AND rel.tenant_id = rv.tenant_id
        LEFT JOIN evidence_files ef
            ON ef.id = rel.evidence_file_id
            AND ef.tenant_id = rv.tenant_id
        GROUP BY rv.tenant_id, rv.id, rv.score;
    """)
