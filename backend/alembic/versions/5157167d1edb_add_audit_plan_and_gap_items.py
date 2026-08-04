"""add_audit_plan_and_gap_items

Revision ID: 5157167d1edb
Revises: e9e3f1dd9bc9
Create Date: 2026-02-22 12:02:38.043830
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '5157167d1edb'
down_revision = 'e9e3f1dd9bc9'
branch_labels = None
depends_on = None


def upgrade():

    op.create_table(
        "audit_plan_items",
        sa.Column("id", sa.Integer(), primary_key=True),

        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
            nullable=False,
        ),

        sa.Column(
            "risk_id",
            sa.Integer(),
            sa.ForeignKey("risks.id", ondelete="CASCADE"),
            nullable=False,
        ),

        sa.Column(
            "control_id",
            sa.Integer(),
            sa.ForeignKey("controls.id", ondelete="SET NULL"),
            nullable=True,
        ),

        sa.Column(
            "process_id",
            sa.Integer(),
            sa.ForeignKey("processes.id", ondelete="SET NULL"),
            nullable=True,
        ),

        sa.Column(
            "forecast_id",
            sa.Integer(),
            sa.ForeignKey("risk_forecasts.id", ondelete="SET NULL"),
            nullable=True,
        ),

        sa.Column("escalation_probability_30d", sa.Float(), nullable=True),
        sa.Column("expected_score_delta", sa.Float(), nullable=True),

        sa.Column("priority", sa.String(), nullable=False),
        sa.Column("source", sa.String(), nullable=False, server_default="forecast"),
        sa.Column("status", sa.String(), nullable=False, server_default="planned"),

        sa.Column("snapshot_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_unique_constraint(
        "uq_audit_plan_forecast_once",
        "audit_plan_items",
        ["tenant_id", "risk_id", "forecast_id"],
    )

    op.create_index("ix_audit_plan_items_tenant_id", "audit_plan_items", ["tenant_id"])
    op.create_index("ix_audit_plan_items_risk_id", "audit_plan_items", ["risk_id"])
    op.create_index("ix_audit_plan_items_forecast_id", "audit_plan_items", ["forecast_id"])


    op.create_table(
        "gap_items",
        sa.Column("id", sa.Integer(), primary_key=True),

        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
            nullable=False,
        ),

        sa.Column(
            "risk_id",
            sa.Integer(),
            sa.ForeignKey("risks.id", ondelete="CASCADE"),
            nullable=False,
        ),

        sa.Column(
            "control_id",
            sa.Integer(),
            sa.ForeignKey("controls.id", ondelete="SET NULL"),
            nullable=True,
        ),

        sa.Column(
            "forecast_id",
            sa.Integer(),
            sa.ForeignKey("risk_forecasts.id", ondelete="SET NULL"),
            nullable=True,
        ),

        sa.Column("gap_type", sa.String(), nullable=False),
        sa.Column("severity_score", sa.Float(), nullable=True),

        sa.Column("status", sa.String(), nullable=False, server_default="open"),

        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_unique_constraint(
        "uq_gap_forecast_once",
        "gap_items",
        ["tenant_id", "risk_id", "forecast_id"],
    )

    op.create_index("ix_gap_items_tenant_id", "gap_items", ["tenant_id"])
    op.create_index("ix_gap_items_risk_id", "gap_items", ["risk_id"])
    op.create_index("ix_gap_items_forecast_id", "gap_items", ["forecast_id"])


def downgrade():

    op.drop_constraint("uq_gap_forecast_once", "gap_items", type_="unique")
    op.drop_index("ix_gap_items_forecast_id", table_name="gap_items")
    op.drop_index("ix_gap_items_risk_id", table_name="gap_items")
    op.drop_index("ix_gap_items_tenant_id", table_name="gap_items")
    op.drop_table("gap_items")

    op.drop_constraint("uq_audit_plan_forecast_once", "audit_plan_items", type_="unique")
    op.drop_index("ix_audit_plan_items_forecast_id", table_name="audit_plan_items")
    op.drop_index("ix_audit_plan_items_risk_id", table_name="audit_plan_items")
    op.drop_index("ix_audit_plan_items_tenant_id", table_name="audit_plan_items")
    op.drop_table("audit_plan_items")