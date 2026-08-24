"""align company profile with enterprise profile contract

Revision ID: a80b6948d776
Revises: ad0d1c70482e
Create Date: 2026-08-20 16:47:02.688105
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "a80b6948d776"
down_revision = "ad0d1c70482e"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "company_profiles",
        sa.Column(
            "policy_summary",
            sa.Text(),
            nullable=True,
        ),
    )

    op.add_column(
        "company_profiles",
        sa.Column(
            "leadership_representative",
            sa.String(length=255),
            nullable=True,
        ),
    )

    op.add_column(
        "company_profiles",
        sa.Column(
            "compliance_officer",
            sa.String(length=255),
            nullable=True,
        ),
    )

    op.add_column(
        "company_profiles",
        sa.Column(
            "included_locations",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
    )

    op.alter_column(
        "company_profiles",
        "included_locations",
        server_default=None,
    )


def downgrade():
    op.drop_column("company_profiles", "included_locations")
    op.drop_column("company_profiles", "compliance_officer")
    op.drop_column("company_profiles", "leadership_representative")
    op.drop_column("company_profiles", "policy_summary")