"""add external integrations tables

Revision ID: e9e3f1dd9bc9
Revises: 69540cc29585
Create Date: 2026-02-22
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = "e9e3f1dd9bc9"
down_revision = "69540cc29585"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "external_integrations",
        sa.Column("id", sa.Integer(), primary_key=True),

        # index=True KALDIRILDI (duplicate index problemi önlendi)
        sa.Column("tenant_id", sa.Integer(), nullable=False),

        sa.Column("provider", sa.String(length=30), nullable=False),
        sa.Column("base_url", sa.String(length=500), nullable=True),

        # Jira config
        sa.Column("jira_email", sa.String(length=255), nullable=True),
        sa.Column("api_token", sa.String(length=500), nullable=True),
        sa.Column("project_key", sa.String(length=50), nullable=True),
        sa.Column("issue_type", sa.String(length=50), nullable=True),

        # ClickUp config
        sa.Column("team_id", sa.String(length=50), nullable=True),
        sa.Column("space_id", sa.String(length=50), nullable=True),
        sa.Column("folder_id", sa.String(length=50), nullable=True),
        sa.Column("list_id", sa.String(length=50), nullable=True),

        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),

        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),

        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("tenant_id", "provider", name="ux_external_integrations_tenant_provider"),
    )

    # Explicit index oluşturuyoruz (tek kaynak)
    op.create_index("ix_external_integrations_tenant_id", "external_integrations", ["tenant_id"])
    op.create_index("ix_external_integrations_provider", "external_integrations", ["provider"])


    op.create_table(
        "task_external_links",
        sa.Column("id", sa.Integer(), primary_key=True),

        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.Integer(), nullable=False),

        sa.Column("provider", sa.String(length=30), nullable=False),
        sa.Column("external_key", sa.String(length=200), nullable=False),

        sa.Column("sync_status", sa.String(length=30), nullable=False, server_default=sa.text("'synced'")),
        sa.Column("last_synced_at", sa.DateTime(), nullable=True),

        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),

        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["compliance_tasks.id"], ondelete="CASCADE"),

        sa.UniqueConstraint(
            "tenant_id",
            "provider",
            "task_id",
            name="ux_task_external_links_tenant_provider_task",
        ),

        sa.UniqueConstraint(
            "tenant_id",
            "provider",
            "external_key",
            name="ux_task_external_links_tenant_provider_external",
        ),
    )

    op.create_index("ix_task_external_links_tenant_id", "task_external_links", ["tenant_id"])
    op.create_index("ix_task_external_links_provider", "task_external_links", ["provider"])
    op.create_index("ix_task_external_links_task_id", "task_external_links", ["task_id"])


def downgrade():
    op.drop_index("ix_task_external_links_task_id", table_name="task_external_links")
    op.drop_index("ix_task_external_links_provider", table_name="task_external_links")
    op.drop_index("ix_task_external_links_tenant_id", table_name="task_external_links")
    op.drop_table("task_external_links")

    op.drop_index("ix_external_integrations_provider", table_name="external_integrations")
    op.drop_index("ix_external_integrations_tenant_id", table_name="external_integrations")
    op.drop_table("external_integrations")