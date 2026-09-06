"""add peer benchmark populations

Revision ID: 20260905_peer_populations
Revises: 20260904_matrix_instance_column_snapshot
Create Date: 2026-09-04
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260905_peer_populations"
down_revision = "20260904_matrix_instance_column_snapshot"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "peer_populations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("industry", sa.String(length=255), nullable=True),
        sa.Column("geography", sa.String(length=255), nullable=True),
        sa.Column("company_size_band", sa.String(length=100), nullable=True),
        sa.Column("revenue_band", sa.String(length=100), nullable=True),
        sa.Column("standard_id", sa.Integer(), nullable=True),
        sa.Column(
            "minimum_sample_size",
            sa.Integer(),
            server_default="5",
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=50),
            server_default="DRAFT",
            nullable=False,
        ),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("approved_by", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["standard_id"],
            ["standards.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["approved_by"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_peer_populations_id",
        "peer_populations",
        ["id"],
        unique=False,
    )
    op.create_index(
        "ix_peer_populations_industry",
        "peer_populations",
        ["industry"],
        unique=False,
    )
    op.create_index(
        "ix_peer_populations_geography",
        "peer_populations",
        ["geography"],
        unique=False,
    )
    op.create_index(
        "ix_peer_populations_company_size_band",
        "peer_populations",
        ["company_size_band"],
        unique=False,
    )
    op.create_index(
        "ix_peer_populations_revenue_band",
        "peer_populations",
        ["revenue_band"],
        unique=False,
    )
    op.create_index(
        "ix_peer_populations_standard_id",
        "peer_populations",
        ["standard_id"],
        unique=False,
    )
    op.create_index(
        "ix_peer_populations_status",
        "peer_populations",
        ["status"],
        unique=False,
    )

    op.create_table(
        "peer_population_members",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("population_id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column(
            "membership_type",
            sa.String(length=50),
            server_default="MANUAL",
            nullable=False,
        ),
        sa.Column(
            "eligibility_status",
            sa.String(length=50),
            server_default="PENDING",
            nullable=False,
        ),
        sa.Column(
            "effective_from",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "effective_to",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["population_id"],
            ["peer_populations.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_peer_population_members_id",
        "peer_population_members",
        ["id"],
        unique=False,
    )
    op.create_index(
        "ix_peer_population_members_population_id",
        "peer_population_members",
        ["population_id"],
        unique=False,
    )
    op.create_index(
        "ix_peer_population_members_tenant_id",
        "peer_population_members",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        "ix_peer_population_members_eligibility_status",
        "peer_population_members",
        ["eligibility_status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_peer_population_members_eligibility_status",
        table_name="peer_population_members",
    )
    op.drop_index(
        "ix_peer_population_members_tenant_id",
        table_name="peer_population_members",
    )
    op.drop_index(
        "ix_peer_population_members_population_id",
        table_name="peer_population_members",
    )
    op.drop_index(
        "ix_peer_population_members_id",
        table_name="peer_population_members",
    )
    op.drop_table("peer_population_members")

    op.drop_index(
        "ix_peer_populations_status",
        table_name="peer_populations",
    )
    op.drop_index(
        "ix_peer_populations_standard_id",
        table_name="peer_populations",
    )
    op.drop_index(
        "ix_peer_populations_revenue_band",
        table_name="peer_populations",
    )
    op.drop_index(
        "ix_peer_populations_company_size_band",
        table_name="peer_populations",
    )
    op.drop_index(
        "ix_peer_populations_geography",
        table_name="peer_populations",
    )
    op.drop_index(
        "ix_peer_populations_industry",
        table_name="peer_populations",
    )
    op.drop_index(
        "ix_peer_populations_id",
        table_name="peer_populations",
    )
    op.drop_table("peer_populations")
