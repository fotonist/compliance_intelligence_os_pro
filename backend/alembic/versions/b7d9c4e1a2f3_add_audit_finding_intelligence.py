"""add audit finding intelligence to analytics

Revision ID: b7d9c4e1a2f3
Revises: 0cead64a939d, c3f1a9b7e2d4
Create Date: 2026-08-17
"""

from alembic import op

revision = "b7d9c4e1a2f3"
down_revision = ("0cead64a939d", "c3f1a9b7e2d4")
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE OR REPLACE VIEW analytics.v_audit_finding_intelligence AS
        SELECT
            afr.tenant_id,
            afr.control_id,
            COUNT(*) AS total_findings,
            COUNT(*) FILTER (
                WHERE UPPER(COALESCE(afr.status, '')) NOT IN ('CLOSED', 'VERIFIED')
            ) AS open_findings,
            COUNT(*) FILTER (
                WHERE UPPER(COALESCE(afr.severity, '')) IN ('CRITICAL', 'MAJOR', 'HIGH')
                  AND UPPER(COALESCE(afr.status, '')) NOT IN ('CLOSED', 'VERIFIED')
            ) AS high_severity_open_findings,
            COUNT(*) FILTER (
                WHERE UPPER(COALESCE(afr.severity, '')) = 'CRITICAL'
                  AND UPPER(COALESCE(afr.status, '')) NOT IN ('CLOSED', 'VERIFIED')
            ) AS critical_open_findings,
            COALESCE(SUM(
                CASE
                    WHEN UPPER(COALESCE(afr.status, '')) IN ('CLOSED', 'VERIFIED') THEN 0
                    ELSE
                        CASE UPPER(COALESCE(afr.severity, ''))
                            WHEN 'CRITICAL' THEN 1.00
                            WHEN 'MAJOR' THEN 0.80
                            WHEN 'HIGH' THEN 0.80
                            WHEN 'MEDIUM' THEN 0.50
                            WHEN 'MINOR' THEN 0.25
                            WHEN 'LOW' THEN 0.25
                            ELSE 0.50
                        END
                        *
                        CASE UPPER(COALESCE(afr.status, ''))
                            WHEN 'READY_FOR_VERIFICATION' THEN 0.25
                            WHEN 'IN_PROGRESS' THEN 0.50
                            WHEN 'PLAN_APPROVED' THEN 0.50
                            ELSE 1.00
                        END
                END
            ), 0) AS finding_pressure_score
        FROM audit_finding_records afr
        GROUP BY afr.tenant_id, afr.control_id;
    """)

    op.execute("""
        CREATE OR REPLACE VIEW analytics.v_risk_exposure AS
        SELECT
            rv.tenant_id,
            rv.id AS risk_version_id,
            rv.score AS risk_score,
            r.control_id,
            COUNT(DISTINCT rel.evidence_file_id) AS linked_evidence_count,
            COUNT(
                DISTINCT CASE
                    WHEN ef.status = 'Approved' THEN ef.id
                END
            ) AS approved_evidence_count,
            CASE
                WHEN COUNT(
                    DISTINCT CASE WHEN ef.status = 'Approved' THEN ef.id END
                ) > 0 THEN TRUE
                ELSE FALSE
            END AS is_covered,
            COALESCE(fi.total_findings, 0) AS total_findings,
            COALESCE(fi.open_findings, 0) AS open_findings,
            COALESCE(fi.high_severity_open_findings, 0) AS high_severity_open_findings,
            COALESCE(fi.critical_open_findings, 0) AS critical_open_findings,
            COALESCE(fi.finding_pressure_score, 0) AS finding_pressure_score,
            (
                rv.score *
                CASE
                    WHEN COUNT(
                        DISTINCT CASE WHEN ef.status = 'Approved' THEN ef.id END
                    ) > 0 THEN 0.2
                    ELSE 1
                END
            ) + COALESCE(fi.finding_pressure_score, 0) AS exposure_score
        FROM risk_versions rv
        JOIN risks r
            ON r.id = rv.risk_id
            AND r.tenant_id = rv.tenant_id
        LEFT JOIN risk_evidence_link rel
            ON rel.risk_version_id = rv.id
            AND rel.tenant_id = rv.tenant_id
        LEFT JOIN evidence_files ef
            ON ef.id = rel.evidence_file_id
            AND ef.tenant_id = rv.tenant_id
        LEFT JOIN analytics.v_audit_finding_intelligence fi
            ON fi.tenant_id = rv.tenant_id
            AND fi.control_id = r.control_id
        GROUP BY
            rv.tenant_id,
            rv.id,
            rv.score,
            r.control_id,
            fi.total_findings,
            fi.open_findings,
            fi.high_severity_open_findings,
            fi.critical_open_findings,
            fi.finding_pressure_score;
    """)

    op.execute("""
        CREATE OR REPLACE VIEW analytics.v_dashboard_summary AS
        WITH tenants AS (
            SELECT tenant_id FROM analytics.v_evidence_intelligence
            UNION
            SELECT tenant_id FROM audit_finding_records
        ),
        evidence_summary AS (
            SELECT
                tenant_id,
                COUNT(*) FILTER (WHERE is_orphan = TRUE) AS orphan_evidences,
                AVG(quality_score) AS avg_quality_score,
                COUNT(*) AS total_evidences
            FROM analytics.v_evidence_intelligence
            GROUP BY tenant_id
        ),
        finding_summary AS (
            SELECT
                tenant_id,
                COUNT(*) AS total_findings,
                COUNT(*) FILTER (
                    WHERE UPPER(COALESCE(status, '')) NOT IN ('CLOSED', 'VERIFIED')
                ) AS open_findings,
                COUNT(*) FILTER (
                    WHERE UPPER(COALESCE(severity, '')) IN ('CRITICAL', 'MAJOR', 'HIGH')
                      AND UPPER(COALESCE(status, '')) NOT IN ('CLOSED', 'VERIFIED')
                ) AS high_severity_open_findings,
                COUNT(*) FILTER (
                    WHERE UPPER(COALESCE(severity, '')) = 'CRITICAL'
                      AND UPPER(COALESCE(status, '')) NOT IN ('CLOSED', 'VERIFIED')
                ) AS critical_open_findings
            FROM audit_finding_records
            GROUP BY tenant_id
        )
        SELECT
            t.tenant_id,
            COALESCE(es.orphan_evidences, 0) AS orphan_evidences,
            es.avg_quality_score,
            COALESCE(es.total_evidences, 0) AS total_evidences,
            COALESCE(fs.total_findings, 0) AS total_findings,
            COALESCE(fs.open_findings, 0) AS open_findings,
            COALESCE(fs.high_severity_open_findings, 0) AS high_severity_open_findings,
            COALESCE(fs.critical_open_findings, 0) AS critical_open_findings
        FROM tenants t
        LEFT JOIN evidence_summary es ON es.tenant_id = t.tenant_id
        LEFT JOIN finding_summary fs ON fs.tenant_id = t.tenant_id;
    """)


def downgrade():
    op.execute("DROP VIEW IF EXISTS analytics.v_dashboard_summary;")
    op.execute("DROP VIEW IF EXISTS analytics.v_risk_exposure;")
    op.execute("DROP VIEW IF EXISTS analytics.v_audit_finding_intelligence;")

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

    op.execute("""
        CREATE OR REPLACE VIEW analytics.v_dashboard_summary AS
        SELECT
            tenant_id,
            COUNT(*) FILTER (WHERE is_orphan = TRUE) AS orphan_evidences,
            AVG(quality_score) AS avg_quality_score,
            COUNT(*) AS total_evidences
        FROM analytics.v_evidence_intelligence
        GROUP BY tenant_id;
    """)
