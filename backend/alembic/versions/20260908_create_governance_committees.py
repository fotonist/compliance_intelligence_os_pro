"""create governance committees infrastructure

Revision ID: 20260908_create_governance_committees
Revises: 20260908_document_control_review_definition
Create Date: 2026-09-08
"""

from alembic import op
import sqlalchemy as sa


revision = "20260908_create_governance_committees"
down_revision = "20260908_document_control_review_definition"
branch_labels = None
depends_on = None


def upgrade():
    # ----------------------------------------------------------
    # Governance Committees
    # ----------------------------------------------------------

    op.create_table(
        "governance_committees",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("committee_code", sa.String(100), nullable=False),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("committee_type", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "chairperson_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "secretary_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.String(50),
            nullable=False,
            server_default="ACTIVE",
        ),
        sa.Column("meeting_cadence", sa.String(100), nullable=True),
        sa.Column("effective_date", sa.Date(), nullable=True),
        sa.Column("review_date", sa.Date(), nullable=True),
        sa.Column(
            "created_by",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "updated_by",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
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
        sa.UniqueConstraint(
            "tenant_id",
            "id",
            name="uq_governance_committees_tenant_id_id",
        ),
    )

    op.create_index(
        "ix_governance_committees_tenant_id",
        "governance_committees",
        ["tenant_id"],
    )

    op.create_index(
        "ix_governance_committees_committee_code",
        "governance_committees",
        ["committee_code"],
    )

    op.create_index(
        "ix_governance_committees_status",
        "governance_committees",
        ["status"],
    )

    op.create_index(
        "uq_governance_committees_tenant_code",
        "governance_committees",
        ["tenant_id", "committee_code"],
        unique=True,
    )

    # ----------------------------------------------------------
    # Committee Members
    # ----------------------------------------------------------

    op.create_table(
        "governance_committee_members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "committee_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "member_role",
            sa.String(100),
            nullable=False,
            server_default="MEMBER",
        ),
        sa.Column(
            "is_voting_member",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column(
            "status",
            sa.String(50),
            nullable=False,
            server_default="ACTIVE",
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
        sa.ForeignKeyConstraint(
            ["tenant_id", "committee_id"],
            ["governance_committees.tenant_id", "governance_committees.id"],
            name="fk_governance_committee_members_committee_tenant",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "committee_id",
            "user_id",
            name="uq_governance_committee_member",
        ),
    )

    op.create_index(
        "ix_governance_committee_members_tenant_id",
        "governance_committee_members",
        ["tenant_id"],
    )

    op.create_index(
        "ix_governance_committee_members_committee_id",
        "governance_committee_members",
        ["committee_id"],
    )

    op.create_index(
        "ix_governance_committee_members_user_id",
        "governance_committee_members",
        ["user_id"],
    )

    op.create_index(
        "ix_governance_committee_members_status",
        "governance_committee_members",
        ["status"],
    )

    # ----------------------------------------------------------
    # Link Governance Meetings to Committees
    # ----------------------------------------------------------

    op.add_column(
        "governance_meetings",
        sa.Column(
            "committee_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    op.create_foreign_key(
        "fk_governance_meetings_committee_id",
        "governance_meetings",
        "governance_committees",
        ["committee_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_index(
        "ix_governance_meetings_committee_id",
        "governance_meetings",
        ["committee_id"],
    )


def downgrade():
    op.drop_index(
        "ix_governance_meetings_committee_id",
        table_name="governance_meetings",
    )

    op.drop_constraint(
        "fk_governance_meetings_committee_id",
        "governance_meetings",
        type_="foreignkey",
    )

    op.drop_column(
        "governance_meetings",
        "committee_id",
    )

    op.drop_index(
        "ix_governance_committee_members_user_id",
        table_name="governance_committee_members",
    )

    op.drop_index(
        "ix_governance_committee_members_status",
        table_name="governance_committee_members",
    )

    op.drop_index(
        "ix_governance_committee_members_committee_id",
        table_name="governance_committee_members",
    )

    op.drop_index(
        "ix_governance_committee_members_tenant_id",
        table_name="governance_committee_members",
    )

    op.drop_constraint(
        "uq_governance_committee_member",
        "governance_committee_members",
        type_="unique",
    )

    op.drop_constraint(
        "fk_governance_committee_members_committee_tenant",
        "governance_committee_members",
        type_="foreignkey",
    )

    op.drop_table("governance_committee_members")

    op.drop_index(
        "uq_governance_committees_tenant_code",
        table_name="governance_committees",
    )

    op.drop_index(
        "ix_governance_committees_status",
        table_name="governance_committees",
    )

    op.drop_index(
        "ix_governance_committees_committee_code",
        table_name="governance_committees",
    )

    op.drop_index(
        "ix_governance_committees_tenant_id",
        table_name="governance_committees",
    )

    op.drop_table("governance_committees")
