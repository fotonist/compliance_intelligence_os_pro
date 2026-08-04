"""remove old level column

Revision ID: 465255e695a5
Revises: 740b093cdd63
Create Date: 2025-12-06
"""

from alembic import op
import sqlalchemy as sa


revision = "465255e695a5"
down_revision = "740b093cdd63"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("risks") as batch_op:
       batch_op.drop_column("level", if_exists=True)



def downgrade():
    with op.batch_alter_table("risks") as batch_op:
        batch_op.add_column(sa.Column("level", sa.String(length=50)))
