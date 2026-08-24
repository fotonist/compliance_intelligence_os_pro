"""add task evidence links

Revision ID: 1255131dc9da
Revises: d348d0458aee
Create Date: 2026-08-23 16:47:54.900767
"""

from alembic import op
import sqlalchemy as sa


revision = "1255131dc9da"
down_revision = "d348d0458aee"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "task_evidence_links",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=False),
        sa.Column("evidence_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name="fk_task_evidence_links_tenant",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["task_id"],
            ["compliance_tasks.id"],
            name="fk_task_evidence_links_task",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["evidence_id"],
            ["evidences.id"],
            name="fk_task_evidence_links_evidence",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_task_evidence_links_task_id",
        "task_evidence_links",
        ["task_id"],
        unique=False,
    )

    op.create_index(
        "ix_task_evidence_links_evidence_id",
        "task_evidence_links",
        ["evidence_id"],
        unique=False,
    )

    op.create_index(
        "ix_task_evidence_links_tenant_id",
        "task_evidence_links",
        ["tenant_id"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        "ix_task_evidence_links_tenant_id",
        table_name="task_evidence_links",
    )

    op.drop_index(
        "ix_task_evidence_links_evidence_id",
        table_name="task_evidence_links",
    )

    op.drop_index(
        "ix_task_evidence_links_task_id",
        table_name="task_evidence_links",
    )

    op.drop_table("task_evidence_links")
