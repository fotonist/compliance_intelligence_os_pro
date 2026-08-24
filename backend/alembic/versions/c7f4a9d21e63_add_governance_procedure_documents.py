"""add governance procedure documents

Revision ID: c7f4a9d21e63
Revises: b1a235c17b8f
Create Date: 2026-08-23
"""

from alembic import op
import sqlalchemy as sa


revision = "c7f4a9d21e63"

down_revision = "b1a235c17b8f"

branch_labels = None
depends_on = None


def upgrade():

    op.create_table(
        "governance_procedure_documents",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
        ),

        sa.Column(
            "tenant_id",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "procedure_id",
            sa.Integer(),
            nullable=False,
        ),

        sa.Column(
            "version",
            sa.String(length=50),
            nullable=False,
        ),

        sa.Column(
            "file_name",
            sa.String(length=255),
            nullable=False,
        ),

        sa.Column(
            "storage_key",
            sa.String(length=1000),
            nullable=False,
        ),

        sa.Column(
            "mime_type",
            sa.String(length=255),
            nullable=True,
        ),

        sa.Column(
            "file_size",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "checksum",
            sa.String(length=128),
            nullable=True,
        ),

        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
            server_default="uploaded",
        ),

        sa.Column(
            "is_current",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),

        sa.Column(
            "is_archived",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),

        sa.Column(
            "uploaded_by",
            sa.Integer(),
            nullable=True,
        ),

        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),

        sa.Column(
            "archived_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),

        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            ondelete="CASCADE",
        ),

        sa.ForeignKeyConstraint(
            ["procedure_id"],
            ["governance_procedures.id"],
            ondelete="CASCADE",
        ),

        sa.ForeignKeyConstraint(
            ["uploaded_by"],
            ["users.id"],
            ondelete="SET NULL",
        ),
    )


    op.create_index(
        "ix_governance_procedure_documents_tenant_id",
        "governance_procedure_documents",
        ["tenant_id"],
    )

    op.create_index(
        "ix_governance_procedure_documents_procedure_id",
        "governance_procedure_documents",
        ["procedure_id"],
    )

    op.create_index(
        "ix_governance_procedure_documents_status",
        "governance_procedure_documents",
        ["status"],
    )

    op.create_index(
        "ix_governance_procedure_documents_is_archived",
        "governance_procedure_documents",
        ["is_archived"],
    )

    op.create_index(
        "ix_governance_procedure_documents_is_current",
        "governance_procedure_documents",
        ["is_current"],
    )


def downgrade():

    op.drop_index(
        "ix_governance_procedure_documents_is_current",
        table_name="governance_procedure_documents",
    )

    op.drop_index(
        "ix_governance_procedure_documents_is_archived",
        table_name="governance_procedure_documents",
    )

    op.drop_index(
        "ix_governance_procedure_documents_status",
        table_name="governance_procedure_documents",
    )

    op.drop_index(
        "ix_governance_procedure_documents_procedure_id",
        table_name="governance_procedure_documents",
    )

    op.drop_index(
        "ix_governance_procedure_documents_tenant_id",
        table_name="governance_procedure_documents",
    )

    op.drop_table("governance_procedure_documents")