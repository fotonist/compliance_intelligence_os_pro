"""Split legacy and audit-scoped PA evaluation uniqueness.

Revision ID: 20260930_split_pa_eval_unique
Revises: 20260930_audit_scoped_pa_eval
"""

from alembic import op
import sqlalchemy as sa


revision = "20260930_split_pa_eval_unique"
down_revision = "20260930_audit_scoped_pa_eval"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The former constraint prevented more than one PA evaluation
    # for the same assessment process + process attribute, even when
    # evaluations belonged to different audit targets.
    op.drop_constraint(
        "uq_pam_process_attribute_evaluation",
        "pam_process_attribute_evaluations",
        type_="unique",
    )

    # Preserve the historical/unscoped behavior:
    # at most one legacy evaluation per assessment process + PA.
    op.create_index(
        "uq_pam_pa_eval_legacy_scope",
        "pam_process_attribute_evaluations",
        [
            "assessment_process_id",
            "process_attribute_id",
        ],
        unique=True,
        postgresql_where=sa.text(
            "audit_maturity_target_id IS NULL"
        ),
    )

    # Audit-scoped uniqueness was introduced by the previous
    # migration:
    #
    # uq_pam_pa_eval_target_attribute
    #   (audit_maturity_target_id, process_attribute_id)
    #   WHERE audit_maturity_target_id IS NOT NULL


def downgrade() -> None:
    op.drop_index(
        "uq_pam_pa_eval_legacy_scope",
        table_name="pam_process_attribute_evaluations",
    )

    op.create_unique_constraint(
        "uq_pam_process_attribute_evaluation",
        "pam_process_attribute_evaluations",
        [
            "assessment_process_id",
            "process_attribute_id",
        ],
    )
