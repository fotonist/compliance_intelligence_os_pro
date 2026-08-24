"""add locations table

Revision ID: 60be4ef8bf11
Revises: 94a9b3d3fc40
Create Date: 2026-08-22
"""

from alembic import op
import sqlalchemy as sa


revision = "60be4ef8bf11"
down_revision = "94a9b3d3fc40"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "locations",
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
            "organization_id",
            sa.Integer(),
            sa.ForeignKey(
                "organizations.id",
                ondelete="CASCADE",
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
            "code",
            sa.String(length=50),
            nullable=True,
        ),
        sa.Column(
            "location_type",
            sa.String(length=50),
            nullable=True,
        ),
        sa.Column(
            "address",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "city",
            sa.String(length=100),
            nullable=True,
        ),
        sa.Column(
            "country",
            sa.String(length=100),
            nullable=True,
        ),
        sa.Column(
            "contact_person",
            sa.String(length=255),
            nullable=True,
        ),
        sa.Column(
            "contact_email",
            sa.String(length=255),
            nullable=True,
        ),
        sa.Column(
            "contact_phone",
            sa.String(length=50),
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
    op.drop_table("locations")