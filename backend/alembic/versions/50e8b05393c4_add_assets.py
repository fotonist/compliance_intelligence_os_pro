"""add assets

Revision ID: 50e8b05393c4
Revises: 1e2a3f5cdad5
Create Date: 2026-08-21 17:40:06.767691
"""

from alembic import op
import sqlalchemy as sa


revision = "50e8b05393c4"
down_revision = "1e2a3f5cdad5"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "assets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column(
            "asset_type",
            sa.String(length=50),
            server_default="other",
            nullable=False,
        ),
        sa.Column(
            "criticality",
            sa.String(length=20),
            server_default="medium",
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=30),
            server_default="active",
            nullable=False,
        ),
        sa.Column(
            "lifecycle_status",
            sa.String(length=30),
            server_default="in_service",
            nullable=False,
        ),
        sa.Column("information_classification", sa.String(length=50), nullable=True),
        sa.Column("owner_user_id", sa.Integer(), nullable=True),
        sa.Column("custodian_user_id", sa.Integer(), nullable=True),
        sa.Column("department", sa.String(length=255), nullable=True),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("manufacturer", sa.String(length=255), nullable=True),
        sa.Column("model_number", sa.String(length=255), nullable=True),
        sa.Column("serial_number", sa.String(length=255), nullable=True),
        sa.Column("acquisition_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("warranty_expiry", sa.DateTime(timezone=True), nullable=True),
        sa.Column("contract_expiry", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(
            ["custodian_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    indexes = [
        ("ix_assets_id", "id"),
        ("ix_assets_code", "code"),
        ("ix_assets_tenant_id", "tenant_id"),
        ("ix_assets_asset_type", "asset_type"),
        ("ix_assets_criticality", "criticality"),
        ("ix_assets_status", "status"),
        ("ix_assets_lifecycle_status", "lifecycle_status"),
        ("ix_assets_owner_user_id", "owner_user_id"),
        ("ix_assets_custodian_user_id", "custodian_user_id"),
        ("ix_assets_department", "department"),
        ("ix_assets_location", "location"),
        ("ix_assets_serial_number", "serial_number"),
    ]

    for name, column in indexes:
        op.create_index(
            name,
            "assets",
            [column],
            unique=False,
        )


def downgrade():
    indexes = [
        "ix_assets_serial_number",
        "ix_assets_location",
        "ix_assets_department",
        "ix_assets_custodian_user_id",
        "ix_assets_owner_user_id",
        "ix_assets_lifecycle_status",
        "ix_assets_status",
        "ix_assets_criticality",
        "ix_assets_asset_type",
        "ix_assets_tenant_id",
        "ix_assets_code",
        "ix_assets_id",
    ]

    for index in indexes:
        op.drop_index(index, table_name="assets")

    op.drop_table("assets")