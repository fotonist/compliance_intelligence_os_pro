"""add control health intelligence weights

Revision ID: db0cca247dc5
Revises: 1ae9d29d5bee
Create Date: 2026-08-26 16:02:07.439182
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "db0cca247dc5"
down_revision = "1ae9d29d5bee"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "intelligence_model_configs",
        sa.Column(
            "control_health_coverage_weight",
            sa.Float(),
            nullable=True,
        ),
    )

    op.add_column(
        "intelligence_model_configs",
        sa.Column(
            "control_health_evidence_weight",
            sa.Float(),
            nullable=True,
        ),
    )

    op.add_column(
        "intelligence_model_configs",
        sa.Column(
            "control_health_risk_weight",
            sa.Float(),
            nullable=True,
        ),
    )

    op.add_column(
        "intelligence_model_configs",
        sa.Column(
            "control_health_gap_weight",
            sa.Float(),
            nullable=True,
        ),
    )

    op.add_column(
        "intelligence_model_configs",
        sa.Column(
            "control_health_remediation_weight",
            sa.Float(),
            nullable=True,
        ),
    )

    op.execute(
        sa.text(
            """
            UPDATE intelligence_model_configs
            SET
                control_health_coverage_weight = 0.30,
                control_health_evidence_weight = 0.20,
                control_health_risk_weight = 0.20,
                control_health_gap_weight = 0.20,
                control_health_remediation_weight = 0.10
            WHERE
                control_health_coverage_weight IS NULL
                OR control_health_evidence_weight IS NULL
                OR control_health_risk_weight IS NULL
                OR control_health_gap_weight IS NULL
                OR control_health_remediation_weight IS NULL
            """
        )
    )

    op.alter_column(
        "intelligence_model_configs",
        "control_health_coverage_weight",
        nullable=False,
    )

    op.alter_column(
        "intelligence_model_configs",
        "control_health_evidence_weight",
        nullable=False,
    )

    op.alter_column(
        "intelligence_model_configs",
        "control_health_risk_weight",
        nullable=False,
    )

    op.alter_column(
        "intelligence_model_configs",
        "control_health_gap_weight",
        nullable=False,
    )

    op.alter_column(
        "intelligence_model_configs",
        "control_health_remediation_weight",
        nullable=False,
    )


def downgrade():
    op.drop_column(
        "intelligence_model_configs",
        "control_health_remediation_weight",
    )

    op.drop_column(
        "intelligence_model_configs",
        "control_health_gap_weight",
    )

    op.drop_column(
        "intelligence_model_configs",
        "control_health_risk_weight",
    )

    op.drop_column(
        "intelligence_model_configs",
        "control_health_evidence_weight",
    )

    op.drop_column(
        "intelligence_model_configs",
        "control_health_coverage_weight",
    )
