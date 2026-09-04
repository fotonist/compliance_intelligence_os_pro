"""add tenant framework adoption and process scope

Revision ID: 20260903_framework_adoption
Revises: 20260902_framework_canonical_cleanup
Create Date: 2026-09-03
"""

from alembic import op
import sqlalchemy as sa


revision = "20260903_framework_adoption"
down_revision = "20260902_framework_canonical_cleanup"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "framework_adoptions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("standard_id", sa.Integer(), nullable=False),
        sa.Column("standard_version_id", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=32),
            nullable=False,
            server_default="DRAFT",
        ),
        sa.Column(
            "applicability",
            sa.String(length=32),
            nullable=False,
            server_default="APPLICABLE",
        ),
        sa.Column(
            "effective_date",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("activated_by", sa.Integer(), nullable=True),
        sa.Column(
            "activated_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["standard_id"],
            ["standards.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["standard_version_id"],
            ["standard_versions.id"],
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint(
            "tenant_id",
            "standard_version_id",
            name="uq_framework_adoption_tenant_version",
        ),
    )

    op.create_index(
        "ix_framework_adoptions_tenant_id",
        "framework_adoptions",
        ["tenant_id"],
    )

    op.create_index(
        "ix_framework_adoptions_standard_id",
        "framework_adoptions",
        ["standard_id"],
    )

    op.create_index(
        "ix_framework_adoptions_standard_version_id",
        "framework_adoptions",
        ["standard_version_id"],
    )

    op.create_index(
        "ix_framework_adoptions_status",
        "framework_adoptions",
        ["status"],
    )

    op.create_table(
        "framework_adoption_scopes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("adoption_id", sa.Integer(), nullable=False),
        sa.Column("process_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["adoption_id"],
            ["framework_adoptions.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["process_id"],
            ["processes.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "adoption_id",
            "process_id",
            name="uq_framework_adoption_scope_process",
        ),
    )

    op.create_index(
        "ix_framework_adoption_scopes_adoption_id",
        "framework_adoption_scopes",
        ["adoption_id"],
    )

    op.create_index(
        "ix_framework_adoption_scopes_process_id",
        "framework_adoption_scopes",
        ["process_id"],
    )


def downgrade():
    op.drop_index(
        "ix_framework_adoption_scopes_process_id",
        table_name="framework_adoption_scopes",
    )

    op.drop_index(
        "ix_framework_adoption_scopes_adoption_id",
        table_name="framework_adoption_scopes",
    )

    op.drop_table("framework_adoption_scopes")

    op.drop_index(
        "ix_framework_adoptions_status",
        table_name="framework_adoptions",
    )

    op.drop_index(
        "ix_framework_adoptions_standard_version_id",
        table_name="framework_adoptions",
    )

    op.drop_index(
        "ix_framework_adoptions_standard_id",
        table_name="framework_adoptions",
    )

    op.drop_index(
        "ix_framework_adoptions_tenant_id",
        table_name="framework_adoptions",
    )

    op.drop_table("framework_adoptions")
