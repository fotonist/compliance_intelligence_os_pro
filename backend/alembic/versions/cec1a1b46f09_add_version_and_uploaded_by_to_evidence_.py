from alembic import op
import sqlalchemy as sa

revision = "a9f1c2d3e4f5"          # <-- dosya adındaki ID
down_revision = "43275d6db0d6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "evidence_files",
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )

    op.add_column(
        "evidence_files",
        sa.Column("uploaded_by", sa.Integer(), nullable=True),
    )

    op.create_foreign_key(
        "fk_evidence_files_uploaded_by_users",
        "evidence_files",
        "users",
        ["uploaded_by"],
        ["id"],
    )

    # server_default temizle
    op.alter_column(
        "evidence_files",
        "version",
        server_default=None,
    )


def downgrade():
    op.drop_constraint(
        "fk_evidence_files_uploaded_by_users",
        "evidence_files",
        type_="foreignkey",
    )
    op.drop_column("evidence_files", "uploaded_by")
    op.drop_column("evidence_files", "version")
