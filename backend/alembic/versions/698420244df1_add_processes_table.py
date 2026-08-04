from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "698420244df1"
down_revision = "4cec8172ff38"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "processes",
        sa.Column("id", sa.Integer(), primary_key=True),

        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),

        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("owner", sa.String(length=255), nullable=True),
        sa.Column(
            "status",
            sa.String(length=50),
            nullable=False,
            server_default="draft",
        ),

        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "ix_processes_tenant_id",
        "processes",
        ["tenant_id"],
    )


def downgrade():
    op.drop_index("ix_processes_tenant_id", table_name="processes")
    op.drop_table("processes")
