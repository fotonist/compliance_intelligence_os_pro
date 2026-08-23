from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    Boolean,
    event,
    text,
)
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.base import Base
from app.models.mixins import TenantMixin


class Evidence(Base, TenantMixin):

    __tablename__ = "evidences"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    # =========================================================
    # MULTI-TENANT
    # =========================================================

    tenant_id = Column(
        Integer,
        ForeignKey(
            "tenants.id",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )

    # =========================================================
    # SOFT DELETE
    # =========================================================

    is_deleted = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    # =========================================================
    # VERSION CONTEXT
    # =========================================================

    standard_version_id = Column(
        Integer,
        ForeignKey(
            "standard_versions.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        index=True,
    )

    # =========================================================
    # FOREIGN KEYS
    # =========================================================

    control_id = Column(
        Integer,
        ForeignKey("controls.id"),
        nullable=True,
    )

    requirement_id = Column(
        Integer,
        ForeignKey("requirements.id"),
        nullable=True,
    )

    # =========================================================
    # STANDARD ROOT CONTEXT
    # =========================================================

    standard_id = Column(
        Integer,
        ForeignKey("standards.id"),
        nullable=False,
        index=True,
    )

    # =========================================================
    # CORE FIELDS
    # =========================================================

    title = Column(
        String,
        nullable=False,
    )

    description = Column(
        String,
        nullable=True,
    )

    regulation = Column(
        String(50),
        nullable=True,
    )

    source_url = Column(
        String,
        nullable=True,
    )

    # =========================================================
    # ASSESSMENT TYPE
    # =========================================================

    assessment_type = Column(
        String(20),
        nullable=False,
        default="control",
        index=True,
    )

    # =========================================================
    # EVIDENCE WORKFLOW STATUS
    # =========================================================

    status = Column(
        String(20),
        nullable=False,
        default="Uploaded",
    )

    # =========================================================
    # RELATIONSHIPS
    # =========================================================

    control = relationship(
        "Control",
        back_populates="evidences",
        lazy="joined",
    )

    requirement = relationship(
        "Requirement",
        back_populates="evidences",
        lazy="joined",
    )

    standard = relationship(
        "Standard",
        lazy="joined",
    )

    standard_version = relationship(
        "StandardVersion",
        lazy="joined",
    )

    # =========================================================
    # REVIEW / APPROVAL INFORMATION
    # =========================================================

    reviewed_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    reviewed_at = Column(
        DateTime,
        nullable=True,
    )

    # =========================================================
    # METADATA
    # =========================================================

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    # =========================================================
    # EVIDENCE FILES
    # =========================================================

    files = relationship(
        "EvidenceFile",
        back_populates="evidence",
        cascade="all, delete-orphan",
    )

    task_links = relationship(
        "TaskEvidenceLink",
        back_populates="evidence",
        cascade="all, delete-orphan",
    )


# =========================================================
# STANDARD CONTEXT REPAIR ON INSERT
# =========================================================
#
# Evidence has two mandatory standard-context fields:
#   - standard_id
#   - standard_version_id
#
# Older control records in production can exist with a missing
# standard_version_id. The canonical matrix chain is:
#   MatrixRow -> MatrixInstance -> StandardVersion -> Standard
#
# Resolve the context at persistence time so every Evidence creation
# path (UI, API, direct control upload, etc.) obeys the same invariant.
# =========================================================
@event.listens_for(Evidence, "before_insert")
def populate_standard_context(mapper, connection, target):
    # Nothing to repair when both mandatory values are already present.
    if target.standard_version_id is not None and target.standard_id is not None:
        return

    # ---------------------------------------------------------
    # CONTROL EVIDENCE
    # ---------------------------------------------------------
    if target.control_id is not None:
        row = connection.execute(
            text(
                """
                SELECT
                    mr.standard_id,
                    mi.standard_version_id
                FROM matrix_rows mr
                JOIN matrix_instances mi
                    ON mi.id = mr.instance_id
                WHERE mr.control_id = :control_id
                  AND (:tenant_id IS NULL OR mr.tenant_id = :tenant_id)
                ORDER BY mi.id DESC
                LIMIT 1
                """
            ),
            {
                "control_id": target.control_id,
                "tenant_id": target.tenant_id,
            },
        ).mappings().first()

        if row:
            if target.standard_id is None:
                target.standard_id = row["standard_id"]
            if target.standard_version_id is None:
                target.standard_version_id = row["standard_version_id"]

        # Fallback for legacy controls not represented in matrix_rows.
        if target.standard_version_id is None or target.standard_id is None:
            row = connection.execute(
                text(
                    """
                    SELECT
                        c.standard_version_id,
                        sv.standard_id
                    FROM controls c
                    LEFT JOIN standard_versions sv
                        ON sv.id = c.standard_version_id
                    WHERE c.id = :control_id
                    LIMIT 1
                    """
                ),
                {"control_id": target.control_id},
            ).mappings().first()

            if row:
                if target.standard_version_id is None:
                    target.standard_version_id = row["standard_version_id"]
                if target.standard_id is None:
                    target.standard_id = row["standard_id"]

    # ---------------------------------------------------------
    # MATURITY EVIDENCE
    # ---------------------------------------------------------
    if target.standard_id is not None and target.standard_version_id is None:
        row = connection.execute(
            text(
                """
                SELECT id
                FROM standard_versions
                WHERE standard_id = :standard_id
                ORDER BY
                    CASE WHEN status = 'published' THEN 0 ELSE 1 END,
                    id DESC
                LIMIT 1
                """
            ),
            {"standard_id": target.standard_id},
        ).mappings().first()

        if row:
            target.standard_version_id = row["id"]

    # ---------------------------------------------------------
    # HARD FAIL BEFORE POSTGRES NOT-NULL ERROR
    # ---------------------------------------------------------
    if target.standard_version_id is None or target.standard_id is None:
        raise ValueError(
            "Evidence standard context could not be resolved. "
            "Provide a valid control mapped to a matrix instance or "
            "provide standard_id/standard_version_id explicitly."
        )



