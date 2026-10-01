"""Scope PAM process attribute evaluations to audit maturity targets.

Revision ID: 20260930_audit_scoped_pa_eval
Revises: 20260930_pam_rating_options
"""

from alembic import op
import sqlalchemy as sa


revision = "20260930_audit_scoped_pa_eval"
down_revision = "20260930_pam_rating_options"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Existing rows intentionally remain NULL.
    #
    # They predate audit-target scoping and therefore must not be
    # automatically interpreted as official audit decisions.
    op.add_column(
        "pam_process_attribute_evaluations",
        sa.Column(
            "audit_maturity_target_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    op.create_foreign_key(
        "fk_pam_pa_eval_audit_maturity_target",
        "pam_process_attribute_evaluations",
        "audit_maturity_targets",
        ["audit_maturity_target_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.create_index(
        "ix_pam_pa_eval_audit_maturity_target_id",
        "pam_process_attribute_evaluations",
        ["audit_maturity_target_id"],
        unique=False,
    )

    # Do NOT remove the legacy uniqueness constraint yet.
    #
    # Existing application code still upserts evaluations by:
    #   assessment_process_id + process_attribute_id
    #
    # Removing that constraint before the service layer is changed
    # could allow duplicate legacy/unscoped evaluations.
    #
    # The audit-scoped uniqueness rule is introduced as a partial
    # unique index. PostgreSQL allows multiple NULL target IDs while
    # guaranteeing one PA decision per audit target.
    op.create_index(
        "uq_pam_pa_eval_target_attribute",
        "pam_process_attribute_evaluations",
        ["audit_maturity_target_id", "process_attribute_id"],
        unique=True,
        postgresql_where=sa.text(
            "audit_maturity_target_id IS NOT NULL"
        ),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_pam_pa_eval_target_attribute",
        table_name="pam_process_attribute_evaluations",
    )

    op.drop_index(
        "ix_pam_pa_eval_audit_maturity_target_id",
        table_name="pam_process_attribute_evaluations",
    )

    op.drop_constraint(
        "fk_pam_pa_eval_audit_maturity_target",
        "pam_process_attribute_evaluations",
        type_="foreignkey",
    )

    op.drop_column(
        "pam_process_attribute_evaluations",
        "audit_maturity_target_id",
    )
