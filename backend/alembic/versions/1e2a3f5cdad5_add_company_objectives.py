"""add company objectives

Revision ID: 1e2a3f5cdad5
Revises: a80b6948d776
Create Date: 2026-08-21 16:46:43.793210
"""

from alembic import op
import sqlalchemy as sa


revision = "1e2a3f5cdad5"
down_revision = "a80b6948d776"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "company_objectives",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column(
            "objective_type",
            sa.String(length=50),
            server_default="strategic",
            nullable=False,
        ),
        sa.Column(
            "priority",
            sa.String(length=20),
            server_default="medium",
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=30),
            server_default="draft",
            nullable=False,
        ),
        sa.Column("owner_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "target_date",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column("measurement_method", sa.Text(), nullable=True),
        sa.Column("target_value", sa.Numeric(18, 4), nullable=True),
        sa.Column("current_value", sa.Numeric(18, 4), nullable=True),
        sa.Column("unit", sa.String(length=50), nullable=True),
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
            ["owner_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(
        "ix_company_objectives_id",
        "company_objectives",
        ["id"],
        unique=False,
    )

    op.create_index(
        "ix_company_objectives_code",
        "company_objectives",
        ["code"],
        unique=False,
    )

    op.create_index(
        "ix_company_objectives_tenant_id",
        "company_objectives",
        ["tenant_id"],
        unique=False,
    )

    op.create_index(
        "ix_company_objectives_owner_user_id",
        "company_objectives",
        ["owner_user_id"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        "ix_company_objectives_owner_user_id",
        table_name="company_objectives",
    )
    op.drop_index(
        "ix_company_objectives_tenant_id",
        table_name="company_objectives",
    )
    op.drop_index(
        "ix_company_objectives_code",
        table_name="company_objectives",
    )
    op.drop_index(
        "ix_company_objectives_id",
        table_name="company_objectives",
    )

    op.drop_table("company_objectives")