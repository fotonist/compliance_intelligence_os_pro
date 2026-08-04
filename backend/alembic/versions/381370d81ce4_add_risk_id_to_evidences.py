"""add risk_id to evidences

Revision ID: 381370d81ce4
Revises: 54bf874c097b
Create Date: 2025-12-14 21:29:11.875585
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '381370d81ce4'
down_revision = '54bf874c097b'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'evidences',
        sa.Column('risk_id', sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        'fk_evidences_risk_id',
        'evidences',
        'risks',
        ['risk_id'],
        ['id']
    )

def downgrade():
    op.drop_constraint('fk_evidences_risk_id', 'evidences', type_='foreignkey')
    op.drop_column('evidences', 'risk_id')
