"""add immutable audit maturity target revisions

Revision ID: 20261001_audit_target_revisions
Revises: 20260930_repair_enterprise_rbac
Create Date: 2026-10-01
"""

from alembic import op
import sqlalchemy as sa


revision = "20261001_audit_target_revisions"
down_revision = "20260930_repair_enterprise_rbac"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "audit_maturity_target_revisions",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
        ),

        sa.Column(
            "audit_maturity_target_id",
            sa.Integer(),
            sa.ForeignKey(
                "audit_maturity_targets.id",
                ondelete="RESTRICT",
            ),
            nullable=False,
        ),

        sa.Column(
            "revision_no",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "tenant_id",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "pam_assessment_id",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "assessment_process_id",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "process_attribute_id",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "standard_indicator_id",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "auditor_id",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "pa_evaluation_id",
            sa.Integer(),
            sa.ForeignKey(
                "pam_process_attribute_evaluations.id",
                ondelete="RESTRICT",
            ),
            nullable=False,
        ),

        sa.Column(
            "rating",
            sa.String(),
            nullable=False,
        ),

        sa.Column(
            "rating_justification",
            sa.Text(),
            nullable=True,
        ),

        sa.Column(
            "observation",
            sa.Text(),
            nullable=True,
        ),

        sa.Column(
            "conclusion",
            sa.Text(),
            nullable=True,
        ),

        sa.Column(
            "result",
            sa.String(32),
            nullable=True,
        ),

        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),

        sa.Column(
            "completed_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),

        sa.UniqueConstraint(
            "audit_maturity_target_id",
            "revision_no",
            name="uq_audit_maturity_target_revision_no",
        ),
    )

    op.create_index(
        "ix_audit_maturity_target_revisions_target_id",
        "audit_maturity_target_revisions",
        ["audit_maturity_target_id"],
        unique=False,
    )

    op.create_index(
        "ix_audit_maturity_target_revisions_tenant_id",
        "audit_maturity_target_revisions",
        ["tenant_id"],
        unique=False,
    )

    op.create_index(
        "ix_audit_maturity_target_revisions_pa_eval_id",
        "audit_maturity_target_revisions",
        ["pa_evaluation_id"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        "ix_audit_maturity_target_revisions_pa_eval_id",
        table_name="audit_maturity_target_revisions",
    )

    op.drop_index(
        "ix_audit_maturity_target_revisions_tenant_id",
        table_name="audit_maturity_target_revisions",
    )

    op.drop_index(
        "ix_audit_maturity_target_revisions_target_id",
        table_name="audit_maturity_target_revisions",
    )

    op.drop_table(
        "audit_maturity_target_revisions"
    )
