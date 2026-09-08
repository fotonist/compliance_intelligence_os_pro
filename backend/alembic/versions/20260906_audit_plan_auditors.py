from alembic import op
import sqlalchemy as sa


revision = "20260906_audit_plan_auditors"
down_revision = "20260906_process_applicable_controls"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "audit_plan_auditors",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("audit_plan_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column(
            "assignment_role",
            sa.String(length=32),
            nullable=False,
            server_default="AUDITOR",
        ),
        sa.Column("assigned_scope", sa.Text(), nullable=True),
        sa.Column("assigned_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["audit_plan_id"],
            ["audit_plans.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "tenant_id",
            "audit_plan_id",
            "user_id",
            name="uq_audit_plan_auditor",
        ),
    )

    op.create_index(
        "ix_audit_plan_auditors_id",
        "audit_plan_auditors",
        ["id"],
        unique=False,
    )
    op.create_index(
        "ix_audit_plan_auditors_tenant_id",
        "audit_plan_auditors",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        "ix_audit_plan_auditors_audit_plan_id",
        "audit_plan_auditors",
        ["audit_plan_id"],
        unique=False,
    )
    op.create_index(
        "ix_audit_plan_auditors_user_id",
        "audit_plan_auditors",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_audit_plan_auditors_assignment_role",
        "audit_plan_auditors",
        ["assignment_role"],
        unique=False,
    )

    op.add_column(
        "actions",
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
    )

    op.add_column(
        "actions",
        sa.Column("assigned_to_user_id", sa.Integer(), nullable=True),
    )

    op.add_column(
        "actions",
        sa.Column("reviewer_user_id", sa.Integer(), nullable=True),
    )

    op.add_column(
        "actions",
        sa.Column("closed_by_user_id", sa.Integer(), nullable=True),
    )

    op.add_column(
        "actions",
        sa.Column("assigned_at", sa.DateTime(), nullable=True),
    )

    op.add_column(
        "actions",
        sa.Column("started_at", sa.DateTime(), nullable=True),
    )

    op.add_column(
        "actions",
        sa.Column("submitted_for_review_at", sa.DateTime(), nullable=True),
    )

    op.add_column(
        "actions",
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
    )

    op.add_column(
        "actions",
        sa.Column("verified_at", sa.DateTime(), nullable=True),
    )

    op.add_column(
        "actions",
        sa.Column("closed_at", sa.DateTime(), nullable=True),
    )

    op.add_column(
        "actions",
        sa.Column("review_comment", sa.Text(), nullable=True),
    )

    op.add_column(
        "actions",
        sa.Column("verification_comment", sa.Text(), nullable=True),
    )

    op.add_column(
        "actions",
        sa.Column("closure_comment", sa.Text(), nullable=True),
    )

    op.create_foreign_key(
        "fk_actions_created_by_user",
        "actions",
        "users",
        ["created_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_foreign_key(
        "fk_actions_assigned_to_user",
        "actions",
        "users",
        ["assigned_to_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_foreign_key(
        "fk_actions_reviewer_user",
        "actions",
        "users",
        ["reviewer_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_foreign_key(
        "fk_actions_closed_by_user",
        "actions",
        "users",
        ["closed_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index(
        "ix_actions_created_by_user_id",
        "actions",
        ["created_by_user_id"],
        unique=False,
    )

    op.create_index(
        "ix_actions_assigned_to_user_id",
        "actions",
        ["assigned_to_user_id"],
        unique=False,
    )

    op.create_index(
        "ix_actions_reviewer_user_id",
        "actions",
        ["reviewer_user_id"],
        unique=False,
    )

    op.create_index(
        "ix_actions_closed_by_user_id",
        "actions",
        ["closed_by_user_id"],
        unique=False,
    )

    op.create_table(
        "action_lifecycle_history",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("action_id", sa.Integer(), nullable=False),
        sa.Column("from_status", sa.String(length=40), nullable=True),
        sa.Column("to_status", sa.String(length=40), nullable=False),
        sa.Column("performed_by_user_id", sa.Integer(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["action_id"],
            ["actions.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["performed_by_user_id"],
            ["users.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_action_lifecycle_history_action_id",
        "action_lifecycle_history",
        ["action_id"],
        unique=False,
    )

    op.create_index(
        "ix_action_lifecycle_history_performed_by_user_id",
        "action_lifecycle_history",
        ["performed_by_user_id"],
        unique=False,
    )

    op.create_index(
        "ix_action_lifecycle_history_created_at",
        "action_lifecycle_history",
        ["created_at"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        "ix_action_lifecycle_history_created_at",
        table_name="action_lifecycle_history",
    )

    op.drop_index(
        "ix_action_lifecycle_history_performed_by_user_id",
        table_name="action_lifecycle_history",
    )

    op.drop_index(
        "ix_action_lifecycle_history_action_id",
        table_name="action_lifecycle_history",
    )

    op.drop_table("action_lifecycle_history")

    op.drop_index(
        "ix_actions_closed_by_user_id",
        table_name="actions",
    )

    op.drop_index(
        "ix_actions_reviewer_user_id",
        table_name="actions",
    )

    op.drop_index(
        "ix_actions_assigned_to_user_id",
        table_name="actions",
    )

    op.drop_index(
        "ix_actions_created_by_user_id",
        table_name="actions",
    )

    op.drop_constraint(
        "fk_actions_closed_by_user",
        "actions",
        type_="foreignkey",
    )

    op.drop_constraint(
        "fk_actions_reviewer_user",
        "actions",
        type_="foreignkey",
    )

    op.drop_constraint(
        "fk_actions_assigned_to_user",
        "actions",
        type_="foreignkey",
    )

    op.drop_constraint(
        "fk_actions_created_by_user",
        "actions",
        type_="foreignkey",
    )

    op.drop_column("actions", "closure_comment")
    op.drop_column("actions", "verification_comment")
    op.drop_column("actions", "review_comment")
    op.drop_column("actions", "closed_at")
    op.drop_column("actions", "verified_at")
    op.drop_column("actions", "reviewed_at")
    op.drop_column("actions", "submitted_for_review_at")
    op.drop_column("actions", "started_at")
    op.drop_column("actions", "assigned_at")
    op.drop_column("actions", "closed_by_user_id")
    op.drop_column("actions", "reviewer_user_id")
    op.drop_column("actions", "assigned_to_user_id")
    op.drop_column("actions", "created_by_user_id")

    op.drop_index(
        "ix_audit_plan_auditors_assignment_role",
        table_name="audit_plan_auditors",
    )
    op.drop_index(
        "ix_audit_plan_auditors_user_id",
        table_name="audit_plan_auditors",
    )
    op.drop_index(
        "ix_audit_plan_auditors_audit_plan_id",
        table_name="audit_plan_auditors",
    )
    op.drop_index(
        "ix_audit_plan_auditors_tenant_id",
        table_name="audit_plan_auditors",
    )
    op.drop_index(
        "ix_audit_plan_auditors_id",
        table_name="audit_plan_auditors",
    )
    op.drop_table("audit_plan_auditors")
