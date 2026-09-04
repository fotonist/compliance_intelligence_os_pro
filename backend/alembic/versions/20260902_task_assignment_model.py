"""add enterprise task assignment fields

Revision ID: 20260902_task_assignment_model
Revises: fix_canonical_control_coverage
Create Date: 2026-09-02
"""

from alembic import op
import sqlalchemy as sa


revision = "20260902_task_assignment_model"
down_revision = "fix_canonical_control_coverage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ---------------------------------------------------------
    # TASK TYPE
    # ---------------------------------------------------------
    op.add_column(
        "compliance_tasks",
        sa.Column(
            "task_type",
            sa.String(length=50),
            nullable=True,
        ),
    )

    # Existing historical tasks have no task type.
    # Use the neutral enterprise default for legacy records.
    op.execute(
        """
        UPDATE compliance_tasks
        SET task_type = 'COMPLIANCE_ACTION'
        WHERE task_type IS NULL
        """
    )

    # ---------------------------------------------------------
    # ASSIGNEE
    # ---------------------------------------------------------
    op.add_column(
        "compliance_tasks",
        sa.Column(
            "assignee_user_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    op.create_foreign_key(
        "fk_compliance_tasks_assignee_user",
        "compliance_tasks",
        "users",
        ["assignee_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index(
        "ix_compliance_tasks_assignee_user_id",
        "compliance_tasks",
        ["assignee_user_id"],
    )

    # ---------------------------------------------------------
    # CREATOR
    # ---------------------------------------------------------
    op.add_column(
        "compliance_tasks",
        sa.Column(
            "created_by_user_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    op.create_foreign_key(
        "fk_compliance_tasks_created_by_user",
        "compliance_tasks",
        "users",
        ["created_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index(
        "ix_compliance_tasks_created_by_user_id",
        "compliance_tasks",
        ["created_by_user_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_compliance_tasks_created_by_user_id",
        table_name="compliance_tasks",
    )

    op.drop_constraint(
        "fk_compliance_tasks_created_by_user",
        "compliance_tasks",
        type_="foreignkey",
    )

    op.drop_column(
        "compliance_tasks",
        "created_by_user_id",
    )

    op.drop_index(
        "ix_compliance_tasks_assignee_user_id",
        table_name="compliance_tasks",
    )

    op.drop_constraint(
        "fk_compliance_tasks_assignee_user",
        "compliance_tasks",
        type_="foreignkey",
    )

    op.drop_column(
        "compliance_tasks",
        "assignee_user_id",
    )

    op.drop_column(
        "compliance_tasks",
        "task_type",
    )
