"""update_compliance_task_source_tracking

Revision ID: 97d434b7d7ef
Revises: 5157167d1edb
Create Date: 2026-02-22
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "97d434b7d7ef"
down_revision = "5157167d1edb"
branch_labels = None
depends_on = None


def upgrade():

    # Drop old column
    with op.batch_alter_table("compliance_tasks") as batch_op:
        batch_op.drop_column("created_from_gap")

    # Add new columns
    with op.batch_alter_table("compliance_tasks") as batch_op:
        batch_op.add_column(sa.Column("source_type", sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column("source_id", sa.Integer(), nullable=True))

    # Backfill existing rows
    op.execute(
        """
        UPDATE compliance_tasks
        SET source_type = 'manual'
        WHERE source_type IS NULL
        """
    )

    # Make source_type NOT NULL
    with op.batch_alter_table("compliance_tasks") as batch_op:
        batch_op.alter_column("source_type", nullable=False)


def downgrade():

    # Recreate old column
    with op.batch_alter_table("compliance_tasks") as batch_op:
        batch_op.add_column(
            sa.Column("created_from_gap", sa.Boolean(), nullable=False, server_default="true")
        )

    # Drop new columns
    with op.batch_alter_table("compliance_tasks") as batch_op:
        batch_op.drop_column("source_id")
        batch_op.drop_column("source_type")