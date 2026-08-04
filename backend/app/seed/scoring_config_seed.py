from sqlalchemy.orm import Session
from app.models.scoring_config import RiskScoringConfig


DEFAULT_CONFIG = {
    "name": "Default Risk Scoring",
    "version": 1,
    "likelihood_weights": {
        "Q_L_01": 3,
        "Q_L_02": 4,
        "Q_L_03": 3,
        "Q_L_04": 2,
        "Q_L_05": 2,
    },
    "impact_weights": {
        "Q_I_01": 4,
        "Q_I_02": 4,
        "Q_I_03": 3,
        "Q_I_04": 3,
        "Q_I_05": 5,
    },
    "risk_matrix": {
        "Critical": {"l": 4, "i": 4},
        "High": {"l": 4, "i": 3},
        "Medium": {"l": 3, "i": 3},
        "Low": {"l": 1, "i": 1},
    },
}


def seed_default_scoring_config(db: Session):
    exists = (
        db.query(RiskScoringConfig)
        .filter(RiskScoringConfig.active.is_(True))
        .first()
    )
    if exists:
        return

    db.add(RiskScoringConfig(**DEFAULT_CONFIG))
    db.commit()
