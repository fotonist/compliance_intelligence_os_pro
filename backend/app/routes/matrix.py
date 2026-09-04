from typing import Optional, Any, Dict, List

from fastapi import APIRouter, Depends, Query, Body, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import (
    func,
    literal,
    select,
    insert,
    text,
    case,
)

import logging

from app.core.database import get_db
from app.core.security import get_current_user
from app.db.base import Base

# -------------------------------------------------
# CONTROL-BASED MODELS
# -------------------------------------------------
from app.models.standards import Standard
from app.models.standard_versions import StandardVersion
from app.models.clauses import Clause
from app.models.requirements import Requirement
from app.models.controls import Control
from app.models.risks import Risk
from app.models.evidences import Evidence
from app.services.framework.framework_adoption_service import FrameworkAdoptionService

# Intelligence-aware models
from app.models.gap_items import GapItem
from app.models.compliance_tasks import ComplianceTask

# -------------------------------------------------
# MATURITY Ã¢â‚¬â€œ TABLE BASED (MODEL IMPORT YOK)
# -------------------------------------------------
standard_practices = Base.metadata.tables["standard_practices"]
standard_process_areas = Base.metadata.tables["standard_process_areas"]

# -------------------------------------------------
# MATRIX MODELS
# -------------------------------------------------
from app.models.matrix_row import MatrixRow
from app.models.matrix_instance import MatrixInstance
from app.models.matrix_column_config import MatrixColumnConfig

logger = logging.getLogger("matrix.debug")

router = APIRouter(prefix="/matrix", tags=["Matrix"])


# =================================================
# C1 Ã¢â‚¬â€œ RESOLVE ACTIVE DRAFT VERSION (WRITE GUARD)
# =================================================
def resolve_draft_version(db: Session, standard_id: int) -> StandardVersion:
    standard = db.query(Standard).filter(Standard.id == standard_id).first()
    if not standard:
        raise HTTPException(status_code=404, detail="Standard not found")

    draft = (
        db.query(StandardVersion)
        .filter(
            StandardVersion.standard_id == standard_id,
            StandardVersion.status == "draft",
        )
        .first()
    )

    if not draft:
        raise HTTPException(
            status_code=409,
            detail="No active draft version. Matrix write is forbidden.",
        )

    return draft


# =================================================
# LAZY INIT Ã¢â‚¬â€œ TABLE ENSURE (ALEMBIC YOK)
# =================================================
DDL_MATRIX_COLUMNS = """
CREATE TABLE IF NOT EXISTS matrix_column_configs (
    id SERIAL PRIMARY KEY,

    standard_id INTEGER NOT NULL
        REFERENCES standards(id)
        ON DELETE CASCADE,

    mode VARCHAR(32) NOT NULL,

    key VARCHAR(128) NOT NULL,
    label VARCHAR(255) NOT NULL,

    source_type VARCHAR(32) NOT NULL DEFAULT 'entity_field',
    entity VARCHAR(64),
    field VARCHAR(128),
    fixed_value VARCHAR(255),

    visible BOOLEAN NOT NULL DEFAULT TRUE,
    position INTEGER NOT NULL DEFAULT 0,

    extra JSONB,

    CONSTRAINT uq_matrix_column_config_standard_mode_key
        UNIQUE (standard_id, mode, key)
);
"""


