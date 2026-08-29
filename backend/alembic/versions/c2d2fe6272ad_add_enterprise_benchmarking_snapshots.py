"""add enterprise benchmarking snapshots

Revision ID: c2d2fe6272ad
Revises: 20260828_exposure_matrix
Create Date: 2026-08-29 21:31:51.728018
"""

from alembic import op
import sqlalchemy as sa


revision = "c2d2fe6272ad"
down_revision = "20260828_exposure_matrix"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "benchmark_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),

        # Measurement / period semantics
        sa.Column(
            "snapshot_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "period_start",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "period_end",
            sa.DateTime(timezone=True),
            nullable=True,
        ),

        # Canonical UEE metrics
        sa.Column("uee_score", sa.Float(), nullable=False),
        sa.Column(
            "compliance_health_index",
            sa.Float(),
            nullable=False,
        ),

        # UEE component indices
        sa.Column("risk_index", sa.Float(), nullable=False),
        sa.Column("coverage_index", sa.Float(), nullable=False),
        sa.Column("maturity_index", sa.Float(), nullable=False),
        sa.Column("evidence_index", sa.Float(), nullable=False),
        sa.Column("task_pressure_index", sa.Float(), nullable=False),

        # Source population / data-quality context
        sa.Column("risk_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("control_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("evidence_count", sa.Integer(), nullable=False, server_default="0"),

        sa.Column(
            "data_quality_score",
            sa.Float(),
            nullable=True,
        ),

        # Traceability
        sa.Column(
            "source",
            sa.String(length=64),
            nullable=False,
            server_default="UEE",
        ),
        sa.Column(
            "engine_version",
            sa.String(length=64),
            nullable=True,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_benchmark_snapshots_tenant_id",
        "benchmark_snapshots",
        ["tenant_id"],
    )

    op.create_index(
        "ix_benchmark_snapshots_snapshot_at",
        "benchmark_snapshots",
        ["snapshot_at"],
    )

    op.create_index(
        "ix_benchmark_snapshots_tenant_snapshot_at",
        "benchmark_snapshots",
        ["tenant_id", "snapshot_at"],
    )


def downgrade():
    op.drop_index(
        "ix_benchmark_snapshots_tenant_snapshot_at",
        table_name="benchmark_snapshots",
    )
    op.drop_index(
        "ix_benchmark_snapshots_snapshot_at",
        table_name="benchmark_snapshots",
    )
    op.drop_index(
        "ix_benchmark_snapshots_tenant_id",
        table_name="benchmark_snapshots",
    )
    op.drop_table("benchmark_snapshots")
