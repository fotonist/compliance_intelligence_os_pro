from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.intelligence_model_config import IntelligenceModelConfig
from app.services.control_health_engine import ControlHealthWeights


def get_active_control_health_weights(
    *,
    db: Session,
    tenant_id: int,
) -> ControlHealthWeights:
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
        return ControlHealthWeights().normalized()

    return ControlHealthWeights(
        coverage=float(
            config.control_health_coverage_weight
        ),
        evidence=float(
            config.control_health_evidence_weight
        ),
        risk=float(
            config.control_health_risk_weight
        ),
        gap=float(
            config.control_health_gap_weight
        ),
        remediation=float(
            config.control_health_remediation_weight
        ),
    ).normalized()
