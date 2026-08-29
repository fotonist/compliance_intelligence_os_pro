"""create exposure coverage matrix analytics view

Revision ID: 20260828_exposure_matrix
Revises: 20260828_governance_meeting_rbac
Create Date: 2026-08-28

Creates the canonical analytics view consumed by the Intelligence
Exposure x Coverage Matrix endpoint.
"""

from alembic import op


revision = "20260828_exposure_matrix"
down_revision = "20260828_governance_meeting_rbac"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE SCHEMA IF NOT EXISTS analytics;
    """)

    op.execute("""
        CREATE OR REPLACE VIEW analytics.v_exposure_coverage_matrix AS
        SELECT
            r.tenant_id,
            r.exposure_level AS risk_bucket,
            CASE
                WHEN c.coverage_status = 'covered' THEN 'covered'
                ELSE 'uncovered'
            END AS coverage_bucket,
            COUNT(*)::bigint AS risk_count
        FROM analytics.v_risk_exposure_uee r
        LEFT JOIN analytics.v_control_coverage_uee c
            ON c.tenant_id = r.tenant_id
           AND c.control_id = r.control_id
        GROUP BY
            r.tenant_id,
            r.exposure_level,
            CASE
                WHEN c.coverage_status = 'covered' THEN 'covered'
                ELSE 'uncovered'
            END;
    """)


def downgrade():
    op.execute("""
        DROP VIEW IF EXISTS analytics.v_exposure_coverage_matrix;
    """)
