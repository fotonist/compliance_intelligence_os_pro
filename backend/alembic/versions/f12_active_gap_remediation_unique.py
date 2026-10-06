"""enforce active control gap remediation uniqueness

Revision ID: f12gapremediation
Revises: 70995d122143
"""

from alembic import op
import sqlalchemy as sa


revision = "f12gapremediation"
down_revision = "70995d122143"
branch_labels = None
depends_on = None


INDEX_NAME = (
    "ux_compliance_tasks_active_control_gap_remediation"
)

ACTIVE_SQL = """
task_type = 'REMEDIATION'
AND source_type = 'CONTROL_GAP'
AND status IN (
    'OPEN',
    'IN_PROGRESS',
    'BLOCKED',
    'UNDER_REVIEW',
    'READY_TO_CLOSE'
)
"""


def upgrade():
    bind = op.get_bind()

    duplicates = bind.exec_driver_sql(
        """
        SELECT
            tenant_id,
            control_id,
            COUNT(*) AS row_count
        FROM compliance_tasks
        WHERE task_type = 'REMEDIATION'
          AND source_type = 'CONTROL_GAP'
          AND status IN (
              'OPEN',
              'IN_PROGRESS',
              'BLOCKED',
              'UNDER_REVIEW',
              'READY_TO_CLOSE'
          )
        GROUP BY
            tenant_id,
            control_id
        HAVING COUNT(*) > 1
        """
    ).fetchall()

    if duplicates:
        raise RuntimeError(
            "Duplicate active control-gap remediation tasks "
            f"already exist: {duplicates!r}"
        )

    invalid = bind.exec_driver_sql(
        """
        SELECT id
        FROM compliance_tasks
        WHERE task_type = 'REMEDIATION'
          AND source_type = 'CONTROL_GAP'
          AND status IN (
              'OPEN',
              'IN_PROGRESS',
              'BLOCKED',
              'UNDER_REVIEW',
              'READY_TO_CLOSE'
          )
          AND (
              control_id IS NULL
              OR source_id IS NULL
              OR source_id <> control_id
          )
        ORDER BY id
        """
    ).fetchall()

    if invalid:
        raise RuntimeError(
            "Invalid active control-gap remediation identity: "
            f"{invalid!r}"
        )

    op.create_index(
        INDEX_NAME,
        "compliance_tasks",
        [
            "tenant_id",
            "control_id",
        ],
        unique=True,
        postgresql_where=sa.text(ACTIVE_SQL),
    )


def downgrade():
    op.drop_index(
        INDEX_NAME,
        table_name="compliance_tasks",
    )
