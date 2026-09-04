"""add peer population assignments

Revision ID: 20260904_peer_populations
Revises: mrg_ctrl_origin
Create Date: 2026-09-04
"""

from alembic import op
import sqlalchemy as sa


revision = "20260904_peer_populations"
down_revision = "mrg_ctrl_origin"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "peer_populations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("population_key", sa.String(length=128), nullable=False),
        sa.Column("industry", sa.String(length=128), nullable=True),
        sa.Column("company_size", sa.String(length=64), nullable=True),
        sa.Column("region", sa.String(length=64), nullable=True),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
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
        sa.UniqueConstraint(
            "tenant_id",
            name="uq_peer_populations_tenant_id",
        ),
        sa.CheckConstraint(
            "length(btrim(population_key)) > 0",
            name="ck_peer_populations_population_key_nonempty",
        ),
    )

    op.create_index(
        "ix_peer_populations_tenant_id",
        "peer_populations",
        ["tenant_id"],
    )
    op.create_index(
        "ix_peer_populations_population_key",
        "peer_populations",
        ["population_key"],
    )
    op.create_index(
        "ix_peer_populations_is_active",
        "peer_populations",
        ["is_active"],
    )


def downgrade():
    op.drop_index(
        "ix_peer_populations_is_active",
        table_name="peer_populations",
    )
    op.drop_index(
        "ix_peer_populations_population_key",
        table_name="peer_populations",
    )
    op.drop_index(
        "ix_peer_populations_tenant_id",
        table_name="peer_populations",
    )
    op.drop_table("peer_populations")
