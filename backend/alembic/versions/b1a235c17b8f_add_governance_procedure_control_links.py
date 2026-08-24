"""add governance procedure control links

Revision ID: b1a235c17b8f
Revises: 3d82c27021a7
Create Date: 2026-08-23
"""

from alembic import op
import sqlalchemy as sa


revision = "b1a235c17b8f"

down_revision = "3d82c27021a7"

branch_labels = None
depends_on = None


def upgrade():

    op.create_table(
        "governance_procedure_controls",

        sa.Column(
            "id",
            sa.Integer(),
            primary_key=True,
            nullable=False,
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
            "control_id",
            sa.Integer(),
            nullable=False,
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
            ["control_id"],
            ["controls.id"],
            ondelete="CASCADE",
        ),
    )


def downgrade():

    op.drop_table("governance_procedure_controls")