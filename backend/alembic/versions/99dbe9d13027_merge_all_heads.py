"""merge all heads

Revision ID: 99dbe9d13027
Revises: 465255e695a5, 0377691a2f11, 43275d6db0d6
Create Date: 2025-12-14 18:35:46.442887
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '99dbe9d13027'
down_revision = ('465255e695a5', '0377691a2f11', '43275d6db0d6')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
