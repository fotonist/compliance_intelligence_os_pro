from alembic import op
import sqlalchemy as sa


revision = "gap_task_target_20261003221430"
down_revision = "cf7073c6f0d0"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "compliance_tasks",
        "process_id",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade():
    connection = op.get_bind()

    null_count = connection.execute(
        sa.text(
            "SELECT COUNT(*) "
            "FROM compliance_tasks "
            "WHERE process_id IS NULL"
        )
    ).scalar()

    if int(null_count or 0) > 0:
        raise RuntimeError(
            "Cannot restore compliance_tasks.process_id NOT NULL "
            "while NULL process_id tasks exist."
        )

    op.alter_column(
        "compliance_tasks",
        "process_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
