"""create analytics intelligence views

Revision ID: 0cead64a939d
Revises: 
Create Date: 2026-02-23

"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "0cead64a939d"
down_revision = "97d434b7d7ef"
branch_labels = None
depends_on = None


def upgrade():
    # ---------------------------------------------------------
    # Create analytics schema
    # ---------------------------------------------------------
    op.execute("""
        CREATE SCHEMA IF NOT EXISTS analytics;
    """)

    # ---------------------------------------------------------
    # EVIDENCE INTELLIGENCE VIEW
    # ---------------------------------------------------------
    op.execute("""
        CREATE OR REPLACE VIEW analytics.v_evidence_intelligence AS
        SELECT
            e.tenant_id,
            e.id AS evidence_id,
            e.title,
            e.assessment_type,

            COUNT(DISTINCT ef.id) AS files_count,

            COUNT(
                DISTINCT CASE
                    WHEN ef.status = 'Approved' THEN ef.id
                END
            ) AS approved_files_count,

            MAX(ef.uploaded_at) AS last_uploaded_at,
            MAX(ef.approved_at) AS last_approved_at,

            COUNT(DISTINCT rel.id) AS linked_risks_count,

            CASE
                WHEN COUNT(DISTINCT rel.id) = 0 THEN TRUE
                ELSE FALSE
            END AS is_orphan,

            EXTRACT(DAY FROM (NOW() - MAX(ef.uploaded_at))) AS age_days,

            (
                50
                + CASE WHEN COUNT(DISTINCT rel.id) > 0 THEN 10 ELSE -20 END
                + CASE WHEN COUNT(DISTINCT ef.id) > 0 THEN 10 ELSE 0 END
                + CASE
                    WHEN COUNT(
                        DISTINCT CASE WHEN ef.status='Approved' THEN ef.id END
                    ) > 0 THEN 20
                    ELSE 0
                  END
            ) AS quality_score

        FROM evidences e
        LEFT JOIN evidence_files ef
            ON ef.evidence_id = e.id
            AND ef.tenant_id = e.tenant_id
        LEFT JOIN risk_evidence_link rel
            ON rel.evidence_file_id = ef.id
            AND rel.tenant_id = e.tenant_id

        WHERE e.is_deleted = FALSE

        GROUP BY
            e.tenant_id,
            e.id,
            e.title,
            e.assessment_type;
    """)

    # ---------------------------------------------------------
    # RISK EXPOSURE VIEW
    # ---------------------------------------------------------
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

        GROUP BY
            rv.tenant_id,
            rv.id,
            rv.score;
    """)

    # ---------------------------------------------------------
    # DASHBOARD SUMMARY VIEW
    # ---------------------------------------------------------
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


def downgrade():
    op.execute("DROP VIEW IF EXISTS analytics.v_dashboard_summary;")
    op.execute("DROP VIEW IF EXISTS analytics.v_risk_exposure;")
    op.execute("DROP VIEW IF EXISTS analytics.v_evidence_intelligence;")
    op.execute("DROP SCHEMA IF EXISTS analytics;")