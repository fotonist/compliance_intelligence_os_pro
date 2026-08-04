"""multi_tenant_and_versioned_risk_foundation

Revision ID: 3a4c01e44100
Revises: 9f4b1c2e7a01
Create Date: 2026-02-14 23:15:23.065081
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column
from sqlalchemy import Integer, String, DateTime
from datetime import datetime

# revision identifiers, used by Alembic.
revision = '3a4c01e44100'
down_revision = '9f4b1c2e7a01'
branch_labels = None
depends_on = None


def upgrade():

    # ------------------------------------------------------------------
    # 1️⃣ TENANTS TABLE
    # ------------------------------------------------------------------
    op.create_table(
        'tenants',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('code', sa.String(length=64), nullable=False, unique=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Create default tenant
    op.execute(
        """
        INSERT INTO tenants (id, code, name, status, created_at)
        VALUES (1, 'default', 'Default Tenant', 'active', now())
        """
    )

    # ------------------------------------------------------------------
    # 2️⃣ ADD tenant_id TO CORE TABLES
    # ------------------------------------------------------------------

    tables_to_update = [
        "users",
        "evidences",
        "evidence_files",
        "risks",
        "matrix_instances",
        "matrix_rows",
    ]

    for table_name in tables_to_update:
        op.add_column(
            table_name,
            sa.Column('tenant_id', sa.Integer(), nullable=True)
        )

        op.create_foreign_key(
            f'fk_{table_name}_tenant_id',
            table_name,
            'tenants',
            ['tenant_id'],
            ['id'],
            ondelete='RESTRICT'
        )

        # Backfill existing records to default tenant
        op.execute(f"UPDATE {table_name} SET tenant_id = 1 WHERE tenant_id IS NULL")

        # Make NOT NULL
        op.alter_column(table_name, 'tenant_id', nullable=False)

        # Add index
        op.create_index(
            f'ix_{table_name}_tenant_id',
            table_name,
            ['tenant_id']
        )

    # ------------------------------------------------------------------
    # 3️⃣ CREATE risk_versions TABLE
    # ------------------------------------------------------------------
    op.create_table(
        'risk_versions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('risk_id', sa.Integer(), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),

        sa.Column('impact', sa.Integer(), nullable=False),
        sa.Column('likelihood', sa.Integer(), nullable=False),
        sa.Column('score', sa.Integer(), nullable=False),
        sa.Column('risk_level', sa.String(), nullable=False),

        sa.Column('status', sa.String(), nullable=False),
        sa.Column('treatment', sa.String(), nullable=True),
        sa.Column('action', sa.String(), nullable=True),

        sa.Column('created_at', sa.DateTime(), nullable=False, default=datetime.utcnow),
    )

    op.create_foreign_key(
        'fk_risk_versions_tenant_id',
        'risk_versions',
        'tenants',
        ['tenant_id'],
        ['id'],
        ondelete='RESTRICT'
    )

    op.create_foreign_key(
        'fk_risk_versions_risk_id',
        'risk_versions',
        'risks',
        ['risk_id'],
        ['id'],
        ondelete='CASCADE'
    )

    op.create_index(
        'ix_risk_versions_risk_id',
        'risk_versions',
        ['risk_id']
    )

    # ------------------------------------------------------------------
    # 4️⃣ BACKFILL EXISTING RISKS INTO risk_versions (v1)
    # ------------------------------------------------------------------
    op.execute("""
        INSERT INTO risk_versions (
            tenant_id,
            risk_id,
            version_number,
            impact,
            likelihood,
            score,
            risk_level,
            status,
            treatment,
            action,
            created_at
        )
        SELECT
            tenant_id,
            id,
            1,
            impact,
            likelihood,
            score,
            risk_level,
            status,
            treatment,
            action,
            now()
        FROM risks
    """)


def downgrade():

    # Drop risk_versions
    op.drop_table('risk_versions')

    # Remove tenant_id columns and indexes
    tables_to_update = [
        "matrix_rows",
        "matrix_instances",
        "risks",
        "evidence_files",
        "evidences",
        "users",
    ]

    for table_name in tables_to_update:
        op.drop_index(f'ix_{table_name}_tenant_id', table_name=table_name)
        op.drop_constraint(f'fk_{table_name}_tenant_id', table_name, type_='foreignkey')
        op.drop_column(table_name, 'tenant_id')

    op.drop_table('tenants')
