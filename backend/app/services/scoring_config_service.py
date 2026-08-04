from sqlalchemy.orm import Session
from app.models.scoring_config import RiskScoringConfig
from app.data.scoring_data import scoring_data


def get_active_scoring_config(db: Session):
    cfg = (
        db.query(RiskScoringConfig)
        .filter(RiskScoringConfig.active.is_(True))
        .order_by(RiskScoringConfig.effective_from.desc())
        .first()
    )
    if cfg:
        return {
            "source": "db",
            "thresholds": cfg.thresholds  # DB’de JSON alanı varsayımı
        }

    # Fallback v2
    return {
        "source": "static",
        "thresholds": scoring_data["thresholds"]
    }


def resolve_risk_level(score: int, thresholds: dict) -> str:
    for level, rng in thresholds.items():
        if rng["min"] <= score <= rng["max"]:
            return level
    return "LOW"
