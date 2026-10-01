"""add canonical PAM rating options

Revision ID: 20260930_pam_rating_options
Revises: 20260906_process_applicable_controls
Create Date: 2026-09-30
"""

from alembic import op
import sqlalchemy as sa


revision = "20260930_pam_rating_options"
down_revision = "20260906_process_applicable_controls"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "pam_rating_options",
        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "framework_model_id",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "code",
            sa.String(length=32),
            nullable=False,
        ),
        sa.Column(
            "name",
            sa.String(length=128),
            nullable=False,
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "numeric_value",
            sa.Float(),
            nullable=True,
        ),
        sa.Column(
            "lower_bound",
            sa.Float(),
            nullable=True,
        ),
        sa.Column(
            "upper_bound",
            sa.Float(),
            nullable=True,
        ),
        sa.Column(
            "sort_order",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["framework_model_id"],
            ["framework_models.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "framework_model_id",
            "code",
            name="uq_pam_rating_option_model_code",
        ),
        sa.UniqueConstraint(
            "framework_model_id",
            "sort_order",
            name="uq_pam_rating_option_model_sort_order",
        ),
    )

    op.create_index(
        "ix_pam_rating_options_framework_model_id",
        "pam_rating_options",
        ["framework_model_id"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        "ix_pam_rating_options_framework_model_id",
        table_name="pam_rating_options",
    )

    op.drop_table("pam_rating_options")
