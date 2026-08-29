"""add identity verification infrastructure

Revision ID: 20260827_identity_verification
Revises: db0cca247dc5
Create Date: 2026-08-27
"""

from alembic import op
import sqlalchemy as sa


revision = "20260827_identity_verification"
down_revision = "db0cca247dc5"
branch_labels = None
depends_on = None


def upgrade():
    # ----------------------------------------------------------
    # User verification state
    # ----------------------------------------------------------

    op.add_column(
        "users",
        sa.Column(
            "email_verified_at",
            sa.DateTime(),
            nullable=True,
        ),
    )

    op.add_column(
        "users",
        sa.Column(
            "phone_verified_at",
            sa.DateTime(),
            nullable=True,
        ),
    )

    # ----------------------------------------------------------
    # Email / phone verification tokens
    # ----------------------------------------------------------

    op.create_table(
        "identity_verification_tokens",
        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
        ),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey(
                "users.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        sa.Column(
            "channel",
            sa.String(20),
            nullable=False,
        ),
        sa.Column(
            "token_hash",
            sa.String(128),
            nullable=False,
        ),
        sa.Column(
            "expires_at",
            sa.DateTime(),
            nullable=False,
        ),
        sa.Column(
            "consumed_at",
            sa.DateTime(),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_identity_verification_tokens_user_id",
        "identity_verification_tokens",
        ["user_id"],
    )

    op.create_index(
        "ix_identity_verification_tokens_token_hash",
        "identity_verification_tokens",
        ["token_hash"],
        unique=True,
    )

    op.create_index(
        "ix_identity_verification_tokens_expires_at",
        "identity_verification_tokens",
        ["expires_at"],
    )


def downgrade():
    op.drop_index(
        "ix_identity_verification_tokens_expires_at",
        table_name="identity_verification_tokens",
    )

    op.drop_index(
        "ix_identity_verification_tokens_token_hash",
        table_name="identity_verification_tokens",
    )

    op.drop_index(
        "ix_identity_verification_tokens_user_id",
        table_name="identity_verification_tokens",
    )

    op.drop_table("identity_verification_tokens")

    op.drop_column(
        "users",
        "phone_verified_at",
    )

    op.drop_column(
        "users",
        "email_verified_at",
    )
