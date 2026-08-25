"""create compliance obligations

Revision ID: 36caa9ef1ffa
Revises: 762ef27be2ba
Create Date: 2026-08-25

Creates the tenant-scoped Compliance Obligations domain.
"""

from alembic import op
import sqlalchemy as sa


revision = "36caa9ef1ffa"
down_revision = "762ef27be2ba"
branch_labels = None
depends_on = None


def upgrade():
    # ----------------------------------------------------------
    # COMPLIANCE OBLIGATIONS
    # ----------------------------------------------------------

    op.create_table(
        "compliance_obligations",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            nullable=False,
        ),

        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey(
                "tenants.id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),

        sa.Column(
            "code",
            sa.String(length=100),
            nullable=False,
        ),

        sa.Column(
            "title",
            sa.String(length=500),
            nullable=False,
        ),

        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
        ),

        sa.Column(
            "source_authority",
            sa.String(length=255),
            nullable=True,
        ),

        sa.Column(
            "regulation_name",
            sa.String(length=500),
            nullable=True,
        ),

        sa.Column(
            "jurisdiction",
            sa.String(length=255),
            nullable=True,
        ),

        sa.Column(
            "reference_url",
            sa.String(length=1000),
            nullable=True,
        ),

        sa.Column(
            "effective_date",
            sa.Date(),
            nullable=True,
        ),

        sa.Column(
            "expiry_date",
            sa.Date(),
            nullable=True,
        ),

        sa.Column(
            "review_date",
            sa.Date(),
            nullable=True,
        ),

        sa.Column(
            "status",
            sa.String(length=32),
            nullable=False,
            server_default="active",
        ),

        sa.Column(
            "criticality",
            sa.String(length=32),
            nullable=False,
            server_default="medium",
        ),

        sa.Column(
            "owner_user_id",
            sa.Integer(),
            sa.ForeignKey(
                "users.id",
                ondelete="SET NULL",
            ),
            nullable=True,
        ),

        sa.Column(
            "applicability_status",
            sa.String(length=32),
            nullable=False,
            server_default="under_review",
        ),

        sa.Column(
            "applicability_reason",
            sa.Text(),
            nullable=True,
        ),

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
    )

    # ----------------------------------------------------------
    # INDEXES
    # ----------------------------------------------------------

    op.create_index(
        "ix_compliance_obligations_tenant_id",
        "compliance_obligations",
        ["tenant_id"],
    )

    op.create_index(
        "ix_compliance_obligations_code",
        "compliance_obligations",
        ["code"],
    )

    op.create_index(
        "ix_compliance_obligations_review_date",
        "compliance_obligations",
        ["review_date"],
    )

    op.create_index(
        "ix_compliance_obligations_status",
        "compliance_obligations",
        ["status"],
    )

    op.create_index(
        "ix_compliance_obligations_criticality",
        "compliance_obligations",
        ["criticality"],
    )

    op.create_index(
        "ix_compliance_obligations_owner_user_id",
        "compliance_obligations",
        ["owner_user_id"],
    )

    op.create_index(
        "ix_compliance_obligations_applicability_status",
        "compliance_obligations",
        ["applicability_status"],
    )


def downgrade():
    # ----------------------------------------------------------
    # REMOVE INDEXES
    # ----------------------------------------------------------

    op.drop_index(
        "ix_compliance_obligations_applicability_status",
        table_name="compliance_obligations",
    )

    op.drop_index(
        "ix_compliance_obligations_owner_user_id",
        table_name="compliance_obligations",
    )

    op.drop_index(
        "ix_compliance_obligations_criticality",
        table_name="compliance_obligations",
    )

    op.drop_index(
        "ix_compliance_obligations_status",
        table_name="compliance_obligations",
    )

    op.drop_index(
        "ix_compliance_obligations_review_date",
        table_name="compliance_obligations",
    )

    op.drop_index(
        "ix_compliance_obligations_code",
        table_name="compliance_obligations",
    )

    op.drop_index(
        "ix_compliance_obligations_tenant_id",
        table_name="compliance_obligations",
    )

    op.drop_table("compliance_obligations")
