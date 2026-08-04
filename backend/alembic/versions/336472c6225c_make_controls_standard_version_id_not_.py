"""make controls.standard_version_id not null

Revision ID: 336472c6225c
Revises: dc199d132449
Create Date: 2026-01-27 20:00:52.005048
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '336472c6225c'
down_revision = 'dc199d132449'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("controls", "standard_version_id", nullable=False)

def downgrade():
    op.alter_column("controls", "standard_version_id", nullable=True)
