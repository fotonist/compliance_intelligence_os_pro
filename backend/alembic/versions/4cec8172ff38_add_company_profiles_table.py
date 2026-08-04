from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "4cec8172ff38"
down_revision = "70ffbf010b7b"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "company_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Integer(),
            sa.ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
        ),

        # Basic Info
        sa.Column("legal_name", sa.String(length=255), nullable=False),
        sa.Column("trade_name", sa.String(length=255), nullable=True),
        sa.Column("tax_id", sa.String(length=100), nullable=True),
        sa.Column("registration_no", sa.String(length=100), nullable=True),
        sa.Column("industry", sa.String(length=255), nullable=True),
        sa.Column("employee_count", sa.Integer(), nullable=True),
        sa.Column("headquarters_address", sa.Text(), nullable=True),
        sa.Column("website", sa.String(length=255), nullable=True),

        # Context
        sa.Column("internal_issues", sa.Text(), nullable=True),
        sa.Column("external_issues", sa.Text(), nullable=True),
        sa.Column("strategic_objectives", sa.Text(), nullable=True),

        # Scope
        sa.Column("scope_description", sa.Text(), nullable=True),
        sa.Column("excluded_activities", sa.Text(), nullable=True),

        # Status
        sa.Column("status", sa.String(length=50), nullable=False, server_default="draft"),

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
        "ix_company_profiles_tenant_id",
        "company_profiles",
        ["tenant_id"],
    )


def downgrade():
    op.drop_index("ix_company_profiles_tenant_id", table_name="company_profiles")
    op.drop_table("company_profiles")
