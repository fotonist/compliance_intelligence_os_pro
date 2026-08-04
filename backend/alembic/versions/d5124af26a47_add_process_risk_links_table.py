from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "d5124af26a47"
down_revision = "698420244df1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "process_risk_links",
        sa.Column("id", sa.Integer(), primary_key=True),

        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),

        sa.Column(
            "process_id",
            sa.Integer(),
            sa.ForeignKey("processes.id", ondelete="CASCADE"),
            nullable=False,
        ),

        sa.Column(
            "risk_id",
            sa.Integer(),
            sa.ForeignKey("risks.id", ondelete="CASCADE"),
            nullable=False,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "ix_prl_tenant_id",
        "process_risk_links",
        ["tenant_id"],
    )

    op.create_index(
        "ix_prl_process_id",
        "process_risk_links",
        ["process_id"],
    )

    op.create_index(
        "ix_prl_risk_id",
        "process_risk_links",
        ["risk_id"],
    )

    op.create_unique_constraint(
        "uq_process_risk_unique",
        "process_risk_links",
        ["process_id", "risk_id"],
    )


def downgrade():
    op.drop_constraint(
        "uq_process_risk_unique",
        "process_risk_links",
        type_="unique",
    )

    op.drop_index("ix_prl_risk_id", table_name="process_risk_links")
    op.drop_index("ix_prl_process_id", table_name="process_risk_links")
    op.drop_index("ix_prl_tenant_id", table_name="process_risk_links")

    op.drop_table("process_risk_links")
