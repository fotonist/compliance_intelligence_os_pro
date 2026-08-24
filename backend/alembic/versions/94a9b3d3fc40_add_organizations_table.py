"""add organizations table

Revision ID: 94a9b3d3fc40
Revises: b7c4d9e2f801
Create Date: 2026-08-22
"""

from alembic import op
import sqlalchemy as sa


revision = "94a9b3d3fc40"
down_revision = "b7c4d9e2f801"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "organizations",
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
                ondelete="RESTRICT",
            ),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "name",
            sa.String(length=255),
            nullable=False,
        ),
        sa.Column(
            "legal_name",
            sa.String(length=255),
            nullable=True,
        ),
        sa.Column(
            "industry",
            sa.String(length=150),
            nullable=True,
        ),
        sa.Column(
            "company_size",
            sa.String(length=50),
            nullable=True,
        ),
        sa.Column(
            "employee_count",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "mission",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "vision",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "scope_statement",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.String(length=30),
            nullable=False,
            server_default="ACTIVE",
        ),
        sa.Column(
            "created_by",
            sa.Integer(),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )


def downgrade():
    op.drop_table("organizations")