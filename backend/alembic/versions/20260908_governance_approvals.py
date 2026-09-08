"""create governance approvals and delegations

Revision ID: 20260908_governance_approvals
Revises: 20260908_governance_committee_rbac
Create Date: 2026-09-08
"""

from alembic import op
import sqlalchemy as sa


revision = "20260908_governance_approvals"
down_revision = "20260908_governance_committee_rbac"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "governance_approval_authorities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("authority_code", sa.String(100), nullable=False),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("authority_type", sa.String(100), nullable=False),
        sa.Column("scope", sa.Text(), nullable=True),
        sa.Column(
            "approver_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("approval_limit", sa.Numeric(18, 2), nullable=True),
        sa.Column("currency", sa.String(10), nullable=True),
        sa.Column("effective_date", sa.Date(), nullable=True),
        sa.Column("review_date", sa.Date(), nullable=True),
        sa.Column(
            "status",
            sa.String(50),
            nullable=False,
            server_default="ACTIVE",
        ),
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
    )

    op.create_index(
        "ix_governance_approval_authorities_tenant_id",
        "governance_approval_authorities",
        ["tenant_id"],
    )
    op.create_index(
        "ix_governance_approval_authorities_authority_code",
        "governance_approval_authorities",
        ["authority_code"],
    )
    op.create_index(
        "ix_governance_approval_authorities_authority_type",
        "governance_approval_authorities",
        ["authority_type"],
    )
    op.create_index(
        "ix_governance_approval_authorities_approver_id",
        "governance_approval_authorities",
        ["approver_id"],
    )
    op.create_index(
        "ix_governance_approval_authorities_status",
        "governance_approval_authorities",
        ["status"],
    )
    op.create_index(
        "ix_governance_approval_authorities_is_deleted",
        "governance_approval_authorities",
        ["is_deleted"],
    )

    op.create_unique_constraint(
        "uq_governance_approval_authorities_tenant_code",
        "governance_approval_authorities",
        ["tenant_id", "authority_code"],
    )

    op.create_unique_constraint(
        "uq_governance_approval_authorities_tenant_id",
        "governance_approval_authorities",
        ["tenant_id", "id"],
    )

    op.create_table(
        "governance_delegations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "authority_id",
            sa.Integer(),
            sa.ForeignKey(
                "governance_approval_authorities.id",
                ondelete="CASCADE",
            ),
            nullable=True,
        ),
        sa.Column("delegation_code", sa.String(100), nullable=False),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column(
            "delegator_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "delegate_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("scope", sa.Text(), nullable=True),
        sa.Column("authority_limit", sa.Numeric(18, 2), nullable=True),
        sa.Column("currency", sa.String(10), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(50),
            nullable=False,
            server_default="ACTIVE",
        ),
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
    )

    op.create_index(
        "ix_governance_delegations_tenant_id",
        "governance_delegations",
        ["tenant_id"],
    )
    op.create_index(
        "ix_governance_delegations_authority_id",
        "governance_delegations",
        ["authority_id"],
    )
    op.create_index(
        "ix_governance_delegations_delegation_code",
        "governance_delegations",
        ["delegation_code"],
    )
    op.create_index(
        "ix_governance_delegations_delegator_id",
        "governance_delegations",
        ["delegator_id"],
    )
    op.create_index(
        "ix_governance_delegations_delegate_id",
        "governance_delegations",
        ["delegate_id"],
    )
    op.create_index(
        "ix_governance_delegations_status",
        "governance_delegations",
        ["status"],
    )
    op.create_index(
        "ix_governance_delegations_is_deleted",
        "governance_delegations",
        ["is_deleted"],
    )

    op.create_unique_constraint(
        "uq_governance_delegations_tenant_code",
        "governance_delegations",
        ["tenant_id", "delegation_code"],
    )

    op.create_unique_constraint(
        "uq_governance_delegations_tenant_id",
        "governance_delegations",
        ["tenant_id", "id"],
    )

    op.create_table(
        "governance_approval_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("authority_id", sa.Integer(), nullable=True),
        sa.Column("delegation_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("field_name", sa.String(100), nullable=True),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column(
            "performed_by",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "authority_id"],
            [
                "governance_approval_authorities.tenant_id",
                "governance_approval_authorities.id",
            ],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id", "delegation_id"],
            [
                "governance_delegations.tenant_id",
                "governance_delegations.id",
            ],
            ondelete="CASCADE",
        ),
    )

    op.create_index(
        "ix_governance_approval_history_tenant_id",
        "governance_approval_history",
        ["tenant_id"],
    )
    op.create_index(
        "ix_governance_approval_history_authority_id",
        "governance_approval_history",
        ["authority_id"],
    )
    op.create_index(
        "ix_governance_approval_history_delegation_id",
        "governance_approval_history",
        ["delegation_id"],
    )
    op.create_index(
        "ix_governance_approval_history_action",
        "governance_approval_history",
        ["action"],
    )


def downgrade():
    op.drop_index(
        "ix_governance_approval_history_action",
        table_name="governance_approval_history",
    )
    op.drop_index(
        "ix_governance_approval_history_delegation_id",
        table_name="governance_approval_history",
    )
    op.drop_index(
        "ix_governance_approval_history_authority_id",
        table_name="governance_approval_history",
    )
    op.drop_index(
        "ix_governance_approval_history_tenant_id",
        table_name="governance_approval_history",
    )
    op.drop_table("governance_approval_history")

    op.drop_constraint(
        "uq_governance_delegations_tenant_id",
        "governance_delegations",
        type_="unique",
    )
    op.drop_constraint(
        "uq_governance_delegations_tenant_code",
        "governance_delegations",
        type_="unique",
    )

    op.drop_index(
        "ix_governance_delegations_is_deleted",
        table_name="governance_delegations",
    )
    op.drop_index(
        "ix_governance_delegations_status",
        table_name="governance_delegations",
    )
    op.drop_index(
        "ix_governance_delegations_delegate_id",
        table_name="governance_delegations",
    )
    op.drop_index(
        "ix_governance_delegations_delegator_id",
        table_name="governance_delegations",
    )
    op.drop_index(
        "ix_governance_delegations_delegation_code",
        table_name="governance_delegations",
    )
    op.drop_index(
        "ix_governance_delegations_authority_id",
        table_name="governance_delegations",
    )
    op.drop_index(
        "ix_governance_delegations_tenant_id",
        table_name="governance_delegations",
    )
    op.drop_table("governance_delegations")

    op.drop_constraint(
        "uq_governance_approval_authorities_tenant_id",
        "governance_approval_authorities",
        type_="unique",
    )
    op.drop_constraint(
        "uq_governance_approval_authorities_tenant_code",
        "governance_approval_authorities",
        type_="unique",
    )

    op.drop_index(
        "ix_governance_approval_authorities_is_deleted",
        table_name="governance_approval_authorities",
    )
    op.drop_index(
        "ix_governance_approval_authorities_status",
        table_name="governance_approval_authorities",
    )
    op.drop_index(
        "ix_governance_approval_authorities_approver_id",
        table_name="governance_approval_authorities",
    )
    op.drop_index(
        "ix_governance_approval_authorities_authority_type",
        table_name="governance_approval_authorities",
    )
    op.drop_index(
        "ix_governance_approval_authorities_authority_code",
        table_name="governance_approval_authorities",
    )
    op.drop_index(
        "ix_governance_approval_authorities_tenant_id",
        table_name="governance_approval_authorities",
    )
    op.drop_table("governance_approval_authorities")
