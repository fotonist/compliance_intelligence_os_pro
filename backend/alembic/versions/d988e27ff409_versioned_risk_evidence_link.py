"""versioned_risk_evidence_link

Revision ID: d988e27ff409
Revises: 3a4c01e44100
Create Date: 2026-02-14 23:18:09.118694
"""

from alembic import op
import sqlalchemy as sa

revision = "d988e27ff409"
down_revision = "3a4c01e44100"
branch_labels = None
depends_on = None


def upgrade():

    # ------------------------------------------------------------
    # 1️⃣ Add new columns (idempotent)
    # ------------------------------------------------------------
    op.execute("ALTER TABLE risk_evidence_link ADD COLUMN IF NOT EXISTS tenant_id INTEGER;")
    op.execute("ALTER TABLE risk_evidence_link ADD COLUMN IF NOT EXISTS risk_version_id INTEGER;")
    op.execute("ALTER TABLE risk_evidence_link ADD COLUMN IF NOT EXISTS evidence_file_id INTEGER;")

    # ------------------------------------------------------------
    # 2️⃣ Backfill WITHOUT JOIN (Postgres-safe)
    # ------------------------------------------------------------
    op.execute("""
        UPDATE risk_evidence_link rel
        SET
            tenant_id = COALESCE(
                rel.tenant_id,
                (SELECT tenant_id FROM risks WHERE id = rel.risk_id),
                1
            ),
            risk_version_id = COALESCE(
                rel.risk_version_id,
                (
                    SELECT id
                    FROM risk_versions
                    WHERE risk_id = rel.risk_id
                      AND version_number = 1
                    LIMIT 1
                )
            ),
            evidence_file_id = COALESCE(
                rel.evidence_file_id,
                (
                    SELECT id
                    FROM evidence_files
                    WHERE evidence_id = rel.evidence_id
                    ORDER BY version DESC, id DESC
                    LIMIT 1
                )
            )
        WHERE
            rel.risk_version_id IS NULL
            OR rel.evidence_file_id IS NULL
            OR rel.tenant_id IS NULL
    """)

    # ------------------------------------------------------------
    # 3️⃣ Safety check before NOT NULL
    # ------------------------------------------------------------
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM risk_evidence_link WHERE risk_version_id IS NULL) THEN
                RAISE EXCEPTION 'risk_version_id still NULL';
            END IF;

            IF EXISTS (SELECT 1 FROM risk_evidence_link WHERE evidence_file_id IS NULL) THEN
                RAISE EXCEPTION 'evidence_file_id still NULL';
            END IF;
        END $$;
    """)

    # ------------------------------------------------------------
    # 4️⃣ Drop old constraints safely
    # ------------------------------------------------------------
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'risk_evidence_link_risk_id_fkey'
            ) THEN
                ALTER TABLE risk_evidence_link DROP CONSTRAINT risk_evidence_link_risk_id_fkey;
            END IF;

            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'risk_evidence_link_evidence_id_fkey'
            ) THEN
                ALTER TABLE risk_evidence_link DROP CONSTRAINT risk_evidence_link_evidence_id_fkey;
            END IF;
        END $$;
    """)

    # ------------------------------------------------------------
    # 5️⃣ Drop old columns
    # ------------------------------------------------------------
    op.execute("ALTER TABLE risk_evidence_link DROP COLUMN IF EXISTS risk_id;")
    op.execute("ALTER TABLE risk_evidence_link DROP COLUMN IF EXISTS evidence_id;")

    # ------------------------------------------------------------
    # 6️⃣ Enforce NOT NULL
    # ------------------------------------------------------------
    op.execute("ALTER TABLE risk_evidence_link ALTER COLUMN tenant_id SET NOT NULL;")
    op.execute("ALTER TABLE risk_evidence_link ALTER COLUMN risk_version_id SET NOT NULL;")
    op.execute("ALTER TABLE risk_evidence_link ALTER COLUMN evidence_file_id SET NOT NULL;")

    # ------------------------------------------------------------
    # 7️⃣ Add new FKs
    # ------------------------------------------------------------
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_risk_evidence_link_tenant'
            ) THEN
                ALTER TABLE risk_evidence_link
                ADD CONSTRAINT fk_risk_evidence_link_tenant
                FOREIGN KEY (tenant_id) REFERENCES tenants(id)
                ON DELETE RESTRICT;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_risk_evidence_link_risk_version'
            ) THEN
                ALTER TABLE risk_evidence_link
                ADD CONSTRAINT fk_risk_evidence_link_risk_version
                FOREIGN KEY (risk_version_id) REFERENCES risk_versions(id)
                ON DELETE CASCADE;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_risk_evidence_link_evidence_file'
            ) THEN
                ALTER TABLE risk_evidence_link
                ADD CONSTRAINT fk_risk_evidence_link_evidence_file
                FOREIGN KEY (evidence_file_id) REFERENCES evidence_files(id)
                ON DELETE CASCADE;
            END IF;
        END $$;
    """)

    # ------------------------------------------------------------
    # 8️⃣ Indexes
    # ------------------------------------------------------------
    op.execute("CREATE INDEX IF NOT EXISTS ix_risk_evidence_link_tenant_id ON risk_evidence_link (tenant_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_risk_evidence_link_risk_version_id ON risk_evidence_link (risk_version_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_risk_evidence_link_evidence_file_id ON risk_evidence_link (evidence_file_id);")


def downgrade():
    pass
