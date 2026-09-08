"""create governance committee history

Revision ID: 20260908_governance_committee_history
Revises: 20260908_create_governance_committees
Create Date: 2026-09-08
"""

from alembic import op
import sqlalchemy as sa


revision = "20260908_governance_committee_history"
down_revision = "20260908_create_governance_committees"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "governance_committee_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "committee_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("field_name", sa.String(100), nullable=True),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column(
            "performed_by",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "committee_id"],
            ["governance_committees.tenant_id", "governance_committees.id"],
            name="fk_governance_committee_history_committee_tenant",
            ondelete="CASCADE",
        ),
    )

    op.create_index(
        "ix_governance_committee_history_tenant_id",
        "governance_committee_history",
        ["tenant_id"],
    )

    op.create_index(
        "ix_governance_committee_history_committee_id",
        "governance_committee_history",
        ["committee_id"],
    )

    op.create_index(
        "ix_governance_committee_history_created_at",
        "governance_committee_history",
        ["created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_governance_committee_history_created_at",
        table_name="governance_committee_history",
    )

    op.drop_index(
        "ix_governance_committee_history_committee_id",
        table_name="governance_committee_history",
    )

    op.drop_index(
        "ix_governance_committee_history_tenant_id",
        table_name="governance_committee_history",
    )

    op.drop_table("governance_committee_history")
