"""add control origin

Revision ID: add_control_origin
Revises: 336472c6225c
"""

from alembic import op
import sqlalchemy as sa

revision = "add_control_origin"
down_revision = "336472c6225c"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "controls",
        sa.Column(
            "origin",
            sa.String(length=20),
            nullable=False,
            server_default="canonical",
        ),
    )

    op.create_index(
        "ix_controls_origin",
        "controls",
        ["origin"],
    )


def downgrade():
    op.drop_index(
        "ix_controls_origin",
        table_name="controls",
    )
    op.drop_column("controls", "origin")
