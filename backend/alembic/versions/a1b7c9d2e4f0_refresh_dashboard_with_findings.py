"""refresh dashboard analytics with audit finding intelligence

Revision ID: a1b7c9d2e4f0
Revises: 9f6a3c1d8e20
Create Date: 2026-08-17

The strategic dashboard is computed by UEE, but analytics.v_dashboard_summary
was still based only on evidence intelligence. This migration keeps all
existing dashboard summary columns and adds current finding/risk-exposure
metrics so analytics consumers also reflect open audit findings.
"""

from alembic import op

revision = "a1b7c9d2e4f0"
down_revision = "9f6a3c1d8e20"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE OR REPLACE VIEW analytics.v_dashboard_summary AS
        WITH evidence_summary AS (
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
                total_findings,
                open_findings,
                open_critical_findings,
                open_high_findings,
                open_medium_findings,
                open_low_findings,
                pending_manager_reviews,
                pending_verifications,
                open_finding_pressure
            FROM analytics.v_finding_intelligence
        ),
        risk_summary AS (
            SELECT
                tenant_id,
                COUNT(*) AS risk_rows,
                AVG(exposure_score) AS avg_risk_exposure,
                SUM(CASE WHEN is_covered THEN 1 ELSE 0 END) AS covered_risk_rows
            FROM analytics.v_risk_exposure
            GROUP BY tenant_id
        )
        SELECT
            COALESCE(es.tenant_id, fs.tenant_id, rs.tenant_id) AS tenant_id,

            COALESCE(es.orphan_evidences, 0) AS orphan_evidences,
            COALESCE(es.avg_quality_score, 0) AS avg_quality_score,
            COALESCE(es.total_evidences, 0) AS total_evidences,

            COALESCE(fs.total_findings, 0) AS total_findings,
            COALESCE(fs.open_findings, 0) AS open_findings,
            COALESCE(fs.open_critical_findings, 0) AS open_critical_findings,
            COALESCE(fs.open_high_findings, 0) AS open_high_findings,
            COALESCE(fs.open_medium_findings, 0) AS open_medium_findings,
            COALESCE(fs.open_low_findings, 0) AS open_low_findings,
            COALESCE(fs.pending_manager_reviews, 0) AS pending_manager_reviews,
            COALESCE(fs.pending_verifications, 0) AS pending_verifications,
            COALESCE(fs.open_finding_pressure, 0) AS open_finding_pressure,

            COALESCE(rs.risk_rows, 0) AS risk_rows,
            COALESCE(rs.avg_risk_exposure, 0) AS avg_risk_exposure,
            COALESCE(rs.covered_risk_rows, 0) AS covered_risk_rows,
            CASE
                WHEN COALESCE(rs.risk_rows, 0) = 0 THEN 0
                ELSE ROUND(
                    (COALESCE(rs.covered_risk_rows, 0)::numeric
                     / rs.risk_rows::numeric) * 100,
                    2
                )
            END AS risk_coverage_rate

        FROM evidence_summary es
        FULL OUTER JOIN finding_summary fs
            ON fs.tenant_id = es.tenant_id
        FULL OUTER JOIN risk_summary rs
            ON rs.tenant_id = COALESCE(es.tenant_id, fs.tenant_id);
    """)


def downgrade():
    op.execute("""
        CREATE OR REPLACE VIEW analytics.v_dashboard_summary AS
        SELECT
            tenant_id,
            COUNT(*) FILTER (
                WHERE is_orphan = TRUE
            ) AS orphan_evidences,
            AVG(quality_score) AS avg_quality_score,
            COUNT(*) AS total_evidences
        FROM analytics.v_evidence_intelligence
        GROUP BY tenant_id;
    """)
