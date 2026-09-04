"""make evidence analytics tenant and review SLA aware

Revision ID: 20260902_evidence_review_analytics
Revises: 20260902_evidence_review_sla
Create Date: 2026-09-02
"""

from alembic import op


revision = "20260902_evidence_review_analytics"
down_revision = "20260902_evidence_review_sla"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        CREATE OR REPLACE VIEW analytics.v_evidence_files AS
        SELECT
            ef.id,
            ef.evidence_id,
            ef.version,
            ef.status,
            ef.uploaded_at,
            ef.approved_at,
            ef.file_name,
            ef.file_size,
            ef.tenant_id,
            ef.review_due_at,
            CASE
                WHEN lower(COALESCE(ef.status, '')) = 'approved'
                    THEN 'APPROVED'
                WHEN lower(COALESCE(ef.status, '')) = 'rejected'
                    THEN 'REJECTED'
                WHEN lower(COALESCE(ef.status, '')) = 'uploaded'
                    THEN 'NOT_SUBMITTED'
                WHEN lower(COALESCE(ef.status, '')) = 'waiting_approval'
                     AND ef.review_due_at IS NULL
                    THEN 'PENDING'
                WHEN lower(COALESCE(ef.status, '')) = 'waiting_approval'
                     AND ef.review_due_at < CURRENT_TIMESTAMP
                    THEN 'OVERDUE'
                WHEN lower(COALESCE(ef.status, '')) = 'waiting_approval'
                     AND ef.review_due_at <= CURRENT_TIMESTAMP + INTERVAL '24 hours'
                    THEN 'DUE_SOON'
                WHEN lower(COALESCE(ef.status, '')) = 'waiting_approval'
                    THEN 'PENDING'
                ELSE UPPER(COALESCE(ef.status, 'UNKNOWN'))
            END AS review_status,
            CASE
                WHEN ef.review_due_at IS NULL
                    THEN NULL
                ELSE FLOOR(
                    EXTRACT(
                        EPOCH FROM (ef.review_due_at - CURRENT_TIMESTAMP)
                    ) / 86400
                )::integer
            END AS review_days_remaining,
            CASE
                WHEN lower(COALESCE(ef.status, '')) = 'waiting_approval'
                     AND ef.review_due_at IS NOT NULL
                     AND ef.review_due_at < CURRENT_TIMESTAMP
                    THEN TRUE
                ELSE FALSE
            END AS is_overdue
        FROM evidence_files ef;
    """)

    op.execute("""
        CREATE OR REPLACE VIEW analytics.v_evidence_intelligence AS
        SELECT
            e.id AS evidence_id,
            e.control_id,
            e.title,
            e.status,
            count(DISTINCT ef.id) AS file_count,
            count(DISTINCT ef.id)
                FILTER (
                    WHERE lower(COALESCE(ef.status, '')) = 'approved'
                ) AS approved_count,
            count(DISTINCT ef.id)
                FILTER (
                    WHERE lower(COALESCE(ef.status, '')) = 'rejected'
                ) AS rejected_count,
            max(ef.uploaded_at) AS last_upload,
            max(ef.approved_at) AS last_approval,
            CASE
                WHEN count(ef.id) = 0
                    THEN 'missing'
                WHEN count(*) FILTER (
                    WHERE lower(COALESCE(ef.status, '')) = 'approved'
                ) = count(ef.id)
                    THEN 'complete'
                WHEN count(*) FILTER (
                    WHERE lower(COALESCE(ef.status, '')) = 'rejected'
                ) > 0
                    THEN 'attention'
                ELSE 'pending'
            END AS intelligence_status,
            e.tenant_id
        FROM evidences e
        LEFT JOIN evidence_files ef
            ON ef.evidence_id = e.id
        WHERE e.is_deleted = false
        GROUP BY
            e.id,
            e.control_id,
            e.title,
            e.status,
            e.tenant_id;
    """)


def downgrade():
    op.execute("""
        CREATE OR REPLACE VIEW analytics.v_evidence_files AS
        SELECT
            id,
            evidence_id,
            version,
            status,
            uploaded_at,
            approved_at,
            file_name,
            file_size
        FROM evidence_files ef;
    """)

    op.execute("""
        CREATE OR REPLACE VIEW analytics.v_evidence_intelligence AS
        SELECT
            e.id AS evidence_id,
            e.control_id,
            e.title,
            e.status,
            count(DISTINCT ef.id) AS file_count,
            count(DISTINCT ef.id)
                FILTER (
                    WHERE lower(COALESCE(ef.status, '')) = 'approved'
                ) AS approved_count,
            count(DISTINCT ef.id)
                FILTER (
                    WHERE lower(COALESCE(ef.status, '')) = 'rejected'
                ) AS rejected_count,
            max(ef.uploaded_at) AS last_upload,
            max(ef.approved_at) AS last_approval,
            CASE
                WHEN count(ef.id) = 0
                    THEN 'missing'
                WHEN count(*) FILTER (
                    WHERE lower(COALESCE(ef.status, '')) = 'approved'
                ) = count(ef.id)
                    THEN 'complete'
                WHEN count(*) FILTER (
                    WHERE lower(COALESCE(ef.status, '')) = 'rejected'
                ) > 0
                    THEN 'attention'
                ELSE 'pending'
            END AS intelligence_status
        FROM evidences e
        LEFT JOIN evidence_files ef
            ON ef.evidence_id = e.id
        WHERE e.is_deleted = false
        GROUP BY
            e.id,
            e.control_id,
            e.title,
            e.status;
    """)
