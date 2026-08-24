"""merge current enterprise migration heads

Revision ID: ad0d1c70482e
Revises: 0cead64a939d, 20260818_control_requirement_nullable, 20260819_fix_uee_control_coverage_contract, a1b7c9d2e4f0, c3f1a9b7e2d4
Create Date: 2026-08-20 16:44:53.203124
"""

from alembic import op


revision = "ad0d1c70482e"

down_revision = (
    "0cead64a939d",
    "20260818_control_requirement_nullable",
    "20260819_fix_uee_control_coverage_contract",
    "a1b7c9d2e4f0",
    "c3f1a9b7e2d4",
)

branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass