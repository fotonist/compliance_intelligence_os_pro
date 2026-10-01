"""merge canonical PAM and audit maturity heads

Revision ID: cf7073c6f0d0
Revises: 20260911_matrix_pam_lineage, 20261001_audit_target_revisions
Create Date: 2026-10-01 11:31:54.246096
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'cf7073c6f0d0'
down_revision = ('20260911_matrix_pam_lineage', '20261001_audit_target_revisions')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
