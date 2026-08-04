"""audit_sessions_and_hybrid_snapshots

Revision ID: dbecd0b3187e
Revises: d988e27ff409
Create Date: 2026-02-15
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "dbecd0b3187e"
down_revision = "d988e27ff409"
branch_labels = None
depends_on = None


def upgrade():

    # ============================================================
    # 1️⃣ AUDIT SESSIONS
    # ============================================================

    op.create_table(
        "audit_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), nullable=False, index=True),
        sa.Column("standard_id", sa.Integer(), nullable=False, index=True),
        sa.Column("standard_version_id", sa.Integer(), nullable=False, index=True),

        sa.Column("status", sa.String(length=16), nullable=False, server_default="ACTIVE", index=True),

        sa.Column("type", sa.String(length=32), nullable=True),
        sa.Column("target_maturity_level", sa.Integer(), nullable=True),

        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_foreign_key(
        "fk_audit_sessions_tenant",
        "audit_sessions",
        "tenants",
        ["tenant_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.create_foreign_key(
        "fk_audit_sessions_standard",
        "audit_sessions",
        "standards",
        ["standard_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    op.create_foreign_key(
        "fk_audit_sessions_standard_version",
        "audit_sessions",
        "standard_versions",
        ["standard_version_id"],
        ["id"],
        ondelete="RESTRICT",
    )

   

    # 🔒 Tek ACTIVE audit kuralı
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ux_one_active_audit_per_tenant_standard_version
        ON audit_sessions (tenant_id, standard_version_id)
        WHERE status = 'ACTIVE';
    """)

    # ============================================================
    # 2️⃣ AUDIT SCOPE ENTITIES (Applicability Snapshot)
    # ============================================================

    op.create_table(
        "audit_scope_entities",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("audit_session_id", sa.Integer(), nullable=False, index=True),

        sa.Column("entity_type", sa.String(length=32), nullable=False, index=True),
        sa.Column("original_entity_id", sa.Integer(), nullable=True, index=True),

        sa.Column("entity_code", sa.String(length=64), nullable=True),
        sa.Column("entity_title", sa.String(length=512), nullable=True),
        sa.Column("entity_description", sa.Text(), nullable=True),

        sa.Column("clause_code", sa.String(length=64), nullable=True),
        sa.Column("requirement_code", sa.String(length=64), nullable=True),
        sa.Column("control_code", sa.String(length=64), nullable=True),

        sa.Column("applicability_dimensions", postgresql.JSONB(), nullable=True),

        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_foreign_key(
        "fk_audit_scope_entities_session",
        "audit_scope_entities",
        "audit_sessions",
        ["audit_session_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.create_index("ix_audit_scope_entities_session", "audit_scope_entities", ["audit_session_id"])

    # ============================================================
    # 3️⃣ AUDIT EVIDENCE SNAPSHOTS
    # ============================================================

    op.create_table(
        "audit_evidence_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),

        sa.Column("audit_session_id", sa.Integer(), nullable=False, index=True),
        sa.Column("audit_scope_entity_id", sa.Integer(), nullable=False, index=True),

        sa.Column("evidence_file_id", sa.Integer(), nullable=False, index=True),

        sa.Column("file_name", sa.String(length=512), nullable=True),
        sa.Column("file_path", sa.String(length=1024), nullable=True),
        sa.Column("file_size", sa.Integer(), nullable=True),
        sa.Column("mime_type", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=True),

        sa.Column("uploaded_by", sa.Integer(), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_by", sa.Integer(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),

        sa.Column("snapshot_taken_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_foreign_key(
        "fk_audit_evidence_snapshots_session",
        "audit_evidence_snapshots",
        "audit_sessions",
        ["audit_session_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.create_foreign_key(
        "fk_audit_evidence_snapshots_entity",
        "audit_evidence_snapshots",
        "audit_scope_entities",
        ["audit_scope_entity_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.create_foreign_key(
        "fk_audit_evidence_snapshots_evidence_file",
        "audit_evidence_snapshots",
        "evidence_files",
        ["evidence_file_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    # ============================================================
    # 4️⃣ AUDIT RISK SNAPSHOTS
    # ============================================================

    op.create_table(
        "audit_risk_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True),

        sa.Column("audit_session_id", sa.Integer(), nullable=False, index=True),
        sa.Column("audit_scope_entity_id", sa.Integer(), nullable=False, index=True),

        sa.Column("risk_version_id", sa.Integer(), nullable=False, index=True),

        sa.Column("impact", sa.Integer(), nullable=True),
        sa.Column("likelihood", sa.Integer(), nullable=True),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("risk_level", sa.String(length=64), nullable=True),
        sa.Column("status", sa.String(length=64), nullable=True),

        sa.Column("snapshot_taken_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_foreign_key(
        "fk_audit_risk_snapshots_session",
        "audit_risk_snapshots",
        "audit_sessions",
        ["audit_session_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.create_foreign_key(
        "fk_audit_risk_snapshots_entity",
        "audit_risk_snapshots",
        "audit_scope_entities",
        ["audit_scope_entity_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.create_foreign_key(
        "fk_audit_risk_snapshots_risk_version",
        "audit_risk_snapshots",
        "risk_versions",
        ["risk_version_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    # ============================================================
    # 5️⃣ AUDIT FINDINGS (Hybrid Output)
    # ============================================================

    op.create_table(
        "audit_findings",
        sa.Column("id", sa.Integer(), primary_key=True),

        sa.Column("audit_session_id", sa.Integer(), nullable=False, index=True),
        sa.Column("audit_scope_entity_id", sa.Integer(), nullable=False, index=True),

        sa.Column("gap_level", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("coverage_score", sa.Integer(), nullable=True),
        sa.Column("risk_weight", sa.Integer(), nullable=True),
        sa.Column("priority_score", sa.Integer(), nullable=True),

        sa.Column("calculated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_foreign_key(
        "fk_audit_findings_session",
        "audit_findings",
        "audit_sessions",
        ["audit_session_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.create_foreign_key(
        "fk_audit_findings_entity",
        "audit_findings",
        "audit_scope_entities",
        ["audit_scope_entity_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade():
    op.drop_table("audit_findings")
    op.drop_table("audit_risk_snapshots")
    op.drop_table("audit_evidence_snapshots")
    op.drop_table("audit_scope_entities")
    op.execute("DROP INDEX IF EXISTS ux_one_active_audit_per_tenant_standard_version;")
    op.drop_table("audit_sessions")
