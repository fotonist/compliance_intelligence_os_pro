from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user


router = APIRouter(prefix="/risks", tags=["Risks"])


class RiskCreateIn(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    likelihood: int = Field(ge=1, le=5)
    impact: int = Field(ge=1, le=5)
    process_id: int
    source_type: Optional[str] = "STANDARD"
    source_id: Optional[int] = None
    action: Optional[str] = "assessment"


class RiskUpdateIn(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1)
    description: Optional[str] = None
    likelihood: Optional[int] = Field(default=None, ge=1, le=5)
    impact: Optional[int] = Field(default=None, ge=1, le=5)
    treatment: Optional[str] = None
    status: Optional[str] = None
    action: Optional[str] = None
    process_id: Optional[int] = None
    source_type: Optional[str] = None
    source_id: Optional[int] = None


def calculate_risk_level(score: int) -> str:
    if score >= 20:
        return "CRITICAL"
    if score >= 15:
        return "HIGH"
    if score >= 10:
        return "MEDIUM"
    if score >= 5:
        return "LOW"
    return "VERY_LOW"


def validate_source(
    db: Session,
    tenant_id: int,
    source_type: str,
    source_id: Optional[int],
) -> tuple[Optional[int], Optional[int], Optional[int]]:
    standard_id = None
    requirement_id = None
    control_id = None

    if source_id is None:
        return standard_id, requirement_id, control_id

    source_type = source_type.upper()
    source_tables = {
        "STANDARD": ("standards", "standard_id"),
        "REQUIREMENT": ("requirements", "requirement_id"),
        "CONTROL": ("controls", "control_id"),
    }

    if source_type not in source_tables:
        raise HTTPException(
            status_code=400,
            detail="source_type must be STANDARD, REQUIREMENT, or CONTROL",
        )

    table_name, target_name = source_tables[source_type]
    exists = db.execute(
        text(
            f"""
            SELECT id
            FROM {table_name}
            WHERE id = :source_id
              AND tenant_id = :tenant_id
            """
        ),
        {"source_id": source_id, "tenant_id": tenant_id},
    ).scalar()

    if exists is None:
        raise HTTPException(status_code=404, detail=f"{source_type.title()} not found")

    if target_name == "standard_id":
        standard_id = source_id
    elif target_name == "requirement_id":
        requirement_id = source_id
    else:
        control_id = source_id

    return standard_id, requirement_id, control_id


@router.post("/", status_code=201)
def create_risk(
    payload: RiskCreateIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_id = current_user.tenant_id

    process_exists = db.execute(
        text(
            """
            SELECT id
            FROM processes
            WHERE id = :process_id
              AND tenant_id = :tenant_id
            """
        ),
        {"process_id": payload.process_id, "tenant_id": tenant_id},
    ).scalar()

    if process_exists is None:
        raise HTTPException(status_code=404, detail="Process not found")

    source_type = (payload.source_type or "STANDARD").upper()
    standard_id, requirement_id, control_id = validate_source(
        db, tenant_id, source_type, payload.source_id
    )

    score = payload.likelihood * payload.impact
    risk_level = calculate_risk_level(score)

    try:
        result = db.execute(
            text(
                """
                INSERT INTO risks (
                    tenant_id, title, description, impact, likelihood, score,
                    risk_level, standard_id, requirement_id, control_id, status,
                    treatment, action, created_at, updated_at
                )
                VALUES (
                    :tenant_id, :title, :description, :impact, :likelihood, :score,
                    :risk_level, :standard_id, :requirement_id, :control_id, 'OPEN',
                    NULL, :action, NOW(), NOW()
                )
                RETURNING id
                """
            ),
            {
                "tenant_id": tenant_id,
                "title": payload.title,
                "description": payload.description,
                "impact": payload.impact,
                "likelihood": payload.likelihood,
                "score": score,
                "risk_level": risk_level,
                "standard_id": standard_id,
                "requirement_id": requirement_id,
                "control_id": control_id,
                "action": payload.action,
            },
        )
        new_risk_id = result.scalar_one()

        db.execute(
            text(
                """
                INSERT INTO process_risk_links (
                    tenant_id, process_id, risk_id, created_at
                )
                VALUES (:tenant_id, :process_id, :risk_id, NOW())
                ON CONFLICT (process_id, risk_id) DO NOTHING
                """
            ),
            {
                "tenant_id": tenant_id,
                "process_id": payload.process_id,
                "risk_id": new_risk_id,
            },
        )

        db.execute(
            text(
                """
                INSERT INTO risk_versions (
                    tenant_id, risk_id, version_number, impact, likelihood,
                    score, risk_level, status, treatment, action, created_at
                )
                VALUES (
                    :tenant_id, :risk_id, 1, :impact, :likelihood,
                    :score, :risk_level, 'OPEN', NULL, :action, NOW()
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
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Risk creation failed") from exc

    return {
        "id": new_risk_id,
        "score": score,
        "risk_level": risk_level,
        "status": "OPEN",
        "process_id": payload.process_id,
    }


@router.put("/{risk_id}")
def update_risk(
    risk_id: int,
    payload: RiskUpdateIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_id = current_user.tenant_id

    current = db.execute(
        text(
            """
            SELECT *
            FROM risks
            WHERE id = :risk_id
              AND tenant_id = :tenant_id
            FOR UPDATE
            """
        ),
        {"risk_id": risk_id, "tenant_id": tenant_id},
    ).mappings().first()

    if current is None:
        raise HTTPException(status_code=404, detail="Risk not found")

    likelihood = payload.likelihood if payload.likelihood is not None else current["likelihood"]
    impact = payload.impact if payload.impact is not None else current["impact"]
    score = likelihood * impact
    risk_level = calculate_risk_level(score)

    title = payload.title if payload.title is not None else current["title"]
    description = (
        payload.description
        if payload.description is not None
        else current["description"]
    )
    treatment = payload.treatment if payload.treatment is not None else current["treatment"]
    status = payload.status if payload.status is not None else current["status"]
    action = payload.action if payload.action is not None else current["action"]

    standard_id = current["standard_id"]
    requirement_id = current["requirement_id"]
    control_id = current["control_id"]

    if payload.source_type is not None:
        standard_id, requirement_id, control_id = validate_source(
            db,
            tenant_id,
            payload.source_type,
            payload.source_id,
        )

    try:
        previous_version = db.execute(
            text(
                """
                SELECT COALESCE(MAX(version_number), 0)
                FROM risk_versions
                WHERE risk_id = :risk_id
                  AND tenant_id = :tenant_id
                """
            ),
            {"risk_id": risk_id, "tenant_id": tenant_id},
        ).scalar_one()

        new_version = int(previous_version) + 1

        db.execute(
            text(
                """
                UPDATE risks
                SET
                    title = :title,
                    description = :description,
                    likelihood = :likelihood,
                    impact = :impact,
                    score = :score,
                    risk_level = :risk_level,
                    standard_id = :standard_id,
                    requirement_id = :requirement_id,
                    control_id = :control_id,
                    status = :status,
                    treatment = :treatment,
                    action = :action,
                    prev_impact = impact,
                    prev_likelihood = likelihood,
                    previous_score = score,
                    prev_risk_level = risk_level,
                    updated_at = NOW()
                WHERE id = :risk_id
                  AND tenant_id = :tenant_id
                """
            ),
            {
                "risk_id": risk_id,
                "tenant_id": tenant_id,
                "title": title,
                "description": description,
                "likelihood": likelihood,
                "impact": impact,
                "score": score,
                "risk_level": risk_level,
                "standard_id": standard_id,
                "requirement_id": requirement_id,
                "control_id": control_id,
                "status": status,
                "treatment": treatment,
                "action": action,
            },
        )

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
                    :version_number,
                    :impact,
                    :likelihood,
                    :score,
                    :risk_level,
                    :status,
                    :treatment,
                    :action,
                    NOW()
                )
                """
            ),
            {
                "tenant_id": tenant_id,
                "risk_id": risk_id,
                "version_number": new_version,
                "impact": impact,
                "likelihood": likelihood,
                "score": score,
                "risk_level": risk_level,
                "status": status,
                "treatment": treatment,
                "action": action,
            },
        )

        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Risk update failed") from exc

    return {
        "id": risk_id,
        "version": new_version,
        "title": title,
        "score": score,
        "risk_level": risk_level,
        "status": status,
    }
