from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = "98c8b92fe827"
down_revision = "9e267c3ead4f"
branch_labels = None
depends_on = None


def upgrade():
    # 1) standard_versions table
    op.create_table(
        "standard_versions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "standard_id",
            sa.Integer(),
            sa.ForeignKey("standards.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version_code", sa.String(50), nullable=False),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="published",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index(
        "ix_standard_versions_standard_id",
        "standard_versions",
        ["standard_id"],
    )

    # 2) add standard_version_id columns
    op.add_column(
        "clauses",
        sa.Column("standard_version_id", sa.Integer(), nullable=True),
    )

    op.add_column(
        "standard_process_areas",
        sa.Column("standard_version_id", sa.Integer(), nullable=True),
    )

    op.create_foreign_key(
        "fk_clauses_standard_version",
        "clauses",
        "standard_versions",
        ["standard_version_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.create_foreign_key(
        "fk_spa_standard_version",
        "standard_process_areas",
        "standard_versions",
        ["standard_version_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # 3) data migration: create v1 / published
    conn = op.get_bind()

    conn.execute(
        text(
            """
            INSERT INTO standard_versions (standard_id, version_code, status)
            SELECT id, 'v1', 'published'
            FROM standards
            """
        )
    )

    conn.execute(
        text(
            """
            UPDATE clauses c
            SET standard_version_id = sv.id
            FROM standard_versions sv
            WHERE c.standard_id = sv.standard_id
              AND sv.version_code = 'v1'
            """
        )
    )

    conn.execute(
        text(
            """
            UPDATE standard_process_areas spa
            SET standard_version_id = sv.id
            FROM standard_versions sv
            WHERE spa.standard_id = sv.standard_id
              AND sv.version_code = 'v1'
            """
        )
    )

    # 4) make NOT NULL
    op.alter_column("clauses", "standard_version_id", nullable=False)
    op.alter_column(
        "standard_process_areas",
        "standard_version_id",
        nullable=False,
    )


def downgrade():
    op.drop_constraint(
        "fk_spa_standard_version",
        "standard_process_areas",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_clauses_standard_version",
        "clauses",
        type_="foreignkey",
    )

    op.drop_column("standard_process_areas", "standard_version_id")
    op.drop_column("clauses", "standard_version_id")

    op.drop_index(
        "ix_standard_versions_standard_id",
        table_name="standard_versions",
    )

    op.drop_table("standard_versions")
