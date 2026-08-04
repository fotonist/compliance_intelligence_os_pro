"""process-risk links

Revision ID: 0bfbca637f57
Revises: <BURAYA_BIR_ONCEKI_REVISION_ID>
Create Date: 2026-02-15
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0bfbca637f57"
down_revision = "d5124af26a47"
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
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.UniqueConstraint(
            "process_id",
            "risk_id",
            name="uq_process_risk_unique",
        ),
    )

    op.create_index(
        "ix_process_risk_links_tenant_id",
        "process_risk_links",
        ["tenant_id"],
    )

    op.create_index(
        "ix_process_risk_links_process_id",
        "process_risk_links",
        ["process_id"],
    )

    op.create_index(
        "ix_process_risk_links_risk_id",
        "process_risk_links",
        ["risk_id"],
    )


def downgrade():
    op.drop_index(
        "ix_process_risk_links_risk_id",
        table_name="process_risk_links",
    )

    op.drop_index(
        "ix_process_risk_links_process_id",
        table_name="process_risk_links",
    )

    op.drop_index(
        "ix_process_risk_links_tenant_id",
        table_name="process_risk_links",
    )

    op.drop_table("process_risk_links")
