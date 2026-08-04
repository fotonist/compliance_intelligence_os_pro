 
from sqlalchemy.orm import Session

from app.models.process_risk_appetite import ProcessRiskAppetite
from app.models.risk_appetite_profile import RiskAppetiteProfile

SYSTEM_DEFAULT_THRESHOLD = 16


class RiskAppetiteEngine:

    @staticmethod
    def get_threshold(
        db: Session,
        tenant_id: int,
        process_id: int | None = None,
    ) -> int:

        if process_id:
            override = (
                db.query(ProcessRiskAppetite)
                .filter(
                    ProcessRiskAppetite.tenant_id == tenant_id,
                    ProcessRiskAppetite.process_id == process_id,
                )
                .first()
            )

            if (
                override
                and override.threshold_override is not None
            ):
                return int(override.threshold_override)

            if override and override.profile:
                return int(
                    override.profile.default_threshold
                )

        profile = (
            db.query(RiskAppetiteProfile)
            .filter(
                RiskAppetiteProfile.tenant_id == tenant_id,
                RiskAppetiteProfile.is_default.is_(True),
            )
            .first()
        )

        if profile:
            return int(profile.default_threshold)

        return SYSTEM_DEFAULT_THRESHOLD