"""add governance policies

Revision ID: c30aa844a5db
Revises: c3a874f5c130
Create Date: 2026-08-23 07:19:37.125792
"""

from alembic import op
import sqlalchemy as sa


revision = "c30aa844a5db"
down_revision = "c3a874f5c130"

branch_labels = None
depends_on = None


def upgrade():

    op.create_table(
        "governance_policies",

        sa.Column(
            "id",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "tenant_id",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "policy_code",
            sa.String(length=100),
            nullable=False,
        ),

        sa.Column(
            "title",
            sa.String(length=255),
            nullable=False,
        ),

        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
        ),

        sa.Column(
            "category",
            sa.String(length=50),
            nullable=False,
        ),

        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
        ),

        sa.Column(
            "version",
            sa.String(length=50),
            nullable=False,
        ),

        sa.Column(
            "owner_id",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "approver_id",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "effective_date",
            sa.DateTime(timezone=True),
            nullable=True,
        ),

        sa.Column(
            "review_date",
            sa.DateTime(timezone=True),
            nullable=True,
        ),

        sa.Column(
            "is_deleted",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),

        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            ondelete="CASCADE",
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

        sa.PrimaryKeyConstraint(
            "id",
        ),
    )


def downgrade():

    op.drop_table("governance_policies")