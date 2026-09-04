"""add granular task permissions

Revision ID: 20260902_task_permissions
Revises: 20260902_task_evidence_requirements
Create Date: 2026-09-02
"""

from alembic import op
import sqlalchemy as sa


revision = "20260902_task_permissions"
down_revision = "20260902_task_evidence_requirements"
branch_labels = None
depends_on = None


TASK_PERMISSIONS = {
    "task.view": "Task View",
    "task.create": "Task Create",
    "task.edit": "Task Edit",
    "task.assign": "Task Assign",
    "task.transition": "Task Workflow Transition",
    "task.close": "Task Close",
    "task.cancel": "Task Cancel",
    "task.delete": "Task Delete",
}


def upgrade():
    bind = op.get_bind()

    for code, description in TASK_PERMISSIONS.items():
        bind.execute(
            sa.text(
                """
                INSERT INTO permissions (code, description)
                SELECT :code, :description
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM permissions
                    WHERE code = :code
                )
                """
            ),
            {
                "code": code,
                "description": description,
            },
        )


def downgrade():
    bind = op.get_bind()

    for code in TASK_PERMISSIONS:
        bind.execute(
            sa.text(
                """
                DELETE FROM permissions
                WHERE code = :code
                  AND NOT EXISTS (
                      SELECT 1
                      FROM role_permissions rp
                      WHERE rp.permission_id = permissions.id
                  )
                """
            ),
            {"code": code},
        )
