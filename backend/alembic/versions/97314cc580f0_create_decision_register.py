"""create decision register

Revision ID: 97314cc580f0
Revises: 36caa9ef1ffa
Create Date: 2026-08-25
"""

from alembic import op
import sqlalchemy as sa


revision = "97314cc580f0"
down_revision = "36caa9ef1ffa"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ==========================================================
    # DECISION REGISTERS
    # ==========================================================

    op.create_table(
        "decision_registers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("decision_code", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),

        sa.Column(
            "decision_type",
            sa.String(length=100),
            nullable=False,
            server_default="governance",
        ),
        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "priority",
            sa.String(length=30),
            nullable=False,
            server_default="medium",
        ),

        sa.Column("decision_date", sa.DateTime(), nullable=True),
        sa.Column("decision_maker_id", sa.Integer(), nullable=True),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.Column("approver_id", sa.Integer(), nullable=True),
        sa.Column("approval_date", sa.DateTime(), nullable=True),
        sa.Column("review_date", sa.DateTime(), nullable=True),

        sa.Column("context", sa.Text(), nullable=True),
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.Column("decision_statement", sa.Text(), nullable=False),
        sa.Column("expected_outcome", sa.Text(), nullable=True),
        sa.Column("impact_assessment", sa.Text(), nullable=True),

        sa.Column("policy_id", sa.Integer(), nullable=True),
        sa.Column("procedure_id", sa.Integer(), nullable=True),

        sa.Column(
            "is_deleted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),

        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),

        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),

        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["decision_maker_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["approver_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["updated_by"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["policy_id"],
            ["governance_policies.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["procedure_id"],
            ["governance_procedures.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_decision_registers_id",
        "decision_registers",
        ["id"],
    )
    op.create_index(
        "ix_decision_registers_tenant_id",
        "decision_registers",
        ["tenant_id"],
    )
    op.create_index(
        "ix_decision_registers_decision_code",
        "decision_registers",
        ["decision_code"],
    )
    op.create_index(
        "ix_decision_registers_decision_type",
        "decision_registers",
        ["decision_type"],
    )
    op.create_index(
        "ix_decision_registers_status",
        "decision_registers",
        ["status"],
    )
    op.create_index(
        "ix_decision_registers_priority",
        "decision_registers",
        ["priority"],
    )
    op.create_index(
        "ix_decision_registers_decision_date",
        "decision_registers",
        ["decision_date"],
    )
    op.create_index(
        "ix_decision_registers_decision_maker_id",
        "decision_registers",
        ["decision_maker_id"],
    )
    op.create_index(
        "ix_decision_registers_owner_id",
        "decision_registers",
        ["owner_id"],
    )
    op.create_index(
        "ix_decision_registers_approver_id",
        "decision_registers",
        ["approver_id"],
    )
    op.create_index(
        "ix_decision_registers_review_date",
        "decision_registers",
        ["review_date"],
    )
    op.create_index(
        "ix_decision_registers_policy_id",
        "decision_registers",
        ["policy_id"],
    )
    op.create_index(
        "ix_decision_registers_procedure_id",
        "decision_registers",
        ["procedure_id"],
    )
    op.create_index(
        "ix_decision_registers_is_deleted",
        "decision_registers",
        ["is_deleted"],
    )
    op.create_index(
        "ix_decision_registers_created_by",
        "decision_registers",
        ["created_by"],
    )
    op.create_index(
        "ix_decision_registers_updated_by",
        "decision_registers",
        ["updated_by"],
    )

    # ==========================================================
    # DECISION REGISTER HISTORY
    # ==========================================================

    op.create_table(
        "decision_register_history",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("decision_register_id", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("field_name", sa.String(length=100), nullable=True),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("performed_by", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),

        sa.ForeignKeyConstraint(
            ["decision_register_id"],
            ["decision_registers.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["performed_by"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_decision_register_history_id",
        "decision_register_history",
        ["id"],
    )
    op.create_index(
        "ix_decision_register_history_decision_register_id",
        "decision_register_history",
        ["decision_register_id"],
    )
    op.create_index(
        "ix_decision_register_history_action",
        "decision_register_history",
        ["action"],
    )
    op.create_index(
        "ix_decision_register_history_performed_by",
        "decision_register_history",
        ["performed_by"],
    )
    op.create_index(
        "ix_decision_register_history_created_at",
        "decision_register_history",
        ["created_at"],
    )

    # ==========================================================
    # DECISION REGISTER RISKS
    # ==========================================================

    op.create_table(
        "decision_register_risks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("decision_register_id", sa.Integer(), nullable=False),
        sa.Column("risk_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),

        sa.ForeignKeyConstraint(
            ["decision_register_id"],
            ["decision_registers.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["risk_id"],
            ["risks.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "decision_register_id",
            "risk_id",
            name="uq_decision_register_risk",
        ),
    )

    op.create_index(
        "ix_decision_register_risks_id",
        "decision_register_risks",
        ["id"],
    )
    op.create_index(
        "ix_decision_register_risks_decision_register_id",
        "decision_register_risks",
        ["decision_register_id"],
    )
    op.create_index(
        "ix_decision_register_risks_risk_id",
        "decision_register_risks",
        ["risk_id"],
    )

    # ==========================================================
    # DECISION REGISTER CONTROLS
    # ==========================================================

    op.create_table(
        "decision_register_controls",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("decision_register_id", sa.Integer(), nullable=False),
        sa.Column("control_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),

        sa.ForeignKeyConstraint(
            ["decision_register_id"],
            ["decision_registers.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["control_id"],
            ["controls.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "decision_register_id",
            "control_id",
            name="uq_decision_register_control",
        ),
    )

    op.create_index(
        "ix_decision_register_controls_id",
        "decision_register_controls",
        ["id"],
    )
    op.create_index(
        "ix_decision_register_controls_decision_register_id",
        "decision_register_controls",
        ["decision_register_id"],
    )
    op.create_index(
        "ix_decision_register_controls_control_id",
        "decision_register_controls",
        ["control_id"],
    )

    # ==========================================================
    # DECISION REGISTER PROCESSES
    # ==========================================================

    op.create_table(
        "decision_register_processes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("decision_register_id", sa.Integer(), nullable=False),
        sa.Column("process_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),

        sa.ForeignKeyConstraint(
            ["decision_register_id"],
            ["decision_registers.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["process_id"],
            ["processes.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "decision_register_id",
            "process_id",
            name="uq_decision_register_process",
        ),
    )

    op.create_index(
        "ix_decision_register_processes_id",
        "decision_register_processes",
        ["id"],
    )
    op.create_index(
        "ix_decision_register_processes_decision_register_id",
        "decision_register_processes",
        ["decision_register_id"],
    )
    op.create_index(
        "ix_decision_register_processes_process_id",
        "decision_register_processes",
        ["process_id"],
    )

    # ==========================================================
    # DECISION REGISTER TASKS
    # ==========================================================

    op.create_table(
        "decision_register_tasks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("decision_register_id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),

        sa.ForeignKeyConstraint(
            ["decision_register_id"],
            ["decision_registers.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["task_id"],
            ["compliance_tasks.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "decision_register_id",
            "task_id",
            name="uq_decision_register_task",
        ),
    )

    op.create_index(
        "ix_decision_register_tasks_id",
        "decision_register_tasks",
        ["id"],
    )
    op.create_index(
        "ix_decision_register_tasks_decision_register_id",
        "decision_register_tasks",
        ["decision_register_id"],
    )
    op.create_index(
        "ix_decision_register_tasks_task_id",
        "decision_register_tasks",
        ["task_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_decision_register_tasks_task_id",
        table_name="decision_register_tasks",
    )
    op.drop_index(
        "ix_decision_register_tasks_decision_register_id",
        table_name="decision_register_tasks",
    )
    op.drop_index(
        "ix_decision_register_tasks_id",
        table_name="decision_register_tasks",
    )
    op.drop_table("decision_register_tasks")

    op.drop_index(
        "ix_decision_register_processes_process_id",
        table_name="decision_register_processes",
    )
    op.drop_index(
        "ix_decision_register_processes_decision_register_id",
        table_name="decision_register_processes",
    )
    op.drop_index(
        "ix_decision_register_processes_id",
        table_name="decision_register_processes",
    )
    op.drop_table("decision_register_processes")

    op.drop_index(
        "ix_decision_register_controls_control_id",
        table_name="decision_register_controls",
    )
    op.drop_index(
        "ix_decision_register_controls_decision_register_id",
        table_name="decision_register_controls",
    )
    op.drop_index(
        "ix_decision_register_controls_id",
        table_name="decision_register_controls",
    )
    op.drop_table("decision_register_controls")

    op.drop_index(
        "ix_decision_register_risks_risk_id",
        table_name="decision_register_risks",
    )
    op.drop_index(
        "ix_decision_register_risks_decision_register_id",
        table_name="decision_register_risks",
    )
    op.drop_index(
        "ix_decision_register_risks_id",
        table_name="decision_register_risks",
    )
    op.drop_table("decision_register_risks")

    op.drop_index(
        "ix_decision_register_history_created_at",
        table_name="decision_register_history",
    )
    op.drop_index(
        "ix_decision_register_history_performed_by",
        table_name="decision_register_history",
    )
    op.drop_index(
        "ix_decision_register_history_action",
        table_name="decision_register_history",
    )
    op.drop_index(
        "ix_decision_register_history_decision_register_id",
        table_name="decision_register_history",
    )
    op.drop_index(
        "ix_decision_register_history_id",
        table_name="decision_register_history",
    )
    op.drop_table("decision_register_history")

    op.drop_index(
        "ix_decision_registers_updated_by",
        table_name="decision_registers",
    )
    op.drop_index(
        "ix_decision_registers_created_by",
        table_name="decision_registers",
    )
    op.drop_index(
        "ix_decision_registers_is_deleted",
        table_name="decision_registers",
    )
    op.drop_index(
        "ix_decision_registers_procedure_id",
        table_name="decision_registers",
    )
    op.drop_index(
        "ix_decision_registers_policy_id",
        table_name="decision_registers",
    )
    op.drop_index(
        "ix_decision_registers_review_date",
        table_name="decision_registers",
    )
    op.drop_index(
        "ix_decision_registers_approver_id",
        table_name="decision_registers",
    )
    op.drop_index(
        "ix_decision_registers_owner_id",
        table_name="decision_registers",
    )
    op.drop_index(
        "ix_decision_registers_decision_maker_id",
        table_name="decision_registers",
    )
    op.drop_index(
        "ix_decision_registers_decision_date",
        table_name="decision_registers",
    )
    op.drop_index(
        "ix_decision_registers_priority",
        table_name="decision_registers",
    )
    op.drop_index(
        "ix_decision_registers_status",
        table_name="decision_registers",
    )
    op.drop_index(
        "ix_decision_registers_decision_type",
        table_name="decision_registers",
    )
    op.drop_index(
        "ix_decision_registers_decision_code",
        table_name="decision_registers",
    )
    op.drop_index(
        "ix_decision_registers_tenant_id",
        table_name="decision_registers",
    )
    op.drop_index(
        "ix_decision_registers_id",
        table_name="decision_registers",
    )
    op.drop_table("decision_registers")
