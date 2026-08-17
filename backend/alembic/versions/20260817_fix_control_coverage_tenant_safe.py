"""fix control coverage analytics view

Revision ID: 20260817_fix_control_coverage
Revises: 9f4b1c2e7a01
Create Date: 2026-08-17
"""

from alembic import op

revision = "20260817_fix_control_coverage"
down_revision = "9f4b1c2e7a01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP VIEW IF EXISTS analytics.v_control_coverage CASCADE")
    op.execute("DROP VIEW IF EXISTS analytics.v_control_coverage_uee CASCADE")

    op.execute("""
        CREATE VIEW analytics.v_control_coverage AS
        SELECT
            c.tenant_id,
            c.id AS control_id,
            c.code,
            c.title,
            COUNT(DISTINCT e.id) AS evidence_count,
            COUNT(DISTINCT ef.id) FILTER (
                WHERE LOWER(COALESCE(ef.status, '')) = 'approved'
            ) AS approved_files,
            CASE
                WHEN COUNT(DISTINCT e.id) = 0 THEN 'uncovered'
                WHEN COUNT(DISTINCT ef.id) FILTER (
                    WHERE LOWER(COALESCE(ef.status, '')) = 'approved'
                ) = 0 THEN 'partial'
                WHEN COUNT(DISTINCT ef.id) FILTER (
                    WHERE LOWER(COALESCE(ef.status, '')) = 'approved'
                ) < COUNT(DISTINCT ef.id) THEN 'partial'
                ELSE 'covered'
            END AS coverage_status
        FROM controls c
        LEFT JOIN evidences e
          ON e.control_id = c.id
         AND e.tenant_id = c.tenant_id
         AND e.is_deleted = false
        LEFT JOIN evidence_files ef
          ON ef.evidence_id = e.id
        GROUP BY c.tenant_id, c.id, c.code, c.title
    """)

    op.execute("""
        CREATE VIEW analytics.v_control_coverage_uee AS
        SELECT
            c.tenant_id,
            c.id AS control_id,
            c.code,
            c.title,
            COUNT(DISTINCT e.id) AS evidence_count,
            COUNT(DISTINCT ef.id) FILTER (
                WHERE LOWER(COALESCE(ef.status, '')) = 'approved'
            ) AS approved_files,
            CASE
                WHEN COUNT(DISTINCT e.id) = 0 THEN 'uncovered'
                WHEN COUNT(DISTINCT ef.id) FILTER (
                    WHERE LOWER(COALESCE(ef.status, '')) = 'approved'
                ) = 0 THEN 'partial'
                WHEN COUNT(DISTINCT ef.id) FILTER (
                    WHERE LOWER(COALESCE(ef.status, '')) = 'approved'
                ) < COUNT(DISTINCT ef.id) THEN 'partial'
                ELSE 'covered'
            END AS coverage_status
        FROM controls c
        LEFT JOIN evidences e
          ON e.control_id = c.id
         AND e.tenant_id = c.tenant_id
         AND e.is_deleted = false
        LEFT JOIN evidence_files ef
          ON ef.evidence_id = e.id
        GROUP BY c.tenant_id, c.id, c.code, c.title
    """)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS analytics.v_control_coverage_uee CASCADE")
    op.execute("DROP VIEW IF EXISTS analytics.v_control_coverage CASCADE")
