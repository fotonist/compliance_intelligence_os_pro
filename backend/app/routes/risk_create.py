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


@router.post("/", status_code=201)
def create_risk(
    payload: RiskCreateIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_id = current_user.tenant_id

    # Process is a separate tenant-scoped entity. Risks are linked to
    # processes through process_risk_links; process_id is NOT a column on risks.
    process_exists = db.execute(
        text(
            """
            SELECT id
            FROM processes
            WHERE id = :process_id
              AND tenant_id = :tenant_id
            """
        ),
        {
            "process_id": payload.process_id,
            "tenant_id": tenant_id,
        },
    ).scalar()

    if process_exists is None:
        raise HTTPException(status_code=404, detail="Process not found")

    score = payload.likelihood * payload.impact
    risk_level = calculate_risk_level(score)

    # Source references map to the actual FK columns on risks.
    standard_id = None
    requirement_id = None
    control_id = None

    source_type = (payload.source_type or "STANDARD").upper()
    if payload.source_id is not None:
        if source_type == "STANDARD":
            standard_id = payload.source_id
        elif source_type == "REQUIREMENT":
            requirement_id = payload.source_id
        elif source_type == "CONTROL":
            control_id = payload.source_id
        else:
            raise HTTPException(
                status_code=400,
                detail="source_type must be STANDARD, REQUIREMENT, or CONTROL",
            )

    try:
        # 1. Create the canonical risk row. Do NOT write process_id/source_type/
        # source_id because the current risks schema models these relationships
        # through FK columns and process_risk_links.
        result = db.execute(
            text(
                """
                INSERT INTO risks (
                    tenant_id,
                    title,
                    description,
                    impact,
                    likelihood,
                    score,
                    risk_level,
                    standard_id,
                    requirement_id,
                    control_id,
                    status,
                    treatment,
                    action,
                    created_at,
                    updated_at
                )
                VALUES (
                    :tenant_id,
                    :title,
                    :description,
                    :impact,
                    :likelihood,
                    :score,
                    :risk_level,
                    :standard_id,
                    :requirement_id,
                    :control_id,
                    'OPEN',
                    NULL,
                    :action,
                    NOW(),
                    NOW()
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

        # 2. Create the process relationship in the canonical link table.
        db.execute(
            text(
                """
                INSERT INTO process_risk_links (
                    tenant_id,
                    process_id,
                    risk_id,
                    created_at
                )
                VALUES (
                    :tenant_id,
                    :process_id,
                    :risk_id,
                    NOW()
                )
                ON CONFLICT (process_id, risk_id) DO NOTHING
                """
            ),
            {
                "tenant_id": tenant_id,
                "process_id": payload.process_id,
                "risk_id": new_risk_id,
            },
        )

        # 3. Create immutable RiskVersion v1.
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

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Risk creation failed: {str(exc)}",
        ) from exc

    return {
        "id": new_risk_id,
        "score": score,
        "risk_level": risk_level,
        "status": "OPEN",
        "process_id": payload.process_id,
    }
