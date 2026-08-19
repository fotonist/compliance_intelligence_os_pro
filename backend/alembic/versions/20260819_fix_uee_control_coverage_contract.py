"""Fix UEE control coverage contract and semantics.

Revision ID: 20260819_fix_uee_control_coverage_contract
Revises: 20260817_fix_control_coverage
Create Date: 2026-08-19
"""

from alembic import op

revision = "20260819_fix_uee_control_coverage_contract"
down_revision = "20260817_fix_control_coverage"
branch_labels = None
depends_on = None


VIEW_SQL = """
    SELECT
        c.tenant_id,
        c.id AS control_id,
        c.code,
        c.title,
        COUNT(DISTINCT e.id) AS evidence_count,
        COUNT(DISTINCT ef.id) FILTER (
            WHERE LOWER(COALESCE(ef.status, '')) = 'approved'
        ) AS approved_files,
        COUNT(DISTINCT ef.id) AS total_files,
        CASE
            WHEN COUNT(DISTINCT e.id) = 0 THEN 'uncovered'
            WHEN COUNT(DISTINCT ef.id) = 0 THEN 'uncovered'
            WHEN COUNT(DISTINCT ef.id) FILTER (
                WHERE LOWER(COALESCE(ef.status, '')) = 'approved'
            ) = 0 THEN 'uncovered'
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
"""


def upgrade() -> None:
    op.execute("DROP VIEW IF EXISTS analytics.v_control_coverage_uee CASCADE")
    op.execute("DROP VIEW IF EXISTS analytics.v_control_coverage CASCADE")

    op.execute(f"CREATE VIEW analytics.v_control_coverage AS {VIEW_SQL}")
    op.execute(f"CREATE VIEW analytics.v_control_coverage_uee AS {VIEW_SQL}")


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS analytics.v_control_coverage_uee CASCADE")
    op.execute("DROP VIEW IF EXISTS analytics.v_control_coverage CASCADE")

    op.execute(
        """
        CREATE VIEW analytics.v_control_coverage AS
        SELECT
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
         AND e.is_deleted = false
        LEFT JOIN evidence_files ef
          ON ef.evidence_id = e.id
        GROUP BY c.id, c.code, c.title
        """
    )
    op.execute(
        """
        CREATE VIEW analytics.v_control_coverage_uee AS
        SELECT
            control_id,
            code,
            title,
            evidence_count,
            approved_files,
            coverage_status
        FROM analytics.v_control_coverage
        """
    )
