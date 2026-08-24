"""add governance procedures

Revision ID: 3d82c27021a7
Revises: c30aa844a5db
Create Date: 2026-08-23
"""

from alembic import op
import sqlalchemy as sa


revision = "3d82c27021a7"

down_revision = "c30aa844a5db"

branch_labels = None
depends_on = None


def upgrade():

    op.create_table(
        "governance_procedures",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            nullable=False,
        ),

        sa.Column(
            "tenant_id",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "policy_id",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "procedure_code",
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
            "owner_id",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
            server_default="draft",
        ),

        sa.Column(
            "version",
            sa.String(length=50),
            nullable=False,
            server_default="1.0",
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
            nullable=False,
            server_default=sa.text("now()"),
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),

        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            ondelete="CASCADE",
        ),

        sa.ForeignKeyConstraint(
            ["policy_id"],
            ["governance_policies.id"],
            ondelete="CASCADE",
        ),

        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
    )


def downgrade():

    op.drop_table("governance_procedures")