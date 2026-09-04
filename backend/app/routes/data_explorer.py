from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.dependencies.permission_checker import require_permission
from app.models.user import User


router = APIRouter(
    prefix="/data-explorer",
    tags=["Data Explorer"],
)


DATASETS = {
    "evidences",
    "risks",
    "controls",
    "compliance_tasks",
}


@router.get("/metadata")
def get_metadata(
    user: User = Depends(require_permission("data.explorer.view")),
):
    return {
        "datasets": [
            {
                "code": "evidences",
                "name": "Evidence",
                "read_only": True,
            },
            {
                "code": "risks",
                "name": "Risks",
                "read_only": True,
            },
            {
                "code": "controls",
                "name": "Controls",
                "read_only": True,
            },
            {
                "code": "compliance_tasks",
                "name": "Compliance Tasks",
                "read_only": True,
            },
        ]
    }


@router.get("/{dataset}")
def explore_dataset(
    dataset: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: str | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("data.explorer.view")),
):
    if dataset not in DATASETS:
        raise HTTPException(
            status_code=404,
            detail="Unknown dataset",
        )

    tenant_id = user.tenant_id
    offset = (page - 1) * page_size

    if dataset == "evidences":
        where = """
            e.tenant_id = :tenant_id
            AND e.is_deleted = false
        """

        params: dict[str, Any] = {
            "tenant_id": tenant_id,
            "limit": page_size,
            "offset": offset,
        }

        if search:
            where += """
                AND (
                    e.title ILIKE :search
                    OR e.description ILIKE :search
                    OR e.status ILIKE :search
                )
            """
            params["search"] = f"%{search}%"

        rows = db.execute(
            text(f"""
                SELECT
                    e.id,
                    e.title,
                    e.status,
                    e.assessment_type,
                    e.control_id,
                    e.requirement_id,
                    e.standard_id,
                    e.standard_version_id,
                    e.created_at,
                    e.updated_at
                FROM evidences e
                WHERE {where}
                ORDER BY e.id DESC
                LIMIT :limit
                OFFSET :offset
            """),
            params,
        ).mappings().all()

        total = db.execute(
            text(f"""
                SELECT COUNT(*)
                FROM evidences e
                WHERE {where}
            """),
            params,
        ).scalar_one()

    elif dataset == "risks":
        where = """
            r.tenant_id = :tenant_id
        """

        params = {
            "tenant_id": tenant_id,
            "limit": page_size,
            "offset": offset,
        }

        if search:
            where += """
                AND (
                    r.title ILIKE :search
                    OR r.description ILIKE :search
                    OR r.status ILIKE :search
                    OR r.risk_level ILIKE :search
                )
            """
            params["search"] = f"%{search}%"

        rows = db.execute(
            text(f"""
                SELECT
                    r.id,
                    r.title,
                    r.description,
                    r.impact,
                    r.likelihood,
                    r.score,
                    r.risk_level,
                    r.status,
                    r.treatment,
                    r.control_id,
                    r.standard_id,
                    r.requirement_id,
                    r.created_at,
                    r.updated_at
                FROM risks r
                WHERE {where}
                ORDER BY r.id DESC
                LIMIT :limit
                OFFSET :offset
            """),
            params,
        ).mappings().all()

        total = db.execute(
            text(f"""
                SELECT COUNT(*)
                FROM risks r
                WHERE {where}
            """),
            params,
        ).scalar_one()

    elif dataset == "controls":
        where = """
            EXISTS (
                SELECT 1
                FROM matrix_rows mr
                JOIN matrix_instances mi
                    ON mi.id = mr.instance_id
                WHERE mr.control_id = c.id
                  AND mr.tenant_id = :tenant_id
                  AND mi.tenant_id = :tenant_id
            )
        """

        params = {
            "tenant_id": tenant_id,
            "limit": page_size,
            "offset": offset,
        }

        if search:
            where += """
                AND (
                    c.code ILIKE :search
                    OR c.title ILIKE :search
                    OR c.description ILIKE :search
                )
            """
            params["search"] = f"%{search}%"

        rows = db.execute(
            text(f"""
                SELECT
                    c.id,
                    c.code,
                    c.title,
                    c.description,
                    c.standard_version_id,
                    sv.standard_id
                FROM controls c
                JOIN standard_versions sv
                    ON sv.id = c.standard_version_id
                WHERE {where}
                ORDER BY c.id DESC
                LIMIT :limit
                OFFSET :offset
            """),
            params,
        ).mappings().all()

        total = db.execute(
            text(f"""
                SELECT COUNT(*)
                FROM controls c
                JOIN standard_versions sv
                    ON sv.id = c.standard_version_id
                WHERE {where}
            """),
            params,
        ).scalar_one()

    else:
        where = """
            t.tenant_id = :tenant_id
        """

        params = {
            "tenant_id": tenant_id,
            "limit": page_size,
            "offset": offset,
        }

        if search:
            where += """
                AND (
                    t.title ILIKE :search
                    OR t.description ILIKE :search
                    OR t.status ILIKE :search
                    OR t.owner_role ILIKE :search
                )
            """
            params["search"] = f"%{search}%"

        rows = db.execute(
            text(f"""
                SELECT
                    t.id,
                    t.title,
                    t.description,
                    t.priority_score,
                    t.owner_role,
                    t.due_date,
                    t.status,
                    t.source_type,
                    t.source_id,
                    t.process_id,
                    t.control_id,
                    t.created_at,
                    t.updated_at
                FROM compliance_tasks t
                WHERE {where}
                ORDER BY t.id DESC
                LIMIT :limit
                OFFSET :offset
            """),
            params,
        ).mappings().all()

        total = db.execute(
            text(f"""
                SELECT COUNT(*)
                FROM compliance_tasks t
                WHERE {where}
            """),
            params,
        ).scalar_one()

    return {
        "dataset": dataset,
        "page": page,
        "page_size": page_size,
        "total": int(total),
        "rows": [dict(row) for row in rows],
    }
