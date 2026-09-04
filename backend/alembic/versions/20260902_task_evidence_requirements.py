"""add task evidence requirements

Revision ID: 20260902_task_evidence_requirements
Revises: 20260902_task_assignment_model
Create Date: 2026-09-02
"""

from alembic import op
import sqlalchemy as sa


revision = "20260902_task_evidence_requirements"
down_revision = "20260902_task_assignment_model"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "task_evidence_requirements",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("evidence_type", sa.String(50), nullable=False),
        sa.Column(
            "required",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
        sa.Column(
            "status",
            sa.String(30),
            nullable=False,
            server_default=sa.text("'OPEN'"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name="fk_task_evidence_requirements_tenant",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["task_id"],
            ["compliance_tasks.id"],
            name="fk_task_evidence_requirements_task",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "task_id",
            "name",
            name="uq_task_evidence_requirements_task_name",
        ),
    )

    op.create_index(
        "ix_task_evidence_requirements_tenant_id",
        "task_evidence_requirements",
        ["tenant_id"],
    )

    op.create_index(
        "ix_task_evidence_requirements_task_id",
        "task_evidence_requirements",
        ["task_id"],
    )

    op.create_unique_constraint(
        "uq_task_evidence_links_task_evidence",
        "task_evidence_links",
        ["task_id", "evidence_id"],
    )


def downgrade():
    op.drop_constraint(
        "uq_task_evidence_links_task_evidence",
        "task_evidence_links",
        type_="unique",
    )

    op.drop_index(
        "ix_task_evidence_requirements_task_id",
        table_name="task_evidence_requirements",
    )

    op.drop_index(
        "ix_task_evidence_requirements_tenant_id",
        table_name="task_evidence_requirements",
    )

    op.drop_table("task_evidence_requirements")
