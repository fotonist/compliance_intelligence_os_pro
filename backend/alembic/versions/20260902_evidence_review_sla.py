"""add evidence review SLA due date

Revision ID: 20260902_evidence_review_sla
Revises: 20260902_task_permissions
Create Date: 2026-09-02
"""

from alembic import op
import sqlalchemy as sa


revision = "20260902_evidence_review_sla"
down_revision = "20260902_task_permissions"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "evidence_files",
        sa.Column(
            "review_due_at",
            sa.DateTime(),
            nullable=True,
        ),
    )


def downgrade():
    op.drop_column("evidence_files", "review_due_at")
