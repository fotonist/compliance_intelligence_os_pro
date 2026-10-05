from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.process_risk_link_service import ProcessRiskLinkService
from app.services.risk_scoring_service import RiskScoringService


@dataclass(frozen=True)
class RiskCreationResult:
    risk_id: int
    risk_version_id: int
    score: int
    risk_level: str
    status: str
    process_id: Optional[int]


class RiskCreationService:
    @staticmethod
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

        normalized = source_type.upper()

        if normalized not in {"STANDARD", "REQUIREMENT", "CONTROL"}:
            raise HTTPException(
                status_code=400,
                detail="source_type must be STANDARD, REQUIREMENT, or CONTROL",
            )

        if normalized == "STANDARD":
            exists = db.execute(
                text(
                    """
                    SELECT s.id
                    FROM standards s
                    WHERE s.id = :source_id
                    """
                ),
                {"source_id": source_id},
            ).scalar()

            if exists is None:
                raise HTTPException(
                    status_code=404,
                    detail="Standard not found",
                )

            standard_id = source_id

        elif normalized == "REQUIREMENT":
            row = db.execute(
                text(
                    """
                    SELECT
                        r.id,
                        sv.standard_id
                    FROM requirements r
                    JOIN clauses c
                      ON c.id = r.clause_id
                    JOIN standard_versions sv
                      ON sv.id = c.standard_version_id
                    WHERE r.id = :source_id
                    """
                ),
                {"source_id": source_id},
            ).mappings().first()

            if row is None:
                raise HTTPException(
                    status_code=404,
                    detail="Requirement not found",
                )

            requirement_id = int(row["id"])
            standard_id = int(row["standard_id"])

        else:
            row = db.execute(
                text(
                    """
                    SELECT
                        c.id,
                        sv.standard_id,
                        c.requirement_id
                    FROM controls c
                    JOIN standard_versions sv
                      ON sv.id = c.standard_version_id
                    WHERE c.id = :source_id
                    """
                ),
                {"source_id": source_id},
            ).mappings().first()

            if row is None:
                raise HTTPException(
                    status_code=404,
                    detail="Control not found",
                )

            control_id = int(row["id"])
            standard_id = int(row["standard_id"])
            requirement_id = (
                int(row["requirement_id"])
                if row["requirement_id"] is not None
                else None
            )

        return standard_id, requirement_id, control_id

    @staticmethod
    def create(
        db: Session,
        *,
        tenant_id: int,
        title: str,
        description: Optional[str],
        likelihood: int,
        impact: int,
        action: Optional[str],
        source_type: str = "STANDARD",
        source_id: Optional[int] = None,
        process_id: Optional[int] = None,
        base_practice_id: Optional[int] = None,
    ) -> RiskCreationResult:
        if process_id is not None:
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
                    "process_id": process_id,
                    "tenant_id": tenant_id,
                },
            ).scalar()

            if process_exists is None:
                raise HTTPException(
                    status_code=404,
                    detail="Process not found",
                )

        normalized_source_type = (source_type or "STANDARD").upper()

        standard_id, requirement_id, control_id = (
            RiskCreationService.validate_source(
                db,
                tenant_id,
                normalized_source_type,
                source_id,
            )
        )

        if base_practice_id is not None:
            bp = db.execute(
                text(
                    """
                    SELECT
                        bp.id,
                        rp.standard_version_id,
                        sv.standard_id
                    FROM standard_base_practices bp
                    JOIN standard_reference_processes rp
                      ON rp.id = bp.process_id
                     AND rp.standard_version_id = bp.standard_version_id
                    JOIN standard_versions sv
                      ON sv.id = bp.standard_version_id
                    WHERE bp.id = :base_practice_id
                    """
                ),
                {"base_practice_id": base_practice_id},
            ).mappings().first()

            if bp is None:
                raise HTTPException(
                    status_code=404,
                    detail="Base Practice not found",
                )

            bp_standard_id = int(bp["standard_id"])

            if standard_id is not None and standard_id != bp_standard_id:
                raise HTTPException(
                    status_code=409,
                    detail="Risk source and Base Practice belong to different standards",
                )

            standard_id = bp_standard_id

        scoring = RiskScoringService.calculate(
            likelihood=likelihood,
            impact=impact,
        )

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
                "title": title,
                "description": description,
                "impact": impact,
                "likelihood": likelihood,
                "score": scoring.score,
                "risk_level": scoring.risk_level,
                "standard_id": standard_id,
                "requirement_id": requirement_id,
                "control_id": control_id,
                "action": action,
            },
        )

        risk_id = int(result.scalar_one())

        if process_id is not None:
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
                    "process_id": process_id,
                    "risk_id": risk_id,
                },
            )

            ProcessRiskLinkService.refresh_risk_appetite(
                db=db,
                tenant_id=tenant_id,
                risk_id=risk_id,
            )

        risk_version_id = int(
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
                    RETURNING id
                    """
                ),
                {
                    "tenant_id": tenant_id,
                    "risk_id": risk_id,
                    "impact": impact,
                    "likelihood": likelihood,
                    "score": scoring.score,
                    "risk_level": scoring.risk_level,
                    "action": action,
                },
            ).scalar_one()
        )

        if base_practice_id is not None:
            db.execute(
                text(
                    """
                    INSERT INTO pam_base_practice_risk_links (
                        tenant_id,
                        base_practice_id,
                        risk_version_id,
                        created_at
                    )
                    VALUES (
                        :tenant_id,
                        :base_practice_id,
                        :risk_version_id,
                        NOW()
                    )
                    ON CONFLICT (
                        base_practice_id,
                        risk_version_id
                    ) DO NOTHING
                    """
                ),
                {
                    "tenant_id": tenant_id,
                    "base_practice_id": base_practice_id,
                    "risk_version_id": risk_version_id,
                },
            )

        return RiskCreationResult(
            risk_id=risk_id,
            risk_version_id=risk_version_id,
            score=scoring.score,
            risk_level=scoring.risk_level,
            status="OPEN",
            process_id=process_id,
        )
