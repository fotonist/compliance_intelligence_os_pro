"""add audit finding remediation workflow

Revision ID: 7b8d2f1a4c6e
Revises: 99dbe9d13027
Create Date: 2026-08-16 08:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "7b8d2f1a4c6e"
down_revision = "99dbe9d13027"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "audit_finding_records",
        "status",
        existing_type=sa.String(length=32),
        type_=sa.String(length=40),
        existing_nullable=False,
    )

    op.add_column(
        "audit_finding_records",
        sa.Column("assigned_owner_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "audit_finding_records",
        sa.Column("process_manager_id", sa.Integer(), nullable=True),
    )

    op.add_column("audit_finding_records", sa.Column("correction", sa.Text(), nullable=True))
    op.add_column("audit_finding_records", sa.Column("corrective_action_plan", sa.Text(), nullable=True))
    op.add_column("audit_finding_records", sa.Column("owner_submitted_at", sa.DateTime(), nullable=True))
    op.add_column("audit_finding_records", sa.Column("owner_submitted_by", sa.Integer(), nullable=True))

    op.add_column(
        "audit_finding_records",
        sa.Column("manager_review_status", sa.String(length=32), nullable=False, server_default="NOT_SUBMITTED"),
    )
    op.add_column("audit_finding_records", sa.Column("manager_review_comment", sa.Text(), nullable=True))
    op.add_column("audit_finding_records", sa.Column("manager_reviewed_by", sa.Integer(), nullable=True))
    op.add_column("audit_finding_records", sa.Column("manager_reviewed_at", sa.DateTime(), nullable=True))

    op.add_column(
        "audit_finding_records",
        sa.Column("implementation_status", sa.String(length=32), nullable=False, server_default="NOT_STARTED"),
    )
    op.add_column("audit_finding_records", sa.Column("implementation_completed_at", sa.DateTime(), nullable=True))
    op.add_column("audit_finding_records", sa.Column("implementation_evidence", sa.Text(), nullable=True))

    op.add_column(
        "audit_finding_records",
        sa.Column("verification_status", sa.String(length=32), nullable=False, server_default="NOT_READY"),
    )
    op.add_column("audit_finding_records", sa.Column("verification_comment", sa.Text(), nullable=True))
    op.add_column("audit_finding_records", sa.Column("verified_by", sa.Integer(), nullable=True))
    op.add_column("audit_finding_records", sa.Column("verified_at", sa.DateTime(), nullable=True))

    op.add_column("audit_finding_records", sa.Column("closed_by", sa.Integer(), nullable=True))
    op.add_column("audit_finding_records", sa.Column("closed_at", sa.DateTime(), nullable=True))
    op.add_column("audit_finding_records", sa.Column("closure_comment", sa.Text(), nullable=True))

    op.create_index("ix_audit_finding_records_assigned_owner_id", "audit_finding_records", ["assigned_owner_id"])
    op.create_index("ix_audit_finding_records_process_manager_id", "audit_finding_records", ["process_manager_id"])
    op.create_index("ix_audit_finding_records_owner_submitted_by", "audit_finding_records", ["owner_submitted_by"])
    op.create_index("ix_audit_finding_records_manager_reviewed_by", "audit_finding_records", ["manager_reviewed_by"])
    op.create_index("ix_audit_finding_records_verified_by", "audit_finding_records", ["verified_by"])
    op.create_index("ix_audit_finding_records_closed_by", "audit_finding_records", ["closed_by"])

    op.create_foreign_key(
        "fk_audit_finding_records_assigned_owner",
        "audit_finding_records",
        "users",
        ["assigned_owner_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_audit_finding_records_process_manager",
        "audit_finding_records",
        "users",
        ["process_manager_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_audit_finding_records_owner_submitted_by",
        "audit_finding_records",
        "users",
        ["owner_submitted_by"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_audit_finding_records_manager_reviewed_by",
        "audit_finding_records",
        "users",
        ["manager_reviewed_by"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_audit_finding_records_verified_by",
        "audit_finding_records",
        "users",
        ["verified_by"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_audit_finding_records_closed_by",
        "audit_finding_records",
        "users",
        ["closed_by"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "audit_finding_workflow_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "finding_id",
            sa.Integer(),
            sa.ForeignKey("audit_finding_records.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("actor_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("actor_role", sa.String(length=100), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("from_status", sa.String(length=40), nullable=True),
        sa.Column("to_status", sa.String(length=40), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_audit_finding_workflow_events_tenant_id", "audit_finding_workflow_events", ["tenant_id"])
    op.create_index("ix_audit_finding_workflow_events_finding_id", "audit_finding_workflow_events", ["finding_id"])
    op.create_index("ix_audit_finding_workflow_events_actor_id", "audit_finding_workflow_events", ["actor_id"])
    op.create_index("ix_audit_finding_workflow_events_created_at", "audit_finding_workflow_events", ["created_at"])

    op.alter_column("audit_finding_records", "manager_review_status", server_default=None)
    op.alter_column("audit_finding_records", "implementation_status", server_default=None)
    op.alter_column("audit_finding_records", "verification_status", server_default=None)


def downgrade():
    op.drop_index("ix_audit_finding_workflow_events_created_at", table_name="audit_finding_workflow_events")
    op.drop_index("ix_audit_finding_workflow_events_actor_id", table_name="audit_finding_workflow_events")
    op.drop_index("ix_audit_finding_workflow_events_finding_id", table_name="audit_finding_workflow_events")
    op.drop_index("ix_audit_finding_workflow_events_tenant_id", table_name="audit_finding_workflow_events")
    op.drop_table("audit_finding_workflow_events")

    for name in (
        "fk_audit_finding_records_closed_by",
        "fk_audit_finding_records_verified_by",
        "fk_audit_finding_records_manager_reviewed_by",
        "fk_audit_finding_records_owner_submitted_by",
        "fk_audit_finding_records_process_manager",
        "fk_audit_finding_records_assigned_owner",
    ):
        op.drop_constraint(name, "audit_finding_records", type_="foreignkey")

    for name in (
        "ix_audit_finding_records_closed_by",
        "ix_audit_finding_records_verified_by",
        "ix_audit_finding_records_manager_reviewed_by",
        "ix_audit_finding_records_owner_submitted_by",
        "ix_audit_finding_records_process_manager_id",
        "ix_audit_finding_records_assigned_owner_id",
    ):
        op.drop_index(name, table_name="audit_finding_records")

    for column in (
        "closure_comment",
        "closed_at",
        "closed_by",
        "verified_at",
        "verified_by",
        "verification_comment",
        "verification_status",
        "implementation_evidence",
        "implementation_completed_at",
        "implementation_status",
        "manager_reviewed_at",
        "manager_reviewed_by",
        "manager_review_comment",
        "manager_review_status",
        "owner_submitted_by",
        "owner_submitted_at",
        "corrective_action_plan",
        "correction",
        "process_manager_id",
        "assigned_owner_id",
    ):
        op.drop_column("audit_finding_records", column)

    op.alter_column(
        "audit_finding_records",
        "status",
        existing_type=sa.String(length=40),
        type_=sa.String(length=32),
        existing_nullable=False,
    )
