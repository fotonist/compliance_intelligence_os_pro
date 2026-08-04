"""add compliance_tasks table

Revision ID: 4b044f718f99
Revises: 0bfbca637f57
Create Date: 2026-02-22 06:15:53.287426
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '4b044f718f99'
down_revision = '0bfbca637f57'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "compliance_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="open"),
        sa.Column("due_date", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            ondelete="CASCADE"
        ),
    )

    op.create_index(
        "ix_compliance_tasks_tenant_id",
        "compliance_tasks",
        ["tenant_id"],
    )


def downgrade():
    op.drop_index("ix_compliance_tasks_tenant_id", table_name="compliance_tasks")
    op.drop_table("compliance_tasks")