"""create governance meetings infrastructure

Revision ID: 20260828_governance_meetings
Revises: 20260827_identity_verification
Create Date: 2026-08-28
"""

from alembic import op
import sqlalchemy as sa


revision = "20260828_governance_meetings"
down_revision = "20260827_identity_verification"
branch_labels = None
depends_on = None


def upgrade():
    # ----------------------------------------------------------
    # Governance Meetings
    # ----------------------------------------------------------

    op.create_table(
        "governance_meetings",
        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
        ),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey(
                "tenants.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        sa.Column(
            "meeting_code",
            sa.String(100),
            nullable=False,
        ),
        sa.Column(
            "title",
            sa.String(500),
            nullable=False,
        ),
        sa.Column(
            "meeting_type",
            sa.String(100),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(50),
            nullable=False,
            server_default="SCHEDULED",
        ),
        sa.Column(
            "scheduled_at",
            sa.DateTime(),
            nullable=False,
        ),
        sa.Column(
            "duration_minutes",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "location",
            sa.String(500),
            nullable=True,
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "chairperson_id",
            sa.Integer(),
            sa.ForeignKey(
                "users.id",
                ondelete="SET NULL",
            ),
            nullable=True,
        ),
        sa.Column(
            "created_by",
            sa.Integer(),
            sa.ForeignKey(
                "users.id",
                ondelete="SET NULL",
            ),
            nullable=True,
        ),
        sa.Column(
            "updated_by",
            sa.Integer(),
            sa.ForeignKey(
                "users.id",
                ondelete="SET NULL",
            ),
            nullable=True,
        ),
        sa.Column(
            "is_deleted",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
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
    )

    op.create_index(
        "ix_governance_meetings_tenant_id",
        "governance_meetings",
        ["tenant_id"],
    )

    op.create_index(
        "ix_governance_meetings_meeting_code",
        "governance_meetings",
        ["meeting_code"],
    )

    op.create_index(
        "ix_governance_meetings_status",
        "governance_meetings",
        ["status"],
    )

    op.create_index(
        "ix_governance_meetings_scheduled_at",
        "governance_meetings",
        ["scheduled_at"],
    )

    op.create_index(
        "uq_governance_meetings_tenant_code",
        "governance_meetings",
        ["tenant_id", "meeting_code"],
        unique=True,
    )

    # ----------------------------------------------------------
    # Participants
    # ----------------------------------------------------------

    op.create_table(
        "governance_meeting_participants",
        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
        ),
        sa.Column(
            "meeting_id",
            sa.Integer(),
            sa.ForeignKey(
                "governance_meetings.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey(
                "users.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        sa.Column(
            "role",
            sa.String(50),
            nullable=False,
            server_default="ATTENDEE",
        ),
        sa.Column(
            "attendance_status",
            sa.String(50),
            nullable=False,
            server_default="INVITED",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "ix_governance_meeting_participants_meeting_id",
        "governance_meeting_participants",
        ["meeting_id"],
    )

    op.create_index(
        "ix_governance_meeting_participants_user_id",
        "governance_meeting_participants",
        ["user_id"],
    )

    op.create_index(
        "uq_governance_meeting_participant",
        "governance_meeting_participants",
        ["meeting_id", "user_id"],
        unique=True,
    )

    # ----------------------------------------------------------
    # Agenda Items
    # ----------------------------------------------------------

    op.create_table(
        "governance_meeting_agenda_items",
        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
        ),
        sa.Column(
            "meeting_id",
            sa.Integer(),
            sa.ForeignKey(
                "governance_meetings.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        sa.Column(
            "item_order",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "title",
            sa.String(500),
            nullable=False,
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "presenter_id",
            sa.Integer(),
            sa.ForeignKey(
                "users.id",
                ondelete="SET NULL",
            ),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.String(50),
            nullable=False,
            server_default="PENDING",
        ),
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
    )

    op.create_index(
        "ix_governance_meeting_agenda_items_meeting_id",
        "governance_meeting_agenda_items",
        ["meeting_id"],
    )

    # ----------------------------------------------------------
    # Meeting -> Decision Register
    # ----------------------------------------------------------

    op.create_table(
        "governance_meeting_decisions",
        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
        ),
        sa.Column(
            "meeting_id",
            sa.Integer(),
            sa.ForeignKey(
                "governance_meetings.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        sa.Column(
            "decision_register_id",
            sa.Integer(),
            sa.ForeignKey(
                "decision_registers.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "ix_governance_meeting_decisions_meeting_id",
        "governance_meeting_decisions",
        ["meeting_id"],
    )

    op.create_index(
        "ix_governance_meeting_decisions_decision_id",
        "governance_meeting_decisions",
        ["decision_register_id"],
    )

    op.create_index(
        "uq_governance_meeting_decision",
        "governance_meeting_decisions",
        ["meeting_id", "decision_register_id"],
        unique=True,
    )

    # ----------------------------------------------------------
    # Meeting -> Action
    # ----------------------------------------------------------

    op.create_table(
        "governance_meeting_actions",
        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
        ),
        sa.Column(
            "meeting_id",
            sa.Integer(),
            sa.ForeignKey(
                "governance_meetings.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        sa.Column(
            "action_id",
            sa.Integer(),
            sa.ForeignKey(
                "actions.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "ix_governance_meeting_actions_meeting_id",
        "governance_meeting_actions",
        ["meeting_id"],
    )

    op.create_index(
        "ix_governance_meeting_actions_action_id",
        "governance_meeting_actions",
        ["action_id"],
    )

    op.create_index(
        "uq_governance_meeting_action",
        "governance_meeting_actions",
        ["meeting_id", "action_id"],
        unique=True,
    )

    # ----------------------------------------------------------
    # Meeting History / Audit
    # ----------------------------------------------------------

    op.create_table(
        "governance_meeting_history",
        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
        ),
        sa.Column(
            "meeting_id",
            sa.Integer(),
            sa.ForeignKey(
                "governance_meetings.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        sa.Column(
            "action",
            sa.String(100),
            nullable=False,
        ),
        sa.Column(
            "field_name",
            sa.String(100),
            nullable=True,
        ),
        sa.Column(
            "old_value",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "new_value",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "comment",
            sa.String(5000),
            nullable=True,
        ),
        sa.Column(
            "performed_by",
            sa.Integer(),
            sa.ForeignKey(
                "users.id",
                ondelete="SET NULL",
            ),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "ix_governance_meeting_history_meeting_id",
        "governance_meeting_history",
        ["meeting_id"],
    )

    op.create_index(
        "ix_governance_meeting_history_performed_by",
        "governance_meeting_history",
        ["performed_by"],
    )


def downgrade():
    op.drop_table("governance_meeting_history")
    op.drop_table("governance_meeting_actions")
    op.drop_table("governance_meeting_decisions")
    op.drop_table("governance_meeting_agenda_items")
    op.drop_table("governance_meeting_participants")
    op.drop_index(
        "uq_governance_meetings_tenant_code",
        table_name="governance_meetings",
    )
    op.drop_index(
        "ix_governance_meetings_scheduled_at",
        table_name="governance_meetings",
    )
    op.drop_index(
        "ix_governance_meetings_status",
        table_name="governance_meetings",
    )
    op.drop_index(
        "ix_governance_meetings_meeting_code",
        table_name="governance_meetings",
    )
    op.drop_index(
        "ix_governance_meetings_tenant_id",
        table_name="governance_meetings",
    )
    op.drop_table("governance_meetings")
