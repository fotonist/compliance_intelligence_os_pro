from __future__ import annotations

import re
from typing import Any, Dict, Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.dependencies.auth import get_current_user
from app.db.session import get_db

router = APIRouter(prefix="/risks", tags=["Risks"])


# -------------------------------------------------
# Models
# -------------------------------------------------

class RiskCreateRequest(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    likelihood: Optional[int] = None
    impact: Optional[int] = None
    treatment: Optional[str] = None
    status: Optional[str] = None
    action: Optional[str] = None
    control_id: Optional[int] = None
    source_type: Optional[str] = None
    source_id: Optional[int] = None


class RiskUpdateRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    likelihood: Optional[int] = None
    impact: Optional[int] = None
    treatment: Optional[str] = None
    status: Optional[str] = None
    action: Optional[str] = None
    control_id: Optional[int] = None
    source_type: Optional[str] = None
    source_id: Optional[int] = None


# -------------------------------------------------
# Helpers
# -------------------------------------------------

def row_to_dict(row) -> Dict[str, Any]:
    return dict(row._mapping)


def calculate_risk_level(score: Optional[int]) -> Optional[str]:
    if score is None:
        return None
    if score >= 20:
        return "CRITICAL"
    if score >= 15:
        return "HIGH"
    if score >= 10:
        return "MEDIUM"
    if score >= 5:
        return "LOW"
    return "VERY_LOW"


# -------------------------------------------------
# Assess Risk (HISTORY WRITE – CANONICAL)
# -------------------------------------------------

@router.post("/{risk_id}/assess")
def assess_risk(
    risk_id: int,
    payload: dict,
    db: Session = Depends(get_db),
):
    risk = db.execute(
        text("SELECT * FROM risks WHERE id = :id"),
        {"id": risk_id},
    ).fetchone()

    if not risk:
        raise HTTPException(status_code=404, detail="Risk not found")

    new_likelihood = payload.get("likelihood")
    new_impact = payload.get("impact")
    action = payload.get("action")

    if new_likelihood is None or new_impact is None:
        raise HTTPException(
            status_code=400,
            detail="likelihood and impact are required",
        )

    new_score = new_likelihood * new_impact

    if new_score >= 15:
        new_risk_level = "HIGH"
    elif new_score >= 8:
        new_risk_level = "MEDIUM"
    else:
        new_risk_level = "LOW"

    # ✅ HISTORY INSERT (FULL SNAPSHOT)
    db.execute(
        text(
            """
            INSERT INTO risk_history (
                risk_id,
                likelihood_old, likelihood_new,
                impact_old, impact_new,
                score_old, score_new,
                risk_level_old, risk_level_new,
                treatment_old, treatment_new,
                status_old, status_new,
                action_old, action_new,
                changed_by,
                changed_at
            )
            VALUES (
                :risk_id,
                :likelihood_old, :likelihood_new,
                :impact_old, :impact_new,
                :score_old, :score_new,
                :risk_level_old, :risk_level_new,
                :treatment_old, :treatment_new,
                :status_old, :status_new,
                :action_old, :action_new,
                :changed_by,
                NOW()
            )
            """
        ),
        {
            "risk_id": risk_id,
            "likelihood_old": risk.likelihood,
            "likelihood_new": new_likelihood,
            "impact_old": risk.impact,
            "impact_new": new_impact,
            "score_old": risk.score,
            "score_new": new_score,
            "risk_level_old": getattr(risk, "risk_level", None),
            "risk_level_new": new_risk_level,
            "treatment_old": getattr(risk, "treatment", None),
            "treatment_new": getattr(risk, "treatment", None),
            "status_old": getattr(risk, "status", None),
            "status_new": getattr(risk, "status", None),
            "action_old": getattr(risk, "action", None),
            "action_new": action,
            "changed_by": None,
        },
    )
# -------------------------------------------------
# Get Single Risk
# -------------------------------------------------

@router.get("/{risk_id}")
def get_risk(
    risk_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    row = db.execute(
        text(
            """
            SELECT *
            FROM risks
            WHERE id = :id
            AND tenant_id = :tenant_id
            """
        ),
        {
            "id": risk_id,
            "tenant_id": current_user.tenant_id,
        },
    ).fetchone()

    if not row:
        raise HTTPException(
            status_code=404,
            detail="Risk not found",
        )

    return row_to_dict(row)
    # UPDATE RISK
    db.execute(
        text(
            """
            UPDATE risks
            SET
                likelihood = :likelihood,
                impact = :impact,
                score = :score,
                risk_level = :risk_level,
                action = :action
            WHERE id = :id
            """
        ),
        {
            "likelihood": new_likelihood,
            "impact": new_impact,
            "score": new_score,
            "risk_level": new_risk_level,
            "action": action,
            "id": risk_id,
        },
    )

    db.commit()
    return {"ok": True}


# -------------------------------------------------
# Basic CRUD
# -------------------------------------------------

@router.get("")
def list_risks(
    page: int = 1,
    page_size: int = 20,
    status: str = "open",
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_id = current_user.tenant_id

    if page < 1:
        page = 1

    if page_size < 1:
        page_size = 20

    if page_size > 100:
        page_size = 100

    offset = (page - 1) * page_size

    where_conditions = [
        "r.tenant_id = :tenant_id"
    ]

    params = {
        "tenant_id": tenant_id,
        "limit": page_size,
        "offset": offset,
    }

    # -------------------------------------------------
    # STATUS FILTER
    # -------------------------------------------------

    if status and status.lower() != "all":
        where_conditions.append(
            "LOWER(COALESCE(r.status, '')) = :status"
        )
        params["status"] = status.lower()

    # -------------------------------------------------
    # SEARCH
    # -------------------------------------------------

    if search and search.strip():
        where_conditions.append(
            """
            (
                LOWER(COALESCE(r.title, '')) LIKE :search
                OR LOWER(COALESCE(r.description, '')) LIKE :search
                OR LOWER(COALESCE(r.risk_level, '')) LIKE :search
            )
            """
        )

        params["search"] = f"%{search.strip().lower()}%"

    where_sql = " AND ".join(where_conditions)

    # -------------------------------------------------
    # TOTAL
    # -------------------------------------------------

    total_query = text(
        f"""
        SELECT COUNT(*)
        FROM risks r
        WHERE {where_sql}
        """
    )

    total = db.execute(
        total_query,
        params,
    ).scalar() or 0

    # -------------------------------------------------
    # DATA
    # -------------------------------------------------

    data_query = text(
        f"""
        SELECT
            r.id,
            r.tenant_id,
            r.title,
            r.description,
            r.impact,
            r.likelihood,
            r.score,
            r.risk_level,
            r.status,
            r.treatment,
            r.action,

            r.control_id,
            r.standard_id,
            r.requirement_id,

            r.control_coverage_status,

            r.prev_impact,
            r.prev_likelihood,
            r.previous_score,
            r.prev_risk_level,

            r.appetite_threshold,
            r.appetite_status,
            r.appetite_deviation,

            r.created_at,
            r.updated_at,

            COUNT(rel.evidence_id)::integer AS evidence_count

        FROM risks r

LEFT JOIN risk_versions rv
    ON rv.risk_id = r.id

LEFT JOIN risk_evidence_link rel
    ON rel.risk_version_id = rv.id

WHERE {where_sql}

GROUP BY
    r.id,
    r.tenant_id,
    r.title,
    r.description,
    r.impact,
    r.likelihood,
    r.score,
    r.risk_level,
    r.status,
    r.treatment,
    r.action,
    r.control_id,
    r.standard_id,
    r.requirement_id,
    r.control_coverage_status,
    r.prev_impact,
    r.prev_likelihood,
    r.previous_score,
    r.prev_risk_level,
    r.appetite_threshold,
    r.appetite_status,
    r.appetite_deviation,
    r.created_at,
    r.updated_at

ORDER BY r.score DESC NULLS LAST, r.id DESC

LIMIT :limit
OFFSET :offset
"""
    )
    rows = db.execute(
        data_query,
        params,
    ).fetchall()

    total_pages = (
        (int(total) + page_size - 1) // page_size
        if total
        else 1
    )

    return {
        "items": [
            row_to_dict(row)
            for row in rows
        ],
        "total": int(total),
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }

# -------------------------------------------------
# Risk History (FOR FRONTEND + BACKWARD COMPAT)
# -------------------------------------------------
# IMPORTANT:
# - Frontend (risk detail) needs *_old/*_new fields to render "Previous".
# - Some places may still expect {version, items:[{date, score}]}.
# - We return BOTH: a top-level list for rich UI, and also the legacy wrapper.
#
# Frontend (page.tsx) already supports either Array or {items: []}.
# -------------------------------------------------

@router.get("/{risk_id}/history")
def get_risk_history(risk_id: int, db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            """
            SELECT
                changed_at,
                likelihood_old, likelihood_new,
                impact_old, impact_new,
                score_old, score_new,
                treatment_old, treatment_new,
                status_old, status_new,
                action_old, action_new,
                risk_level_old, risk_level_new
            FROM risk_history
            WHERE risk_id = :risk_id
            ORDER BY changed_at
            """
        ),
        {"risk_id": risk_id},
    ).fetchall()

    rich = [
        {
            "changed_at": r.changed_at,

            "likelihood_old": r.likelihood_old,
            "likelihood_new": r.likelihood_new,

            "impact_old": r.impact_old,
            "impact_new": r.impact_new,

            "score_old": r.score_old,
            "score_new": r.score_new,

            "treatment_old": r.treatment_old,
            "treatment_new": r.treatment_new,

            "status_old": r.status_old,
            "status_new": r.status_new,

            "action_old": r.action_old,
            "action_new": r.action_new,

            "risk_level_old": getattr(r, "risk_level_old", None),
            "risk_level_new": getattr(r, "risk_level_new", None),
        }
        for r in rows
    ]

    legacy_items = [
        {
            "date": r.changed_at,
            "score": (r.score_new if r.score_new is not None else r.score_old),
        }
        for r in rows
    ]

    # Return both shapes in one response (safe for existing frontend parsing):
    # - If frontend treats response as Array => it can use rich by switching to res.json() directly
    # - If it expects {items: []} => legacy continues to work.
    #
    # Your current page.tsx does:
    #   Array.isArray(data) ? data : data.items
    # So it will pick legacy by default (object), unless you later decide to return only list.
    return {
        "version": "v1",
        "items": legacy_items,
        "rich": rich,
    }


# -------------------------------------------------
# Update Risk (SIMPLE)
# -------------------------------------------------

@router.put("/{risk_id}")
def update_risk(
    risk_id: int,
    payload: RiskUpdateRequest,
    db: Session = Depends(get_db),
):
    current = db.execute(
        text("SELECT * FROM risks WHERE id = :id"),
        {"id": risk_id},
    ).fetchone()

    if not current:
        raise HTTPException(status_code=404, detail="Risk not found")

    likelihood = payload.likelihood if payload.likelihood is not None else current.likelihood
    impact = payload.impact if payload.impact is not None else current.impact
    score = likelihood * impact

    db.execute(
        text(
            """
            UPDATE risks
            SET
                likelihood = :l,
                impact = :i,
                score = :s,
                updated_at = NOW()
            WHERE id = :id
            """
        ),
        {
            "id": risk_id,
            "l": likelihood,
            "i": impact,
            "s": score,
        },
    )

    db.commit()
    return {"ok": True}


# -------------------------------------------------
# Related Risks
# -------------------------------------------------

@router.get("/{risk_id}/related")
def get_related_risks(risk_id: int, db: Session = Depends(get_db)):
    current = db.execute(
        text("SELECT id, control_id FROM risks WHERE id = :id"),
        {"id": risk_id},
    ).fetchone()

    if not current:
        raise HTTPException(status_code=404, detail="Risk not found")

    results: Dict[int, Dict[str, Any]] = {}

    rows = db.execute(
        text(
            """
            SELECT
                r.id,
                r.title,
                r.score,
                r.risk_level,
                rr.relation_type,
                rr.relation_description
            FROM risk_relations rr
            JOIN risks r ON r.id = rr.to_risk_id
            WHERE rr.from_risk_id = :id
            """
        ),
        {"id": risk_id},
    ).fetchall()

    for r in rows:
        results[r.id] = {
            "id": r.id,
            "title": r.title,
            "score": r.score,
            "risk_level": r.risk_level,
            "relation_type": r.relation_type,
            "relation_reason": r.relation_description,
            "relation_source": "manual",
        }

    if current.control_id is not None:
        auto_rows = db.execute(
            text(
                """
                SELECT id, title, score, risk_level
                FROM risks
                WHERE id != :id AND control_id = :control_id
                """
            ),
            {"id": risk_id, "control_id": current.control_id},
        ).fetchall()

        for r in auto_rows:
            results.setdefault(
                r.id,
                {
                    "id": r.id,
                    "title": r.title,
                    "score": r.score,
                    "risk_level": r.risk_level,
                    "relation_type": "correlated",
                    "relation_reason": "Same control context",
                    "relation_source": "control_id",
                },
            )

    return list(results.values())


# -------------------------------------------------
# Related Evidences
# -------------------------------------------------

@router.get("/{risk_id}/related-evidences")
def get_related_evidences(risk_id: int, db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            """
            SELECT
                e.id,
                e.title,
                e.status,
                rel.relation_description
            FROM risk_evidence_links rel
            JOIN evidences e ON e.id = rel.evidence_id
            WHERE rel.risk_id = :risk_id
            ORDER BY e.id
            """
        ),
        {"risk_id": risk_id},
    ).fetchall()

    return [
        {
            "id": r.id,
            "title": r.title,
            "status": r.status,
            "relation_reason": r.relation_description,
        }
        for r in rows
    ]

# ------------------------------------------------------
# DELETE RISK (FINAL – DYNAMIC & SAFE)
# ------------------------------------------------------
@router.delete("/{risk_id}")
def delete_risk(
    risk_id: int,
    db: Session = Depends(get_db),
):
    # Risk exists?
    risk_row = db.execute(
        text("SELECT id FROM risks WHERE id = :id"),
        {"id": risk_id},
    ).fetchone()

    if not risk_row:
        raise HTTPException(status_code=404, detail="Risk not found")

    # --------------------------------------------------
    # Find all FK tables referencing risks(id)
    # --------------------------------------------------
    fk_rows = db.execute(
        text(
            """
            SELECT
              conrelid::regclass::text AS table_name,
              a.attname AS column_name
            FROM pg_constraint c
            JOIN pg_attribute a
              ON a.attrelid = c.conrelid
             AND a.attnum = ANY (c.conkey)
            WHERE c.contype = 'f'
              AND c.confrelid = 'risks'::regclass
            """
        )
    ).fetchall()

    # --------------------------------------------------
    # BLOCK only if evidence-linked rows exist
    # --------------------------------------------------
    for row in fk_rows:
        tbl = str(row.table_name)
        col = str(row.column_name)

        if "evidence" not in tbl.lower():
            continue

        if not re.match(r"^[A-Za-z0-9_\\.]+$", tbl):
            continue
        if not re.match(r"^[A-Za-z0-9_]+$", col):
            continue

        exists = db.execute(
            text(f"SELECT 1 FROM {tbl} WHERE {col} = :id LIMIT 1"),
            {"id": risk_id},
        ).fetchone()

        if exists:
            raise HTTPException(
                status_code=409,
                detail="This risk has linked evidences and cannot be deleted. Unlink related evidences first.",
            )

    # --------------------------------------------------
    # Clean NON-evidence FK rows (best-effort)
    # --------------------------------------------------
    for row in fk_rows:
        tbl = str(row.table_name)
        col = str(row.column_name)

        if "evidence" in tbl.lower():
            continue

        if not re.match(r"^[A-Za-z0-9_\\.]+$", tbl):
            continue
        if not re.match(r"^[A-Za-z0-9_]+$", col):
            continue

        db.execute(
            text(f"DELETE FROM {tbl} WHERE {col} = :id"),
            {"id": risk_id},
        )

    # --------------------------------------------------
    # Delete risk
    # --------------------------------------------------
    db.execute(
        text("DELETE FROM risks WHERE id = :id"),
        {"id": risk_id},
    )
    db.commit()

    return {"success": True}
# -------------------------------------------------
# Create Risk
# -------------------------------------------------

class RiskCreateIn(BaseModel):
    title: str
    description: Optional[str] = None
    likelihood: int = Field(ge=1, le=5)
    impact: int = Field(ge=1, le=5)
    process_id: int
    source_type: Optional[str] = "STANDARD"
    source_id: Optional[int] = None
    action: Optional[str] = "assessment"

# -----------------------------------------------------------------------------------------
# CREATE RISK
# ------------------------------------------------------------------------------------------
@router.post("/", status_code=201)
def create_risk(
    payload: RiskCreateIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_id = current_user.tenant_id

    score = payload.likelihood * payload.impact

    if score >= 15:
        risk_level = "HIGH"
    elif score >= 8:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    # 1️⃣ Insert base Risk
    result = db.execute(
        text(
            """
          INSERT INTO risks (
    tenant_id,
    process_id,
    title,
    description,
    likelihood,
    impact,
    score,
    risk_level,
    source_type,
    source_id,
    action,
    status,
    created_at
)
           VALUES (
    :tenant_id,
    :process_id,
    :title,
    :description,
    :likelihood,
    :impact,
    :score,
    :risk_level,
    :source_type,
    :source_id,
    :action,
    'OPEN',
    NOW()
)
            RETURNING id
            """
        ),
        {
         "tenant_id": tenant_id,
    "process_id": payload.process_id,
    "title": payload.title,
    "description": payload.description,
    "likelihood": payload.likelihood,
    "impact": payload.impact,
    "score": score,
    "risk_level": risk_level,
    "source_type": payload.source_type,
    "source_id": payload.source_id,
    "action": payload.action,
},
    )

    new_risk_id = result.scalar()

    # 2️⃣ Insert immutable RiskVersion (v1)
    db.execute(
        text(
            """
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
            VALUES (
                :tenant_id,
                :risk_id,
                1,
                :impact,
                :likelihood,
                :score,
                :risk_level,
                'OPEN',
                NULL,
                :action,
                NOW()
            )
            """
        ),
        {
            "tenant_id": tenant_id,
            "risk_id": new_risk_id,
            "impact": payload.impact,
            "likelihood": payload.likelihood,
            "score": score,
            "risk_level": risk_level,
            "action": payload.action,
        },
    )

    db.commit()

    return {"id": new_risk_id}
