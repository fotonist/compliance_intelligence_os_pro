"""restrict control coverage to canonical controls

Revision ID: fix_canonical_control_coverage
Revises: mrg_ctrl_origin
Create Date: 2026-08-31
"""

from alembic import op


revision = "fix_canonical_control_coverage"
down_revision = "mrg_ctrl_origin"
branch_labels = None
depends_on = None


VIEW_SQL = """
WITH active_matrix AS (
    SELECT DISTINCT ON (mi.tenant_id, mi.standard_id)
        mi.id AS matrix_instance_id,
        mi.tenant_id,
        mi.standard_id,
        mi.standard_version_id
    FROM matrix_instances mi
    JOIN standard_versions sv
      ON sv.id = mi.standard_version_id
    WHERE mi.status::text = ANY (
        ARRAY[
            'generated'::character varying,
            'submitted'::character varying,
            'approved'::character varying
        ]::text[]
    )
      AND sv.status::text = 'published'::text
    ORDER BY
        mi.tenant_id,
        mi.standard_id,
        mi.created_at DESC,
        mi.id DESC
),
tenant_controls AS (
    SELECT
        am.tenant_id,
        am.standard_id,
        am.standard_version_id,
        c.id AS control_id,
        c.code,
        c.title
    FROM active_matrix am
    JOIN controls c
      ON c.standard_version_id = am.standard_version_id
     AND c.origin = 'canonical'
),
evidence_state AS (
    SELECT
        tc.tenant_id,
        tc.standard_id,
        tc.standard_version_id,
        tc.control_id,
        tc.code,
        tc.title,
        COUNT(DISTINCT e.id) AS evidence_count,
        COUNT(DISTINCT ef.id) FILTER (
            WHERE LOWER(COALESCE(ef.status, '')) = 'approved'
        ) AS approved_files,
        COUNT(DISTINCT ef.id) AS total_files
    FROM tenant_controls tc
    LEFT JOIN evidences e
      ON e.control_id = tc.control_id
     AND e.tenant_id = tc.tenant_id
     AND e.standard_id = tc.standard_id
     AND e.standard_version_id = tc.standard_version_id
     AND e.is_deleted = false
    LEFT JOIN evidence_files ef
      ON ef.evidence_id = e.id
    GROUP BY
        tc.tenant_id,
        tc.standard_id,
        tc.standard_version_id,
        tc.control_id,
        tc.code,
        tc.title
)
SELECT
    tenant_id,
    control_id,
    code,
    title,
    evidence_count,
    approved_files,
    total_files,
    CASE
        WHEN evidence_count = 0 THEN 'uncovered'
        WHEN total_files = 0 THEN 'uncovered'
        WHEN approved_files = 0 THEN 'uncovered'
        WHEN approved_files < total_files THEN 'partial'
        ELSE 'covered'
    END AS coverage_status
FROM evidence_state
"""


def upgrade() -> None:
    op.execute(
        "DROP VIEW IF EXISTS analytics.v_control_coverage_uee CASCADE"
    )
    op.execute(
        "DROP VIEW IF EXISTS analytics.v_control_coverage CASCADE"
    )

    op.execute(
        f"CREATE VIEW analytics.v_control_coverage AS {VIEW_SQL}"
    )

    op.execute(
        f"CREATE VIEW analytics.v_control_coverage_uee AS {VIEW_SQL}"
    )


def downgrade() -> None:
    op.execute(
        "DROP VIEW IF EXISTS analytics.v_control_coverage_uee CASCADE"
    )
    op.execute(
        "DROP VIEW IF EXISTS analytics.v_control_coverage CASCADE"
    )

    op.execute(
        f"CREATE VIEW analytics.v_control_coverage AS {VIEW_SQL.replace(
            "     AND c.origin = 'canonical'",
            ""
        )}"
    )

    op.execute(
        f"CREATE VIEW analytics.v_control_coverage_uee AS {VIEW_SQL.replace(
            "     AND c.origin = 'canonical'",
            ""
        )}"
    )
