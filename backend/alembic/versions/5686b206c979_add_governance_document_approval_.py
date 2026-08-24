"""add governance document approval workflow

Revision ID: 5686b206c979
Revises: c7f4a9d21e63
Create Date: 2026-08-23 13:03:34.731248
"""

from alembic import op
import sqlalchemy as sa


revision = "5686b206c979"
down_revision = "c7f4a9d21e63"
branch_labels = None
depends_on = None


def upgrade():

    op.add_column(
        "governance_procedure_documents",
        sa.Column(
            "reviewer_id",
            sa.Integer(),
            nullable=True,
        ),
    )

    op.add_column(
        "governance_procedure_documents",
        sa.Column(
            "reviewed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.add_column(
        "governance_procedure_documents",
        sa.Column(
            "approved_by",
            sa.Integer(),
            nullable=True,
        ),
    )

    op.add_column(
        "governance_procedure_documents",
        sa.Column(
            "approved_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.add_column(
        "governance_procedure_documents",
        sa.Column(
            "rejected_by",
            sa.Integer(),
            nullable=True,
        ),
    )

    op.add_column(
        "governance_procedure_documents",
        sa.Column(
            "rejected_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )

    op.add_column(
        "governance_procedure_documents",
        sa.Column(
            "review_comment",
            sa.Text(),
            nullable=True,
        ),
    )


    op.create_foreign_key(
        "fk_gpd_reviewer",
        "governance_procedure_documents",
        "users",
        ["reviewer_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_foreign_key(
        "fk_gpd_approved_by",
        "governance_procedure_documents",
        "users",
        ["approved_by"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_foreign_key(
        "fk_gpd_rejected_by",
        "governance_procedure_documents",
        "users",
        ["rejected_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade():

    op.drop_constraint(
        "fk_gpd_rejected_by",
        "governance_procedure_documents",
        type_="foreignkey",
    )

    op.drop_constraint(
        "fk_gpd_approved_by",
        "governance_procedure_documents",
        type_="foreignkey",
    )

    op.drop_constraint(
        "fk_gpd_reviewer",
        "governance_procedure_documents",
        type_="foreignkey",
    )


    op.drop_column(
        "governance_procedure_documents",
        "review_comment",
    )

    op.drop_column(
        "governance_procedure_documents",
        "rejected_at",
    )

    op.drop_column(
        "governance_procedure_documents",
        "rejected_by",
    )

    op.drop_column(
        "governance_procedure_documents",
        "approved_at",
    )

    op.drop_column(
        "governance_procedure_documents",
        "approved_by",
    )

    op.drop_column(
        "governance_procedure_documents",
        "reviewed_at",
    )

    op.drop_column(
        "governance_procedure_documents",
        "reviewer_id",
    )