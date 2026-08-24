"""add departments table

Revision ID: c3a874f5c130
Revises: 9a91605895af
Create Date: 2026-08-23
"""

from alembic import op
import sqlalchemy as sa


revision = "c3a874f5c130"
down_revision = "9a91605895af"

branch_labels = None
depends_on = None


def upgrade():

    op.create_table(
        "departments",

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
            "organization_id",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "name",
            sa.String(length=255),
            nullable=False,
        ),

        sa.Column(
            "code",
            sa.String(length=50),
            nullable=True,
        ),

        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
        ),

        sa.Column(
            "manager_id",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "status",
            sa.String(length=30),
            nullable=False,
            server_default="active",
        ),

        sa.Column(
            "created_by",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),

        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),

        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            ondelete="RESTRICT",
        ),

        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),

        sa.ForeignKeyConstraint(
            ["manager_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
    )


def downgrade():

    op.drop_table("departments")