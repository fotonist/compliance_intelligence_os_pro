from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.intelligence_model_config import IntelligenceModelConfig
from app.services.uee_engine import UEEWeights


def get_active_uee_weights(
    *,
    db: Session,
    tenant_id: int,
) -> UEEWeights:
    config = db.execute(
        select(IntelligenceModelConfig)
        .where(
            IntelligenceModelConfig.tenant_id == tenant_id,
            IntelligenceModelConfig.model_name == "UEE",
            IntelligenceModelConfig.active.is_(True),
            IntelligenceModelConfig.status == "ACTIVE",
        )
        .order_by(
            IntelligenceModelConfig.version.desc()
        )
        .limit(1)
    ).scalar_one_or_none()

    if config is None:
        return UEEWeights()

    return UEEWeights(
        risk=float(config.risk_weight),
        coverage=float(config.coverage_weight),
        maturity=float(config.maturity_weight),
        evidence=float(config.evidence_weight),
        task_pressure=float(config.task_pressure_weight),
    ).normalized()