DDL_MATRIX_INSTANCES = """
CREATE TABLE IF NOT EXISTS matrix_instances (
    id SERIAL PRIMARY KEY,
    standard_id INTEGER NOT NULL REFERENCES standards(id) ON DELETE CASCADE,
    standard_version_id INTEGER NOT NULL REFERENCES standard_versions(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'generated',
    created_by INTEGER NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""


DDL_MATRIX_ROWS = """
CREATE TABLE IF NOT EXISTS matrix_rows (
    id SERIAL PRIMARY KEY,

    instance_id INTEGER NOT NULL REFERENCES matrix_instances(id) ON DELETE CASCADE,

    standard_id INTEGER NOT NULL REFERENCES standards(id) ON DELETE CASCADE,

    clause_id INTEGER NULL REFERENCES clauses(id),
    requirement_id INTEGER NULL REFERENCES requirements(id),
    control_id INTEGER NULL REFERENCES controls(id),

    process_area_id INTEGER NULL REFERENCES standard_process_areas(id),
    practice_id INTEGER NULL REFERENCES standard_practices(id),

    mode VARCHAR(20) NOT NULL,
    row_key VARCHAR(255) NOT NULL,

    payload JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
"""


DDL_MATRIX_ROWS_INDEX = """
CREATE INDEX IF NOT EXISTS ix_matrix_rows_instance_id
ON matrix_rows(instance_id);
"""


DDL_MATRIX_INSTANCES_COL_PATCH = """
ALTER TABLE matrix_instances
    ADD COLUMN IF NOT EXISTS standard_id INTEGER,
    ADD COLUMN IF NOT EXISTS standard_version_id INTEGER,
    ADD COLUMN IF NOT EXISTS status VARCHAR(32),
    ADD COLUMN IF NOT EXISTS created_by INTEGER,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;
"""


DDL_MATRIX_ROWS_COL_PATCH = """
ALTER TABLE matrix_rows
    ADD COLUMN IF NOT EXISTS instance_id INTEGER,
    ADD COLUMN IF NOT EXISTS standard_id INTEGER,
    ADD COLUMN IF NOT EXISTS clause_id INTEGER,
    ADD COLUMN IF NOT EXISTS requirement_id INTEGER,
    ADD COLUMN IF NOT EXISTS control_id INTEGER,
    ADD COLUMN IF NOT EXISTS process_area_id INTEGER,
    ADD COLUMN IF NOT EXISTS practice_id INTEGER,
    ADD COLUMN IF NOT EXISTS mode VARCHAR(20),
    ADD COLUMN IF NOT EXISTS row_key VARCHAR(255),
    ADD COLUMN IF NOT EXISTS payload JSONB,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
"""


def ensure_matrix_column_configs_table(db: Session):
    db.execute(text(DDL_MATRIX_COLUMNS))
    db.commit()


def ensure_matrix_core_tables(db: Session):
    db.execute(text(DDL_MATRIX_INSTANCES))
    db.execute(text(DDL_MATRIX_ROWS))
    db.execute(text(DDL_MATRIX_ROWS_INDEX))

    db.execute(text(DDL_MATRIX_INSTANCES_COL_PATCH))
    db.execute(text(DDL_MATRIX_ROWS_COL_PATCH))

    db.commit()


# -------------------------------------------------
# Helpers
# -------------------------------------------------
def _rows_to_dict(rows) -> List[Dict[str, Any]]:
    return [dict(r._mapping) for r in rows]


def _normalize(value: Optional[str]) -> str:
    return (value or "").strip().upper()


def _control_coverage_status_expr_intelligence(
    approved_count_col,
    open_gap_count_col,
    open_task_count_col,
):
    """
    Intelligence-aware coverage_status (priority order):
      - COVERED: approved_evidence_count > 0
      - PREDICTED_GAP: open_gap_count > 0
      - UNDER_REMEDIATION: open_task_count > 0
      - NOT_COVERED: else
    """
    return case(
        (approved_count_col > 0, literal("COVERED")),
        (open_gap_count_col > 0, literal("PREDICTED_GAP")),
        (open_task_count_col > 0, literal("UNDER_REMEDIATION")),
        else_=literal("NOT_COVERED"),
    )


# =================================================
# GET /matrix  (SINGLE SOURCE OF TRUTH)
# =================================================
@router.get("/")
def get_matrix(
    standard_id: Optional[int] = Query(default=None),
    standard_version_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    # Resolve version only for CONTROL_BASED matrices.
    # MATURITY_BASED matrices (e.g. ISO15504) are
    # version-independent and use process areas/practices.
    if standard_version_id is None and standard_id is not None:
        standard = (
            db.query(Standard)
            .filter(Standard.id == standard_id)
            .first()
        )

        if not standard:
            raise HTTPException(
                status_code=404,
                detail="Standard not found",
            )

        if _normalize(standard.type) != "MATURITY_BASED":
            try:
                standard_version_id = FrameworkAdoptionService(
                    db
                ).resolve_active_version(
                    tenant_id=tenant_id,
                    standard_id=standard_id,
                ).id
            except ValueError as exc:
                raise HTTPException(
                    status_code=409,
                    detail=str(exc),
                )

    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id missing")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id missing")

    # -------------------------------------------------
    # RESOLVE CURRENT MATRIX INSTANCE
    # -------------------------------------------------
    # The matrix landing page must be anchored to a real
    # tenant-owned MatrixInstance when no standard filter
    # was explicitly supplied.
    if standard_id is None:
        latest_instance = (
            db.query(MatrixInstance)
            .filter(
                MatrixInstance.tenant_id == tenant_id,
            )
            .order_by(
                MatrixInstance.id.desc()
            )
            .first()
        )

        if latest_instance:
            standard_id = latest_instance.standard_id
            if standard_version_id is None:
                standard_version_id = latest_instance.standard_version_id

    if standard_id is None:

        # -------------------------------------------------
        # Evidence aggregation (TENANT SAFE)
        # -------------------------------------------------
        ev_agg = (
            db.query(
                Evidence.standard_id.label("standard_id"),
                Evidence.control_id.label("control_id"),
                func.count(Evidence.id).label("evidence_count"),
                func.coalesce(
                    func.sum(
                        case(
                            (
                                func.lower(Evidence.status) == "approved",
                                1,
                            ),
                            else_=0,
                        )
                    ),
                    0,
                ).label("approved_evidence_count"),
            )
            .filter(
                Evidence.tenant_id == tenant_id,
                Evidence.is_deleted.is_(False),
                Evidence.standard_id.isnot(None),
                Evidence.control_id.isnot(None),
            )
            .group_by(
                Evidence.standard_id,
                Evidence.control_id,
            )
            .subquery()
        )

        # -------------------------------------------------
        # Risk aggregation (TENANT SAFE)
        # -------------------------------------------------
        risk_rank = case(
            (func.upper(Risk.risk_level) == "CRITICAL", 4),
            (func.upper(Risk.risk_level) == "HIGH", 3),
            (func.upper(Risk.risk_level) == "MEDIUM", 2),
            (func.upper(Risk.risk_level) == "LOW", 1),
            else_=0,
        )

        risk_agg_rank = (
            db.query(
                Risk.standard_id.label("standard_id"),
                Risk.control_id.label("control_id"),
                func.max(risk_rank).label("risk_rank"),
            )
            .filter(
                Risk.tenant_id == tenant_id,
                Risk.standard_id.isnot(None),
                Risk.control_id.isnot(None),
            )
            .group_by(
                Risk.standard_id,
                Risk.control_id,
            )
            .subquery()
        )

        risk_level_expr = case(
            (
                risk_agg_rank.c.risk_rank == 4,
                literal("CRITICAL"),
            ),
            (
                risk_agg_rank.c.risk_rank == 3,
                literal("HIGH"),
            ),
            (
                risk_agg_rank.c.risk_rank == 2,
                literal("MEDIUM"),
            ),
            (
                risk_agg_rank.c.risk_rank == 1,
                literal("LOW"),
            ),
            else_=literal(None),
        ).label("risk_level")

        # -------------------------------------------------
        # Intelligence aggregation (TENANT SAFE)
        # -------------------------------------------------
        gap_agg = (
            db.query(
                GapItem.control_id.label("control_id"),
                func.count(GapItem.id).label("open_gap_count"),
            )
            .filter(
                GapItem.tenant_id == tenant_id,
                GapItem.control_id.isnot(None),
                GapItem.status == "open",
            )
            .group_by(GapItem.control_id)
            .subquery()
        )

        task_agg = (
            db.query(
                ComplianceTask.control_id.label("control_id"),
                func.count(ComplianceTask.id).label("open_task_count"),
            )
            .filter(
                ComplianceTask.tenant_id == tenant_id,
                ComplianceTask.control_id.isnot(None),
                ComplianceTask.status.in_(
                    ["open", "in_progress"]
                ),
            )
            .group_by(ComplianceTask.control_id)
            .subquery()
        )

        evidence_count_col = func.coalesce(
            ev_agg.c.evidence_count,
            0,
        ).label("evidence_count")

        approved_count_col = func.coalesce(
            ev_agg.c.approved_evidence_count,
            0,
        ).label("approved_evidence_count")

        open_gap_count_col = func.coalesce(
            gap_agg.c.open_gap_count,
            0,
        ).label("open_gap_count")

        open_task_count_col = func.coalesce(
            task_agg.c.open_task_count,
            0,
        ).label("open_task_count")

        coverage_status_expr = _control_coverage_status_expr_intelligence(
            approved_count_col,
            open_gap_count_col,
            open_task_count_col,
        ).label("coverage_status")

        rows = (
            db.query(
                Standard.code.label("standard_code"),
                Clause.id.label("clause_id"),
                Clause.code.label("clause_code"),
                Clause.description.label("clause_description"),
                Requirement.id.label("requirement_id"),
                Requirement.code.label("requirement_code"),
                Requirement.description.label("requirement_description"),
                Control.id.label("control_id"),
                Control.code.label("control_code"),
                Control.description.label("control_description"),
                evidence_count_col,
                approved_count_col,
                open_gap_count_col,
                open_task_count_col,
                coverage_status_expr,
                risk_level_expr,
            )
            .select_from(Control)
            .join(
                Requirement,
                Control.requirement_id == Requirement.id,
            )
            .join(
                Clause,
                Requirement.clause_id == Clause.id,
            )
            .join(
                Standard,
                Clause.standard_id == Standard.id,
            )
            .outerjoin(
                ev_agg,
                (ev_agg.c.standard_id == Standard.id)
                & (ev_agg.c.control_id == Control.id),
            )
            .outerjoin(
                risk_agg_rank,
                (risk_agg_rank.c.standard_id == Standard.id)
                & (risk_agg_rank.c.control_id == Control.id),
            )
            .outerjoin(
                gap_agg,
                gap_agg.c.control_id == Control.id,
            )
            .outerjoin(
                task_agg,
                task_agg.c.control_id == Control.id,
            )
            .filter(
                Standard.type == "CONTROL_BASED",
                Control.standard_version_id == standard_version_id,
            )
            .order_by(
                Standard.code,
                Clause.code,
                Requirement.code,
                Control.code,
            )
            .all()
        )

        return {
            "mode": "control",
            "rows": _rows_to_dict(rows),
        }

    standard = (
        db.query(Standard)
        .filter(Standard.id == standard_id)
        .first()
    )

    if not standard:
        return {
            "mode": "control",
            "rows": [],
        }

    std_type = _normalize(
        getattr(standard, "type", None)
    )

    if std_type == "MATURITY_BASED":

        rows = db.execute(
            select(
                Standard.code.label("standard_code"),
                standard_process_areas.c.id.label(
                    "process_area_id"
                ),
                standard_process_areas.c.code.label(
                    "process_area_code"
                ),
                standard_process_areas.c.name.label(
                    "process_area_title"
                ),
                standard_practices.c.id.label(
                    "practice_id"
                ),
                standard_practices.c.code.label(
                    "practice_code"
                ),
                standard_practices.c.title.label(
                    "practice_title"
                ),
                standard_practices.c.level.label(
                    "target_level"
                ),
                literal(0).label("achieved_level"),
                literal(0).label("evidence_count"),
            )
            .select_from(standard_practices)
            .join(
                standard_process_areas,
                standard_practices.c.process_area_id
                == standard_process_areas.c.id,
            )
            .join(
                Standard,
                standard_practices.c.standard_id
                == Standard.id,
            )
            .where(
                Standard.id == standard.id
            )
            .order_by(
                standard_process_areas.c.code,
                standard_practices.c.code,
            )
        ).all()

        return {
            "mode": "maturity",
            "rows": _rows_to_dict(rows),
        }

    # -------------------------------------------------
    # SINGLE STANDARD (CONTROL_BASED)
    # tenant safe + intelligence aware
    # -------------------------------------------------
    ev_agg_one = (
        db.query(
            Evidence.control_id.label("control_id"),
            func.count(Evidence.id).label("evidence_count"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            func.lower(Evidence.status)
                            == "approved",
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("approved_evidence_count"),
        )
        .filter(
            Evidence.tenant_id == tenant_id,
            Evidence.is_deleted.is_(False),
            Evidence.standard_id == standard.id,
            Evidence.control_id.isnot(None),
        )
        .group_by(Evidence.control_id)
        .subquery()
    )

    risk_rank_one = case(
        (
            func.upper(Risk.risk_level)
            == "CRITICAL",
            4,
        ),
        (
            func.upper(Risk.risk_level)
            == "HIGH",
            3,
        ),
        (
            func.upper(Risk.risk_level)
            == "MEDIUM",
            2,
        ),
        (
            func.upper(Risk.risk_level)
            == "LOW",
            1,
        ),
        else_=0,
    )

    risk_agg_one = (
        db.query(
            Risk.control_id.label("control_id"),
            func.max(risk_rank_one).label("risk_rank"),
        )
        .filter(
            Risk.tenant_id == tenant_id,
            Risk.standard_id == standard.id,
            Risk.control_id.isnot(None),
        )
        .group_by(Risk.control_id)
        .subquery()
    )

    risk_level_expr_one = case(
        (
            risk_agg_one.c.risk_rank == 4,
            literal("CRITICAL"),
        ),
        (
            risk_agg_one.c.risk_rank == 3,
            literal("HIGH"),
        ),
        (
            risk_agg_one.c.risk_rank == 2,
            literal("MEDIUM"),
        ),
        (
            risk_agg_one.c.risk_rank == 1,
            literal("LOW"),
        ),
        else_=literal(None),
    ).label("risk_level")

    gap_agg_one = (
        db.query(
            GapItem.control_id.label("control_id"),
            func.count(GapItem.id).label("open_gap_count"),
        )
        .filter(
            GapItem.tenant_id == tenant_id,
            GapItem.control_id.isnot(None),
            GapItem.status == "open",
        )
        .group_by(GapItem.control_id)
        .subquery()
    )

    task_agg_one = (
        db.query(
            ComplianceTask.control_id.label("control_id"),
            func.count(
                ComplianceTask.id
            ).label("open_task_count"),
        )
        .filter(
            ComplianceTask.tenant_id == tenant_id,
            ComplianceTask.control_id.isnot(None),
            ComplianceTask.status.in_(
                ["open", "in_progress"]
            ),
        )
        .group_by(ComplianceTask.control_id)
        .subquery()
    )

    evidence_count_col_one = func.coalesce(
        ev_agg_one.c.evidence_count,
        0,
    ).label("evidence_count")

    approved_count_col_one = func.coalesce(
        ev_agg_one.c.approved_evidence_count,
        0,
    ).label("approved_evidence_count")

    open_gap_count_col_one = func.coalesce(
        gap_agg_one.c.open_gap_count,
        0,
    ).label("open_gap_count")

    open_task_count_col_one = func.coalesce(
        task_agg_one.c.open_task_count,
        0,
    ).label("open_task_count")

    coverage_status_expr_one = (
        _control_coverage_status_expr_intelligence(
            approved_count_col_one,
            open_gap_count_col_one,
            open_task_count_col_one,
        )
        .label("coverage_status")
    )

    rows = (
        db.query(
            Standard.code.label("standard_code"),
            Clause.id.label("clause_id"),
            Clause.code.label("clause_code"),
            Clause.description.label("clause_description"),
            Requirement.id.label("requirement_id"),
            Requirement.code.label("requirement_code"),
            Requirement.description.label("requirement_description"),
            Control.id.label("control_id"),
            Control.code.label("control_code"),
            Control.description.label("control_description"),
            evidence_count_col_one,
            approved_count_col_one,
            open_gap_count_col_one,
            open_task_count_col_one,
            coverage_status_expr_one,
            risk_level_expr_one,
        )
        .select_from(Control)
        .join(
            Requirement,
            Control.requirement_id == Requirement.id,
        )
        .join(
            Clause,
            Requirement.clause_id == Clause.id,
        )
        .join(
            Standard,
            Clause.standard_id == Standard.id,
        )
        .outerjoin(
            ev_agg_one,
            ev_agg_one.c.control_id == Control.id,
        )
        .outerjoin(
            risk_agg_one,
            risk_agg_one.c.control_id == Control.id,
        )
        .outerjoin(
            gap_agg_one,
            gap_agg_one.c.control_id == Control.id,
        )
        .outerjoin(
            task_agg_one,
            task_agg_one.c.control_id == Control.id,
        )
        .filter(
            Standard.id == standard.id,
            Standard.type == "CONTROL_BASED",
            Control.standard_version_id == standard_version_id,
        )
        .order_by(
            Clause.code,
            Requirement.code,
            Control.code,
        )
        .all()
    )

    return {
        "mode": "control",
        "rows": _rows_to_dict(rows),
    }


# =================================================
# GET /matrix/columns
# =================================================
@router.get("/columns")
def get_matrix_columns(
    standard_id: int = Query(...),
    mode: str = Query(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ensure_matrix_column_configs_table(db)

    rows = (
        db.query(MatrixColumnConfig)
        .filter(
            MatrixColumnConfig.standard_id == standard_id,
            MatrixColumnConfig.mode == mode,
        )
        .order_by(MatrixColumnConfig.position)
        .all()
    )

    if not rows:
        return [
            {
                "key": "clause_code",
                "label": "Clause Code",
                "visible": True,
                "position": 1,
            },
            {
                "key": "clause_description",
                "label": "Clause Definition",
                "visible": True,
                "position": 2,
            },
            {
                "key": "requirement_code",
                "label": "Requirement Code",
                "visible": True,
                "position": 3,
            },
            {
                "key": "requirement_description",
                "label": "Requirement Definition",
                "visible": True,
                "position": 4,
            },
            {
                "key": "control_code",
                "label": "Control Code",
                "visible": True,
                "position": 5,
            },
            {
                "key": "control_description",
                "label": "Control Definition",
                "visible": True,
                "position": 6,
            },
            {
                "key": "risk_level",
                "label": "Risk Level",
                "visible": True,
                "position": 7,
            },
            {
                "key": "coverage_status",
                "label": "Coverage Status",
                "visible": True,
                "position": 8,
            },
        ]

    return [
        {
            "key": r.key,
            "label": r.label,
            "visible": r.visible,
            "position": r.position,
        }
    ]


# =================================================
# POST /matrix/columns
# =================================================
@router.post("/columns")
def save_matrix_columns(
    body: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ensure_matrix_column_configs_table(db)

    standard_id = body["standard_id"]
    resolve_draft_version(db, standard_id)

    mode = body["mode"]
    columns = body["columns"]

    db.query(MatrixColumnConfig).filter(
        MatrixColumnConfig.standard_id == standard_id,
        MatrixColumnConfig.mode == mode,
    ).delete()

    for idx, c in enumerate(columns):
        db.add(
            MatrixColumnConfig(
                standard_id=standard_id,
                mode=mode,
                key=c["key"],
                label=c.get(
                    "label",
                    c["key"],
                ),
                source_type=c.get(
                    "sourceType",
                    "entity_field",
                ),
                entity=c.get("entity"),
                field=c.get("field"),
                fixed_value=c.get("fixedValue"),
                visible=c.get(
                    "visible",
                    True,
                ),
                position=idx,
            )
        )

    db.commit()

    return {
        "status": "ok",
        "count": len(columns),
    }


# =================================================
# POST /matrix/generate
# =================================================
@router.post("/generate")
def generate_matrix_rows(
    body: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    ensure_matrix_column_configs_table(db)

    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    standard_id: int = body["standard_id"]

    standard = (
        db.query(Standard)
        .filter(Standard.id == standard_id)
        .first()
    )

    if not standard:
        raise HTTPException(
            status_code=404,
            detail="Standard not found",
        )

    if _normalize(standard.type) == "MATURITY_BASED":
        published_version = (
            db.query(StandardVersion)
            .filter(
                StandardVersion.standard_id == standard_id,
                StandardVersion.status == "draft",
            )
            .order_by(StandardVersion.id.desc())
            .first()
        )

        if not published_version:
            raise HTTPException(
                status_code=409,
                detail="No active draft standard version available.",
            )
    else:
        standard = (
        db.query(Standard)
        .filter(Standard.id == standard_id)
        .first()
    )

    if not standard:
        raise HTTPException(
            status_code=404,
            detail="Standard not found",
        )

    # MATURITY_BASED standards such as ISO15504 do not
    # require a published control version for generation.
    # Their matrix is built from process areas/practices.
    if _normalize(standard.type) == "MATURITY_BASED":
        published_version = (
            db.query(StandardVersion)
            .filter(
                StandardVersion.standard_id == standard_id,
                StandardVersion.status == "draft",
            )
            .order_by(StandardVersion.id.desc())
            .first()
        )

        if not published_version:
            raise HTTPException(
                status_code=409,
                detail="No active draft standard version available.",
            )
    else:
        published_version = resolve_published_version(
            db,
            standard_id,
        )

    mode: str = body["mode"]

    # Snapshot the exact column mapping selected in Matrix Builder.
    # Each generated instance keeps its own historical column configuration.
    columns = body.get("columns") or []

    column_snapshot = []
    if isinstance(columns, list):
        for index, column in enumerate(columns, start=1):
            if not isinstance(column, dict):
                continue

            key = column.get("key")
            if not key:
                continue

            column_snapshot.append(
                {
                    "key": key,
                    "label": column.get("label") or key,
                    "visible": bool(column.get("visible", True)),
                    "sourceType": column.get("sourceType", "entity_field"),
                    "entity": column.get("entity") or "",
                    "field": column.get("field") or key,
                    "fixedValue": column.get("fixedValue"),
                    "position": column.get("position", index),
                }
            )

    rows = body.get("rows")

    if rows is None:
        source = get_matrix(
            standard_id=standard_id,
            standard_version_id=published_version.id,
            db=db,
            user=user,
        )

        rows = source.get(
            "rows",
            [],
        )

    inst = MatrixInstance(
        tenant_id=tenant_id,
        standard_id=standard_id,
        standard_version_id=published_version.id,
        status="generated",
        column_snapshot=column_snapshot,
        created_by=getattr(
            user,
            "id",
            None,
        ),
    )

    db.add(inst)
    db.commit()
    db.refresh(inst)

    created = 0
    skipped = 0

    for r in rows:

        row_key = (
            f"{r.get('clause_code')}|"
            f"{r.get('requirement_code')}|"
            f"{r.get('control_code')}"
            if mode == "control"
            else
            f"{r.get('process_area_code')}|"
            f"{r.get('practice_code')}"
        )

        existing = db.execute(
            select(MatrixRow).where(
                MatrixRow.instance_id == inst.id,
                MatrixRow.row_key == row_key,
            )
        ).scalar_one_or_none()

        if existing:
            skipped += 1
            continue

        db.execute(
            insert(MatrixRow).values(
                tenant_id=tenant_id,
                instance_id=inst.id,
                standard_id=standard_id,
                mode=mode,
                row_key=row_key,
                payload=r,
                clause_id=r.get("clause_id"),
                requirement_id=r.get("requirement_id"),
                control_id=r.get("control_id"),
                process_area_id=r.get(
                    "process_area_id"
                ),
                practice_id=r.get(
                    "practice_id"
                ),
            )
        )

        created += 1

    db.commit()

    return {
        "status": "ok",
        "matrix_instance_id": inst.id,
        "standard_id": standard_id,
        "standard_version_id": published_version.id,
        "created": created,
        "skipped": skipped,
    }


# =================================================
# GET /matrix/instances
# =================================================
@router.get("/instances")
def list_matrix_instances(
    standard_id: Optional[int] = Query(default=None),
    standard_version_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    q = (
        db.query(
            MatrixInstance.id,
            MatrixInstance.standard_id,
            Standard.code.label("standard_code"),
            MatrixInstance.standard_version_id,
            MatrixInstance.column_snapshot,
            StandardVersion.status.label(
                "standard_version_status"
            ),
            MatrixInstance.status,
            MatrixInstance.created_by,
            MatrixInstance.created_at,
        )
        .join(
            Standard,
            Standard.id == MatrixInstance.standard_id,
        )
        .join(
            StandardVersion,
            StandardVersion.id
            == MatrixInstance.standard_version_id,
        )
        .filter(
            MatrixInstance.tenant_id == tenant_id,
        )
    )

    if standard_version_id:
        q = q.filter(
            MatrixInstance.standard_version_id == standard_version_id
        )

    elif standard_id:
        q = q.filter(
            MatrixInstance.standard_id == standard_id
        )

    items = (
        q.order_by(
            MatrixInstance.id.desc()
        )
        .all()
    )

    return {
        "items": [
            {
                "id": i.id,
                "standard_id": i.standard_id,
                "standard_code": i.standard_code,
                "standard_version_id": i.standard_version_id,
                "standard_version_status": i.standard_version_status,
                "status": i.status,
                "created_by": i.created_by,
                "created_at": i.created_at,
            }
            for i in items
        ]
    }


# =================================================
# GET /matrix/instances/{id}
# =================================================
@router.get("/instances/{id}")
def get_matrix_instance_detail(
    id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    inst = (
        db.query(
            MatrixInstance.id,
            MatrixInstance.status,
            MatrixInstance.standard_id,
            Standard.code.label("standard_code"),
            MatrixInstance.standard_version_id,
            MatrixInstance.column_snapshot,
            StandardVersion.status.label(
                "standard_version_status"
            ),
            MatrixInstance.created_by,
            MatrixInstance.created_at,
        )
        .join(
            Standard,
            Standard.id == MatrixInstance.standard_id,
        )
        .join(
            StandardVersion,
            StandardVersion.id
            == MatrixInstance.standard_version_id,
        )
        .filter(
            MatrixInstance.id == id,
            MatrixInstance.tenant_id == tenant_id,
        )
        .first()
    )

    if not inst:
        raise HTTPException(
            status_code=404,
            detail="Matrix instance not found",
        )

    row_count = (
        db.query(func.count(MatrixRow.id))
        .filter(
            MatrixRow.instance_id == id,
            MatrixRow.tenant_id == tenant_id,
        )
        .scalar()
    ) or 0

    return {
        "id": inst.id,
        "status": inst.status,
        "standard_id": inst.standard_id,
        "standard_code": inst.standard_code,
        "standard_version_id": inst.standard_version_id,
        "standard_version_status": inst.standard_version_status,
        "mode": None,
        "row_count": row_count,
        "column_snapshot": inst.column_snapshot,
        "created_by": inst.created_by,
        "created_at": inst.created_at,
    }


# =================================================
# DELETE /matrix/instances/{id}
# =================================================
@router.delete("/instances/{id}", status_code=204)
def delete_matrix_instance(
    id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    instance = (
        db.query(MatrixInstance)
        .filter(
            MatrixInstance.id == id,
            MatrixInstance.tenant_id == tenant_id,
        )
        .first()
    )

    if not instance:
        raise HTTPException(
            status_code=404,
            detail="Matrix instance not found",
        )

    status = (instance.status or "").upper()

    if status in {
        "SUBMITTED",
        "APPROVED",
        "COMPLETED",
        "CLOSED",
    }:
        raise HTTPException(
            status_code=409,
            detail=(
                "Matrix instance cannot be deleted "
                f"because its lifecycle status is '{instance.status}'."
            ),
        )

    # Matrix rows are instance-owned generated data.
    # They are removed by the FK ON DELETE CASCADE.
    #
    # IMPORTANT:
    # Canonical controls, requirements, practices, process areas,
    # evidence, risks, tasks, and gaps must never be deleted merely
    # because a matrix instance references their canonical IDs.

    try:
        db.delete(instance)
        db.commit()
    except Exception:
        db.rollback()

        logger.exception(
            "Failed to delete matrix instance id=%s tenant_id=%s",
            id,
            tenant_id,
        )

        raise HTTPException(
            status_code=500,
            detail="Failed to delete matrix instance",
        )

    return None

@router.get("/instances/{id}/rows")
def get_matrix_instance_rows(
    id: int,
    limit: int = Query(default=50),
    offset: int = Query(default=0),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    q = (
        db.query(MatrixRow)
        .filter(
            MatrixRow.instance_id == id,
            MatrixRow.tenant_id == tenant_id,
        )
        .order_by(MatrixRow.id)
    )

    total = q.count()

    rows = (
        q.offset(offset)
        .limit(limit)
        .all()
    )

    items = []

    for r in rows:
        payload = dict(r.payload or {})

        # Resolve canonical framework definitions from MatrixRow FK references.
        # Definitions remain canonical data and are not persisted into payload.
        if r.clause_id is not None:
            clause = (
                db.query(Clause)
                .filter(Clause.id == r.clause_id)
                .first()
            )
            if clause is not None:
                payload["clause_description"] = clause.description

        if r.requirement_id is not None:
            requirement = (
                db.query(Requirement)
                .filter(Requirement.id == r.requirement_id)
                .first()
            )
            if requirement is not None:
                payload["requirement_description"] = requirement.description

        if r.control_id is not None:
            control = (
                db.query(Control)
                .filter(Control.id == r.control_id)
                .first()
            )
            if control is not None:
                payload["control_description"] = control.description

        items.append(
            {
                "id": r.id,
                "row_key": r.row_key,
                "payload": payload,
            }
        )

    return {
        "items": items,
        "columns": [],
        "total": total,
    }


# =================================================
# GET /matrix/preview
# =================================================
@router.get("/preview")
def preview_matrix(
    instance_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    rows = (
        db.query(MatrixRow)
        .filter(
            MatrixRow.instance_id
            == instance_id,
            MatrixRow.tenant_id == tenant_id,
        )
        .order_by(MatrixRow.id)
        .all()
    )

    return {
        "instance_id": instance_id,
        "rows": [
            r.payload
            for r in rows
        ],
    }


# =================================================
# PATCH /matrix/instances/{instance_id}/rows/{row_id}
# =================================================
@router.patch(
    "/instances/{instance_id}/rows/{row_id}"
)
def update_matrix_row_assessment(
    instance_id: int,
    row_id: int,
    body: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    inst = (
        db.query(MatrixInstance)
        .filter(
            MatrixInstance.id
            == instance_id,
            MatrixInstance.tenant_id == tenant_id,
        )
        .first()
    )

    if not inst:
        raise HTTPException(
            status_code=404,
            detail="Instance not found",
        )

    if inst.status in [
        "submitted",
        "approved",
        "closed",
    ]:
        raise HTTPException(
            status_code=409,
            detail="Instance is locked",
        )

    row = (
        db.query(MatrixRow)
        .filter(
            MatrixRow.id == row_id,
            MatrixRow.instance_id
            == instance_id,
            MatrixRow.tenant_id == tenant_id,
        )
        .first()
    )

    if not row:
        raise HTTPException(
            status_code=404,
            detail="Row not found",
        )

    payload = row.payload or {}

    assessment = payload.get(
        "assessment",
        {},
    )

    for k, v in body.items():
        assessment[k] = v

    assessment["updated_by"] = getattr(
        user,
        "id",
        None,
    )

    payload["assessment"] = assessment
    row.payload = payload

    if inst.status == "generated":
        inst.status = "in_progress"
        inst.started_at = func.now()

    db.commit()

    return {
        "status": "ok"
    }


# =================================================
# POST /matrix/instances/{id}/submit
# =================================================
@router.post(
    "/instances/{id}/submit"
)
def submit_instance(
    id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    inst = (
        db.query(MatrixInstance)
        .filter(
            MatrixInstance.id == id,
            MatrixInstance.tenant_id == tenant_id,
        )
        .first()
    )

    if not inst:
        raise HTTPException(
            status_code=404,
            detail="Matrix instance not found",
        )

    if inst.status not in [
        "generated",
        "in_progress",
    ]:
        raise HTTPException(
            status_code=409,
            detail="Invalid state transition",
        )

    inst.status = "submitted"
    inst.submitted_at = func.now()

    db.commit()

    return {
        "status": "submitted"
    }


# =================================================
# POST /matrix/instances/{id}/approve
# =================================================
@router.post(
    "/instances/{id}/approve"
)
def approve_instance(
    id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    inst = (
        db.query(MatrixInstance)
        .filter(
            MatrixInstance.id == id,
            MatrixInstance.tenant_id == tenant_id,
        )
        .first()
    )

    if not inst:
        raise HTTPException(
            status_code=404,
            detail="Matrix instance not found",
        )

    if inst.status != "submitted":
        raise HTTPException(
            status_code=409,
            detail=(
                "Only submitted instances "
                "can be approved"
            ),
        )

    inst.status = "approved"
    inst.approved_at = func.now()
    inst.approved_by = getattr(
        user,
        "id",
        None,
    )

    db.commit()

    return {
        "status": "approved"
    }


# =================================================
# GET /matrix/instances/{instance_id}/summary
#
# SINGLE CANONICAL INSTANCE SUMMARY
# =================================================
# =================================================
# GET /matrix/instances/{instance_id}/summary
#
# CANONICAL INSTANCE SUMMARY
# Tenant scoped + instance scoped
# =================================================
@router.get("/instances/{instance_id}/summary")
def get_matrix_instance_summary(
    instance_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="Tenant context is required",
        )

    instance_exists = (
        db.query(MatrixInstance.id)
        .filter(
            MatrixInstance.id == instance_id,
            MatrixInstance.tenant_id == tenant_id,
        )
        .first()
    )

    if not instance_exists:
        raise HTTPException(
            status_code=404,
            detail="Matrix instance not found",
        )

    summary = db.execute(
        text(
            """
            SELECT
                COUNT(*) AS total_controls,

                COUNT(*) FILTER (
                    WHERE UPPER(COALESCE(payload->>'coverage_status', ''))
                    = 'COVERED'
                ) AS covered_controls,

                COUNT(*) FILTER (
                    WHERE UPPER(COALESCE(payload->>'coverage_status', ''))
                    = 'PARTIAL'
                ) AS partial_controls,

                COUNT(*) FILTER (
                    WHERE COALESCE(
                        NULLIF(payload->>'approved_evidence_count', '')::int,
                        0
                    ) > 0
                ) AS controls_with_evidence,

                COUNT(*) FILTER (
                    WHERE COALESCE(
                        NULLIF(payload->>'open_gap_count', '')::int,
                        0
                    ) > 0
                ) AS open_gaps,

                COUNT(*) FILTER (
                    WHERE UPPER(COALESCE(payload->>'risk_level', ''))
                    IN ('HIGH', 'CRITICAL')
                ) AS high_risks,

                COUNT(*) FILTER (
                    WHERE UPPER(COALESCE(payload->>'status', ''))
                    IN ('COMPLIANT', 'COVERED')
                ) AS compliant,

                COUNT(*) FILTER (
                    WHERE UPPER(COALESCE(payload->>'status', ''))
                    IN ('NON_COMPLIANT', 'NON-COMPLIANT')
                ) AS non_compliant,

                COUNT(*) FILTER (
                    WHERE UPPER(COALESCE(payload->>'status', ''))
                    IN ('NOT_STARTED', 'NOT-STARTED')
                ) AS not_started,

                COALESCE(
                    SUM(
                        COALESCE(
                            NULLIF(payload->>'open_task_count', '')::int,
                            0
                        )
                    ),
                    0
                ) AS open_tasks

            FROM matrix_rows

            WHERE instance_id = :instance_id
              AND tenant_id = :tenant_id
            """
        ),
        {
            "instance_id": instance_id,
            "tenant_id": tenant_id,
        },
    ).fetchone()

    total = int(summary.total_controls or 0)
    covered = int(summary.covered_controls or 0)
    partial = int(summary.partial_controls or 0)
    evidenced = int(summary.controls_with_evidence or 0)

    weighted_coverage = (
        ((covered + (partial * 0.5)) / total) * 100
        if total
        else 0
    )

    evidence_coverage = (
        (evidenced / total) * 100
        if total
        else 0
    )

    compliance_score = round(weighted_coverage, 1)

    return {
        "total_controls": total,
        "compliance_score": compliance_score,
        "control_coverage": compliance_score,
        "evidence_coverage": round(evidence_coverage, 1),
        "open_gaps": int(summary.open_gaps or 0),
        "high_risks": int(summary.high_risks or 0),
        "open_tasks": int(summary.open_tasks or 0),
        "compliant": int(summary.compliant or 0),
        "non_compliant": int(summary.non_compliant or 0),
        "not_started": int(summary.not_started or 0),
    }

# =================================================
# GET /matrix/kpi
# =================================================
# =================================================
# GET /matrix/kpi
# =================================================
@router.get("/kpi")
def get_matrix_kpi(
    standard_id: Optional[int] = Query(default=None),
    standard_version_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="tenant_id missing",
        )

    # -------------------------------------------------
    # Resolve the same matrix instance context used by
    # the matrix landing page.
    # -------------------------------------------------
    instance_query = (
        db.query(MatrixInstance)
        .filter(
            MatrixInstance.tenant_id == tenant_id,
        )
    )

    if standard_version_id is not None:
        instance_query = instance_query.filter(
            MatrixInstance.standard_version_id
            == standard_version_id
        )
    elif standard_id is not None:
        instance_query = instance_query.filter(
            MatrixInstance.standard_id
            == standard_id
        )

    instance = (
        instance_query
        .order_by(MatrixInstance.id.desc())
        .first()
    )

    if not instance:
        return {
            "mode": "control",
            "compliance_percentage": 0,
            "controls": {
                "total": 0,
                "covered": 0,
                "partial": 0,
                "not_covered": 0,
            },
            "maturity": {
                "total": 0,
                "achieved": 0,
                "partial": 0,
                "not_achieved": 0,
            },
            "evidence": {
                "total": 0,
                "approved": 0,
                "pending": 0,
                "uploaded": 0,
                "rejected": 0,
                "draft": 0,
                "linked": 0,
            },
            "risk": {
                "critical": 0,
                "high": 0,
            },
        }

    # -------------------------------------------------
    # Matrix rows belonging ONLY to this instance.
    # -------------------------------------------------
    rows = (
        db.query(MatrixRow)
        .filter(
            MatrixRow.instance_id == instance.id,
            MatrixRow.tenant_id == tenant_id,
        )
        .all()
    )

    # -------------------------------------------------
    # Determine matrix mode from the actual row payload.
    # -------------------------------------------------
    maturity_rows = [
        r for r in rows
        if isinstance(r.payload, dict)
        and r.payload.get("practice_id") is not None
    ]

    control_rows = [
        r for r in rows
        if getattr(r, "control_id", None) is not None
    ]

    is_maturity = bool(maturity_rows) and not control_rows

    # =================================================
    # MATURITY-BASED MATRIX
    # =================================================
    if is_maturity:

        total = len(maturity_rows)

        achieved = 0
        partial = 0
        not_achieved = 0
        evidence_total = 0

        for row in maturity_rows:

            payload = row.payload or {}

            target = payload.get("target_level")
            achieved_level = payload.get("achieved_level")
            evidence_count = payload.get(
                "evidence_count",
                0,
            ) or 0

            evidence_total += int(evidence_count)

            if (
                achieved_level is not None
                and target is not None
                and float(achieved_level)
                >= float(target)
            ):
                achieved += 1

            elif (
                achieved_level is not None
                and float(achieved_level) > 0
            ):
                partial += 1

            else:
                not_achieved += 1

        maturity_percentage = (
            round(
                (achieved / total) * 100,
                1,
            )
            if total
            else 0
        )

        return {
            "mode": "maturity",
            "matrix_instance_id": instance.id,
            "standard_id": instance.standard_id,
            "standard_version_id": instance.standard_version_id,

            "compliance_percentage": maturity_percentage,

            "controls": {
                "total": 0,
                "covered": 0,
                "partial": 0,
                "not_covered": 0,
            },

            "maturity": {
                "total": total,
                "achieved": achieved,
                "partial": partial,
                "not_achieved": not_achieved,
            },

            "evidence": {
                "total": evidence_total,
                "approved": 0,
                "pending": 0,
                "uploaded": 0,
                "rejected": 0,
                "draft": 0,
                "linked": evidence_total,
            },

            "risk": {
                "critical": 0,
                "high": 0,
            },
        }

    # =================================================
    # CONTROL-BASED MATRIX
    # =================================================

    control_ids = list({
        r.control_id
        for r in rows
        if getattr(r, "control_id", None)
    })

    total = len(control_ids)

    if not total:
        return {
            "mode": "control",
            "matrix_instance_id": instance.id,
            "standard_id": instance.standard_id,
            "standard_version_id": instance.standard_version_id,
            "compliance_percentage": 0,
            "controls": {
                "total": 0,
                "covered": 0,
                "partial": 0,
                "not_covered": 0,
            },
            "maturity": {
                "total": 0,
                "achieved": 0,
                "partial": 0,
                "not_achieved": 0,
            },
            "evidence": {
                "total": 0,
                "approved": 0,
                "pending": 0,
                "uploaded": 0,
                "rejected": 0,
                "draft": 0,
                "linked": 0,
            },
            "risk": {
                "critical": 0,
                "high": 0,
            },
        }

    approved_evidence = (
        db.query(
            func.count(
                func.distinct(Evidence.control_id)
            )
        )
        .filter(
            Evidence.tenant_id == tenant_id,
            Evidence.is_deleted.is_(False),
            Evidence.standard_id == instance.standard_id,
            Evidence.control_id.in_(control_ids),
            func.lower(Evidence.status) == "approved",
        )
        .scalar()
    ) or 0

    partial_controls = (
        db.query(
            func.count(
                func.distinct(Evidence.control_id)
            )
        )
        .filter(
            Evidence.tenant_id == tenant_id,
            Evidence.is_deleted.is_(False),
            Evidence.standard_id == instance.standard_id,
            Evidence.control_id.in_(control_ids),
            func.lower(Evidence.status).in_(
                [
                    "draft",
                    "waiting_approval",
                    "uploaded",
                ]
            ),
        )
        .scalar()
    ) or 0

    evidence_query = (
        db.query(func.count(Evidence.id))
        .filter(
            Evidence.tenant_id == tenant_id,
            Evidence.is_deleted.is_(False),
            Evidence.standard_id == instance.standard_id,
            Evidence.control_id.in_(control_ids),
        )
    )

    evidence_total = evidence_query.scalar() or 0

    approved_count = (
        evidence_query
        .filter(
            func.lower(Evidence.status)
            == "approved"
        )
        .scalar()
        or 0
    )

    pending_count = (
        evidence_query
        .filter(
            func.lower(Evidence.status)
            == "waiting_approval"
        )
        .scalar()
        or 0
    )

    uploaded_count = (
        evidence_query
        .filter(
            func.lower(Evidence.status)
            == "uploaded"
        )
        .scalar()
        or 0
    )

    rejected_count = (
        evidence_query
        .filter(
            func.lower(Evidence.status)
            == "rejected"
        )
        .scalar()
        or 0
    )

    draft_count = (
        evidence_query
        .filter(
            func.lower(Evidence.status)
            == "draft"
        )
        .scalar()
        or 0
    )

    critical_risks = (
        db.query(func.count(Risk.id))
        .filter(
            Risk.tenant_id == tenant_id,
            Risk.standard_id == instance.standard_id,
            Risk.control_id.in_(control_ids),
            func.upper(Risk.risk_level) == "CRITICAL",
        )
        .scalar()
    ) or 0

    high_risks = (
        db.query(func.count(Risk.id))
        .filter(
            Risk.tenant_id == tenant_id,
            Risk.standard_id == instance.standard_id,
            Risk.control_id.in_(control_ids),
            func.upper(Risk.risk_level) == "HIGH",
        )
        .scalar()
    ) or 0

    coverage_percentage = (
        round(
            (
                (
                    approved_evidence
                    + (partial_controls * 0.5)
                )
                / total
            ) * 100,
            1,
        )
        if total
        else 0
    )

    return {
        "mode": "control",
        "matrix_instance_id": instance.id,
        "standard_id": instance.standard_id,
        "standard_version_id": instance.standard_version_id,

        "compliance_percentage": coverage_percentage,

        "controls": {
            "total": total,
            "covered": approved_evidence,
            "partial": partial_controls,
            "not_covered": max(
                0,
                total
                - approved_evidence
                - partial_controls,
            ),
        },

        "maturity": {
            "total": 0,
            "achieved": 0,
            "partial": 0,
            "not_achieved": 0,
        },

        "evidence": {
            "total": evidence_total,
            "approved": approved_count,
            "pending": pending_count,
            "uploaded": uploaded_count,
            "rejected": rejected_count,
            "draft": draft_count,
            "linked": evidence_total,
        },

        "risk": {
            "critical": int(critical_risks),
            "high": int(high_risks),
        },
    }


# RESOLVE ACTIVE PUBLISHED VERSION (MATRIX READ)
# =================================================
def resolve_published_version(
    db: Session,
    standard_id: int,
) -> StandardVersion:

    standard = (
        db.query(Standard)
        .filter(
            Standard.id == standard_id
        )
        .first()
    )

    if not standard:
        raise HTTPException(
            status_code=404,
            detail="Standard not found",
        )

    # Prefer published; fall back to active.
    # Draft versions are never used for matrix reads.
    version = (
        db.query(StandardVersion)
        .filter(
            StandardVersion.standard_id == standard_id,
            StandardVersion.status.in_(["published", "active"]),
        )
        .order_by(
            (StandardVersion.status == "published").desc(),
            StandardVersion.id.desc(),
        )
        .first()
    )

    if not version:
        raise HTTPException(
            status_code=409,
            detail="No published or active standard version available.",
        )

    return version














