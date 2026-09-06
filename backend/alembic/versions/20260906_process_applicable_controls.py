"""create process applicable controls

Revision ID: 20260906_process_applicable_controls
Revises: 20260905_peer_populations
Create Date: 2026-09-06
"""

from alembic import op
import sqlalchemy as sa


revision = "20260906_process_applicable_controls"
down_revision = "20260905_peer_populations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "process_applicable_controls",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("process_id", sa.Integer(), nullable=False),
        sa.Column("control_id", sa.Integer(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["process_id"],
            ["processes.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["control_id"],
            ["controls.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "tenant_id",
            "process_id",
            "control_id",
            name="uq_process_applicable_control",
        ),
    )

    op.create_index(
        "ix_process_applicable_controls_tenant_id",
        "process_applicable_controls",
        ["tenant_id"],
    )

    op.create_index(
        "ix_process_applicable_controls_process_id",
        "process_applicable_controls",
        ["process_id"],
    )

    op.create_index(
        "ix_process_applicable_controls_control_id",
        "process_applicable_controls",
        ["control_id"],
    )

    op.create_index(
        "ix_process_applicable_controls_created_by_user_id",
        "process_applicable_controls",
        ["created_by_user_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_process_applicable_controls_created_by_user_id",
        table_name="process_applicable_controls",
    )
    op.drop_index(
        "ix_process_applicable_controls_control_id",
        table_name="process_applicable_controls",
    )
    op.drop_index(
        "ix_process_applicable_controls_process_id",
        table_name="process_applicable_controls",
    )
    op.drop_index(
        "ix_process_applicable_controls_tenant_id",
        table_name="process_applicable_controls",
    )
    op.drop_table("process_applicable_controls")
