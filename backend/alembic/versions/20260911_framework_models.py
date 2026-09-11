"""add canonical framework model layer

Revision ID: 20260911_framework_models
Revises: 20260908_governance_approval_rbac
Create Date: 2026-09-11
"""

from alembic import op
import sqlalchemy as sa


revision = "20260911_framework_models"
down_revision = "20260908_governance_approval_rbac"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "framework_models",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("standard_version_id", sa.Integer(), nullable=False),
        sa.Column("model_type", sa.String(length=50), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=30),
            nullable=False,
            server_default="draft",
        ),
        sa.Column(
            "is_canonical",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["standard_version_id"],
            ["standard_versions.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "standard_version_id",
            "model_type",
            "code",
            name="uq_framework_model_version_type_code",
        ),
    )

    op.create_index(
        "ix_framework_models_standard_version_id",
        "framework_models",
        ["standard_version_id"],
    )
    op.create_index(
        "ix_framework_models_model_type",
        "framework_models",
        ["model_type"],
    )
    op.create_index(
        "ix_framework_models_status",
        "framework_models",
        ["status"],
    )

    op.create_table(
        "framework_relationships",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source_model_id", sa.Integer(), nullable=False),
        sa.Column("target_model_id", sa.Integer(), nullable=False),
        sa.Column("relationship_type", sa.String(length=50), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["source_model_id"],
            ["framework_models.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["target_model_id"],
            ["framework_models.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "source_model_id",
            "target_model_id",
            "relationship_type",
            name="uq_framework_relationship",
        ),
    )

    op.create_index(
        "ix_framework_relationships_source_model_id",
        "framework_relationships",
        ["source_model_id"],
    )
    op.create_index(
        "ix_framework_relationships_target_model_id",
        "framework_relationships",
        ["target_model_id"],
    )
    op.create_index(
        "ix_framework_relationships_relationship_type",
        "framework_relationships",
        ["relationship_type"],
    )


def downgrade():
    op.drop_index(
        "ix_framework_relationships_relationship_type",
        table_name="framework_relationships",
    )
    op.drop_index(
        "ix_framework_relationships_target_model_id",
        table_name="framework_relationships",
    )
    op.drop_index(
        "ix_framework_relationships_source_model_id",
        table_name="framework_relationships",
    )
    op.drop_table("framework_relationships")

    op.drop_index(
        "ix_framework_models_status",
        table_name="framework_models",
    )
    op.drop_index(
        "ix_framework_models_model_type",
        table_name="framework_models",
    )
    op.drop_index(
        "ix_framework_models_standard_version_id",
        table_name="framework_models",
    )
    op.drop_table("framework_models")
