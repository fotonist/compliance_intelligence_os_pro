"""create clause_weight_overrides table

Revision ID: 69540cc29585
Revises: 4b044f718f99
Create Date: 2026-02-22
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "69540cc29585"
down_revision = "4b044f718f99"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "clause_weight_overrides",
        sa.Column("id", sa.Integer(), primary_key=True),

        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("standard_id", sa.Integer(), nullable=False),
        sa.Column("clause_id", sa.Integer(), nullable=False),

        sa.Column("weight_pct", sa.Float(), nullable=False),
        sa.Column("rationale", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),

        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),

        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["standard_id"], ["standards.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["clause_id"], ["clauses.id"], ondelete="CASCADE"),
    )

    op.create_index("ix_cwo_tenant_id", "clause_weight_overrides", ["tenant_id"])
    op.create_index("ix_cwo_standard_id", "clause_weight_overrides", ["standard_id"])
    op.create_index("ix_cwo_clause_id", "clause_weight_overrides", ["clause_id"])

    # tenant + standard + clause unique
    op.create_unique_constraint(
        "ux_cwo_tenant_standard_clause",
        "clause_weight_overrides",
        ["tenant_id", "standard_id", "clause_id"],
    )


def downgrade():
    op.drop_constraint(
        "ux_cwo_tenant_standard_clause",
        "clause_weight_overrides",
        type_="unique",
    )

    op.drop_index("ix_cwo_clause_id", table_name="clause_weight_overrides")
    op.drop_index("ix_cwo_standard_id", table_name="clause_weight_overrides")
    op.drop_index("ix_cwo_tenant_id", table_name="clause_weight_overrides")

    op.drop_table("clause_weight_overrides")