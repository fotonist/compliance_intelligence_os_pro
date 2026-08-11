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

# Intelligence-aware models
from app.models.gap_items import GapItem
from app.models.compliance_tasks import ComplianceTask

# -------------------------------------------------
# MATURITY – TABLE BASED (MODEL IMPORT YOK)
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
# C1 – RESOLVE ACTIVE DRAFT VERSION (WRITE GUARD)
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
# LAZY INIT – TABLE ENSURE (ALEMBIC YOK)
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
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)

    if not tenant_id:
        raise HTTPException(status_code=400, detail="tenant_id missing")

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
                Requirement.id.label("requirement_id"),
                Requirement.code.label("requirement_code"),
                Control.id.label("control_id"),
                Control.code.label("control_code"),
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
                Standard.type == "CONTROL_BASED"
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
            Requirement.id.label("requirement_id"),
            Requirement.code.label("requirement_code"),
            Control.id.label("control_id"),
            Control.code.label("control_code"),
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
                "label": "Clause",
                "visible": True,
                "position": 1,
            },
            {
                "key": "requirement_code",
                "label": "Requirement",
                "visible": True,
                "position": 2,
            },
            {
                "key": "control_code",
                "label": "Control",
                "visible": True,
                "position": 3,
            },
            {
                "key": "risk_level",
                "label": "Risk Level",
                "visible": True,
                "position": 4,
            },
            {
                "key": "coverage_status",
                "label": "Coverage",
                "visible": True,
                "position": 5,
            },
        ]

    return [
        {
            "key": r.key,
            "label": r.label,
            "visible": r.visible,
            "position": r.position,
        }
        for r in rows
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

    standard_id: int = body["standard_id"]

    draft_version = resolve_draft_version(
        db,
        standard_id,
    )

    mode: str = body["mode"]
    rows = body.get("rows")

    if rows is None:
        source = get_matrix(
            standard_id=standard_id,
            db=db,
            user=user,
        )

        rows = source.get(
            "rows",
            [],
        )

    inst = MatrixInstance(
        tenant_id=getattr(
            user,
            "tenant_id",
            None,
        )
        or 1,
        standard_id=standard_id,
        standard_version_id=draft_version.id,
        status="generated",
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
                tenant_id=getattr(
                    user,
                    "tenant_id",
                    None,
                )
                or 1,
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
        "standard_version_id": draft_version.id,
        "created": created,
        "skipped": skipped,
    }


# =================================================
# GET /matrix/instances
# =================================================
@router.get("/instances")
def list_matrix_instances(
    standard_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    q = (
        db.query(
            MatrixInstance.id,
            MatrixInstance.standard_id,
            Standard.code.label("standard_code"),
            MatrixInstance.standard_version_id,
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
    )

    if standard_id:
        q = q.filter(
            MatrixInstance.standard_id
            == standard_id
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
    inst = (
        db.query(
            MatrixInstance.id,
            MatrixInstance.status,
            MatrixInstance.standard_id,
            Standard.code.label("standard_code"),
            MatrixInstance.standard_version_id,
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
            MatrixInstance.id == id
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
            MatrixRow.instance_id == id
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
        "created_by": inst.created_by,
        "created_at": inst.created_at,
    }


# =================================================
# GET /matrix/instances/{id}/rows
# =================================================
@router.get("/instances/{id}/rows")
def get_matrix_instance_rows(
    id: int,
    limit: int = Query(default=50),
    offset: int = Query(default=0),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    q = (
        db.query(MatrixRow)
        .filter(
            MatrixRow.instance_id == id
        )
        .order_by(MatrixRow.id)
    )

    total = q.count()

    rows = (
        q.offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "items": [
            {
                "id": r.id,
                "row_key": r.row_key,
                "payload": r.payload,
            }
            for r in rows
        ],
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
    rows = (
        db.query(MatrixRow)
        .filter(
            MatrixRow.instance_id
            == instance_id
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
    inst = (
        db.query(MatrixInstance)
        .filter(
            MatrixInstance.id
            == instance_id
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
    inst = (
        db.query(MatrixInstance)
        .filter(
            MatrixInstance.id == id
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
    inst = (
        db.query(MatrixInstance)
        .filter(
            MatrixInstance.id == id
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
@router.get(
    "/instances/{instance_id}/summary"
)
def get_matrix_instance_summary(
    instance_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    summary = db.execute(
        text(
            """
            SELECT

                COUNT(*) AS total_controls,

                COUNT(*) FILTER (
                    WHERE payload->>'coverage_status'
                    = 'COVERED'
                ) AS covered_controls,

                COUNT(*) FILTER (
                    WHERE COALESCE(
                        (payload->>'evidence_count')::int,
                        0
                    ) > 0
                ) AS controls_with_evidence,

                COUNT(*) FILTER (
                    WHERE COALESCE(
                        (payload->>'open_gap_count')::int,
                        0
                    ) > 0
                ) AS open_gaps,

                COUNT(*) FILTER (
                    WHERE payload->>'risk_level'
                    IN ('HIGH', 'CRITICAL')
                ) AS high_risks

            FROM matrix_rows

            WHERE instance_id = :instance_id
            """
        ),
        {
            "instance_id": instance_id
        },
    ).fetchone()

    if not summary:
        raise HTTPException(
            status_code=404,
            detail="Matrix instance summary not found",
        )

    total = summary.total_controls or 0
    covered = summary.covered_controls or 0
    evidenced = summary.controls_with_evidence or 0

    compliance = (
        round(
            (covered / total) * 100,
            1,
        )
        if total
        else 0
    )

    evidence_coverage = (
        round(
            (evidenced / total) * 100,
            1,
        )
        if total
        else 0
    )

    return {
        "compliance_score": compliance,
        "control_coverage": compliance,
        "evidence_coverage": evidence_coverage,
        "open_gaps": summary.open_gaps or 0,
        "high_risks": summary.high_risks or 0,
        "total_controls": total,
    }


# =================================================
# GET /matrix/kpi
# =================================================
@router.get("/kpi")
def get_matrix_kpi(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = user.tenant_id

    result = get_matrix(
        standard_id=None,
        db=db,
        user=user,
    )

    rows = result.get(
        "rows",
        []
    )

    total = len(rows)

    covered = sum(
        1
        for r in rows
        if r.get("coverage_status")
        == "COVERED"
    )

    # -----------------------------
    # Evidence KPI
    # -----------------------------

    evidence_total = (
        db.query(
            func.count(Evidence.id)
        )
        .filter(
            Evidence.tenant_id
            == tenant_id,
            Evidence.is_deleted.is_(False),
        )
        .scalar()
    ) or 0

    linked_evidence = sum(
        int(
            r.get(
                "evidence_count"
            )
            or 0
        )
        for r in rows
    )

    approved_evidence = (
        db.query(
            func.count(Evidence.id)
        )
        .filter(
            Evidence.tenant_id
            == tenant_id,
            Evidence.is_deleted.is_(False),
            func.lower(
                Evidence.status
            )
            == "approved",
        )
        .scalar()
    ) or 0

    pending_evidence = (
        db.query(
            func.count(Evidence.id)
        )
        .filter(
            Evidence.tenant_id
            == tenant_id,
            Evidence.is_deleted.is_(False),
            func.lower(
                Evidence.status
            )
            == "waiting_approval",
        )
        .scalar()
    ) or 0

    uploaded_evidence = (
        db.query(
            func.count(Evidence.id)
        )
        .filter(
            Evidence.tenant_id
            == tenant_id,
            Evidence.is_deleted.is_(False),
            func.lower(
                Evidence.status
            )
            == "uploaded",
        )
        .scalar()
    ) or 0

    rejected_evidence = (
        db.query(
            func.count(Evidence.id)
        )
        .filter(
            Evidence.tenant_id
            == tenant_id,
            Evidence.is_deleted.is_(False),
            func.lower(
                Evidence.status
            )
            == "rejected",
        )
        .scalar()
    ) or 0

    # -----------------------------
    # Risk KPI
    # -----------------------------

    critical_risks = (
        db.query(
            func.count(Risk.id)
        )
        .filter(
            Risk.tenant_id
            == tenant_id,
            func.upper(
                Risk.risk_level
            )
            == "CRITICAL",
        )
        .scalar()
    ) or 0

    high_risks = (
        db.query(
            func.count(Risk.id)
        )
        .filter(
            Risk.tenant_id
            == tenant_id,
            func.upper(
                Risk.risk_level
            )
            == "HIGH",
        )
        .scalar()
    ) or 0

    compliance = (
        round(
            (covered / total) * 100,
            1,
        )
        if total
        else 0
    )

    return {
        "compliance_percentage": compliance,

        "controls": {
            "total": total,
            "covered": covered,
            "not_covered": total - covered,
        },

        "evidence": {
            "total": evidence_total,
            "approved": approved_evidence,
            "pending": pending_evidence,
            "uploaded": uploaded_evidence,
            "rejected": rejected_evidence,
            "linked": linked_evidence,
        },

        "risk": {
            "critical": int(
                critical_risks
            ),
            "high": int(
                high_risks
            ),
        },
    }
