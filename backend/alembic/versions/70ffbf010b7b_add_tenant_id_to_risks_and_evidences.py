"""add_tenant_id_to_risks_and_evidences"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "70ffbf010b7b"
down_revision = "dbecd0b3187e"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("UPDATE risks SET tenant_id = 1 WHERE tenant_id IS NULL;")
    op.execute("UPDATE evidences SET tenant_id = 1 WHERE tenant_id IS NULL;")

    op.alter_column("risks", "tenant_id", nullable=False)
    op.alter_column("evidences", "tenant_id", nullable=False)

    op.create_foreign_key(
        "fk_risks_tenant",
        "risks",
        "tenants",
        ["tenant_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.create_foreign_key(
        "fk_evidences_tenant",
        "evidences",
        "tenants",
        ["tenant_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.create_index("ix_risks_tenant_id", "risks", ["tenant_id"])
    op.create_index("ix_evidences_tenant_id", "evidences", ["tenant_id"])


def downgrade():
    op.drop_index("ix_evidences_tenant_id", table_name="evidences")
    op.drop_index("ix_risks_tenant_id", table_name="risks")

    op.drop_constraint("fk_evidences_tenant", "evidences", type_="foreignkey")
    op.drop_constraint("fk_risks_tenant", "risks", type_="foreignkey")

    op.alter_column("evidences", "tenant_id", nullable=True)
    op.alter_column("risks", "tenant_id", nullable=True)
