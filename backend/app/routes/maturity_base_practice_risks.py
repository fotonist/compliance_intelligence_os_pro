from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.services.risk_creation_service import RiskCreationService


router = APIRouter(
    prefix="/maturity/base-practices",
    tags=["Maturity Base Practice Risks"],
)


class BasePracticeRiskCreateIn(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = None
    likelihood: int = Field(ge=1, le=5)
    impact: int = Field(ge=1, le=5)
    action: Optional[str] = "assessment"


def _get_active_base_practice_context(
    db: Session,
    *,
    tenant_id: int,
    base_practice_id: int,
):
    row = db.execute(
        text(
            """
            SELECT
                bp.id AS base_practice_id,
                bp.code AS base_practice_code,
                bp.title AS base_practice_title,

                rp.id AS reference_process_id,
                rp.code AS reference_process_code,
                rp.name AS reference_process_name,

                sv.id AS standard_version_id,
                sv.version_code,

                s.id AS standard_id,
                s.code AS standard_code,
                s.title AS standard_title,
                s.type AS framework_type,

                fa.id AS adoption_id,
                fa.status AS adoption_status,
                fa.applicability

            FROM standard_base_practices bp

            JOIN standard_reference_processes rp
              ON rp.id = bp.process_id
                     AND rp.standard_version_id = bp.standard_version_id

            JOIN standard_versions sv
              ON sv.id = bp.standard_version_id

            JOIN standards s
              ON s.id = sv.standard_id

            JOIN framework_adoptions fa
              ON fa.standard_id = s.id
             AND fa.standard_version_id = sv.id
             AND fa.tenant_id = :tenant_id

            WHERE bp.id = :base_practice_id
              AND UPPER(COALESCE(s.type, '')) = 'MATURITY_BASED'
              AND UPPER(COALESCE(fa.status, '')) = 'ACTIVE'
              AND UPPER(COALESCE(fa.applicability, '')) = 'APPLICABLE'

            ORDER BY fa.id DESC
            LIMIT 1
            """
        ),
        {
            "tenant_id": tenant_id,
            "base_practice_id": base_practice_id,
        },
    ).mappings().first()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Base Practice is not available in an active "
                "applicable maturity framework"
            ),
        )

    return row


@router.post(
    "/{base_practice_id}/risks",
    status_code=201,
)
def create_base_practice_risk(
    base_practice_id: int,
    payload: BasePracticeRiskCreateIn,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tenant_id = current_user.tenant_id

    context = _get_active_base_practice_context(
        db,
        tenant_id=tenant_id,
        base_practice_id=base_practice_id,
    )

    try:
        result = RiskCreationService.create(
            db,
            tenant_id=tenant_id,
            title=payload.title,
            description=payload.description,
            likelihood=payload.likelihood,
            impact=payload.impact,
            action=payload.action,
            source_type="STANDARD",
            source_id=int(context["standard_id"]),
            process_id=None,
            base_practice_id=base_practice_id,
        )

        db.commit()

    except HTTPException:
        db.rollback()
        raise

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Base Practice risk creation failed",
        ) from exc

    return {
        "id": result.risk_id,
        "risk_version_id": result.risk_version_id,
        "score": result.score,
        "risk_level": result.risk_level,
        "status": result.status,
        "framework": {
            "standard_id": int(context["standard_id"]),
            "standard_code": context["standard_code"],
            "standard_version_id": int(
                context["standard_version_id"]
            ),
            "standard_version_code": context["version_code"],
            "adoption_id": int(context["adoption_id"]),
            "framework_type": context["framework_type"],
        },
        "target": {
            "type": "BASE_PRACTICE",
            "base_practice_id": int(
                context["base_practice_id"]
            ),
            "base_practice_code": context[
                "base_practice_code"
            ],
            "base_practice_title": context[
                "base_practice_title"
            ],
            "reference_process_id": int(
                context["reference_process_id"]
            ),
            "reference_process_code": context[
                "reference_process_code"
            ],
            "reference_process_name": context[
                "reference_process_name"
            ],
        },
    }
