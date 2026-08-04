"""merge heads after standard_versions

Revision ID: a9fdd4e7b6e0
Revises: 98c8b92fe827, fc1ac0a6950b
Create Date: 2026-01-27 18:30:37.260541
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a9fdd4e7b6e0'
down_revision = ('98c8b92fe827', 'fc1ac0a6950b')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
