from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.process_risk_appetite import ProcessRiskAppetite
from app.models.risk_appetite_profile import RiskAppetiteProfile


SYSTEM_DEFAULT_THRESHOLD = 16

STATUS_WITHIN_APPETITE = "WITHIN_APPETITE"
STATUS_EXCEEDS_APPETITE = "EXCEEDS_APPETITE"


@dataclass(frozen=True)
class RiskAppetiteResolution:
    tenant_id: int
    risk_id: int
    threshold: int
    process_ids: tuple[int, ...]
    governing_process_ids: tuple[int, ...]
    source: str


class RiskAppetiteEngine:

    @staticmethod
    def get_threshold(
        db: Session,
        tenant_id: int,
        process_id: int | None = None,
    ) -> int:
        if process_id is not None:
            override = (
                db.query(ProcessRiskAppetite)
                .filter(
                    ProcessRiskAppetite.tenant_id == tenant_id,
                    ProcessRiskAppetite.process_id == process_id,
                )
                .first()
            )

            if (
                override is not None
                and override.threshold_override is not None
            ):
                return int(override.threshold_override)

        profile = (
            db.query(RiskAppetiteProfile)
            .filter(
                RiskAppetiteProfile.tenant_id == tenant_id,
                RiskAppetiteProfile.is_default.is_(True),
            )
            .first()
        )

        if profile is not None:
            return int(profile.default_threshold)

        return SYSTEM_DEFAULT_THRESHOLD

    @classmethod
    def resolve_for_risk(
        cls,
        db: Session,
        tenant_id: int,
        risk_id: int,
    ) -> RiskAppetiteResolution:
        process_rows = db.execute(
            text("""
                SELECT DISTINCT process_id
                FROM process_risk_links
                WHERE tenant_id = :tenant_id
                  AND risk_id = :risk_id
                ORDER BY process_id
            """),
            {
                "tenant_id": tenant_id,
                "risk_id": risk_id,
            },
        ).all()

        process_ids = tuple(
            int(row[0])
            for row in process_rows
        )

        if not process_ids:
            threshold = cls.get_threshold(
                db=db,
                tenant_id=tenant_id,
            )

            return RiskAppetiteResolution(
                tenant_id=tenant_id,
                risk_id=risk_id,
                threshold=threshold,
                process_ids=(),
                governing_process_ids=(),
                source="TENANT_DEFAULT",
            )

        thresholds = {
            process_id: cls.get_threshold(
                db=db,
                tenant_id=tenant_id,
                process_id=process_id,
            )
            for process_id in process_ids
        }

        effective_threshold = min(thresholds.values())

        governing_process_ids = tuple(
            process_id
            for process_id, threshold in thresholds.items()
            if threshold == effective_threshold
        )

        has_override = (
            db.query(ProcessRiskAppetite.id)
            .filter(
                ProcessRiskAppetite.tenant_id == tenant_id,
                ProcessRiskAppetite.process_id.in_(governing_process_ids),
                ProcessRiskAppetite.threshold_override.isnot(None),
            )
            .first()
            is not None
        )

        return RiskAppetiteResolution(
            tenant_id=tenant_id,
            risk_id=risk_id,
            threshold=effective_threshold,
            process_ids=process_ids,
            governing_process_ids=governing_process_ids,
            source=(
                "PROCESS_OVERRIDE"
                if has_override
                else "TENANT_DEFAULT"
            ),
        )

    @staticmethod
    def evaluate(
        score: int,
        threshold: int,
    ) -> dict[str, int | str | bool]:
        score_value = int(score)
        threshold_value = int(threshold)

        if score_value < 0:
            raise ValueError("score must be zero or greater")

        if threshold_value < 1:
            raise ValueError("threshold must be greater than zero")

        deviation = score_value - threshold_value
        exceeded = deviation > 0

        return {
            "score": score_value,
            "threshold": threshold_value,
            "deviation": deviation,
            "exceeded": exceeded,
            "status": (
                STATUS_EXCEEDS_APPETITE
                if exceeded
                else STATUS_WITHIN_APPETITE
            ),
        }

    @classmethod
    def evaluate_risk(
        cls,
        db: Session,
        tenant_id: int,
        risk_id: int,
        score: int,
    ) -> dict:
        resolution = cls.resolve_for_risk(
            db=db,
            tenant_id=tenant_id,
            risk_id=risk_id,
        )

        evaluation = cls.evaluate(
            score=score,
            threshold=resolution.threshold,
        )

        return {
            **evaluation,
            "tenant_id": resolution.tenant_id,
            "risk_id": resolution.risk_id,
            "process_ids": list(resolution.process_ids),
            "governing_process_ids": list(
                resolution.governing_process_ids
            ),
            "source": resolution.source,
        }
