from datetime import datetime, timedelta
from math import exp
from statistics import mean, pstdev

from sqlalchemy.orm import Session
from sqlalchemy import select, delete

from app.models.risks import Risk
from app.models.risk_history import RiskHistory
from app.models.risk_forecasts import RiskForecast


WINDOW_DAYS = 90


def _clamp(v, min_v, max_v):
    return max(min_v, min(max_v, v))


def _normalize(value, scale=10.0):
    value = _clamp(value, -scale, scale)
    return value / scale


def _risk_level_rank(level: str | None) -> int:
    if not level:
        return 0
    s = level.lower()
    if s in ["critical", "extreme"]:
        return 4
    if s in ["high"]:
        return 3
    if s in ["medium"]:
        return 2
    if s in ["low"]:
        return 1
    return 0


def run_risk_history_forecast(db: Session, tenant_id: int):
    now = datetime.utcnow()
    window_start = now - timedelta(days=WINDOW_DAYS)

    risks = db.execute(
        select(Risk).where(Risk.tenant_id == tenant_id)
    ).scalars().all()

    # Önce mevcut forecast'ları temizle (isteğe bağlı)
    db.execute(
        delete(RiskForecast).where(RiskForecast.tenant_id == tenant_id)
    )

    for risk in risks:
        history = (
            db.execute(
                select(RiskHistory)
                .where(
                    RiskHistory.tenant_id == tenant_id,
                    RiskHistory.risk_id == risk.id,
                    RiskHistory.changed_at >= window_start,
                )
                .order_by(RiskHistory.changed_at.asc())
            )
            .scalars()
            .all()
        )

        if not history:
            continue

        scores = [h.score_new for h in history if h.score_new is not None]

        if len(scores) < 2:
            continue

        first_score = scores[0]
        last_score = scores[-1]

        days = (history[-1].changed_at - history[0].changed_at).days or 1

        score_trend = (last_score - first_score) / days
        avg_delta = mean(
            [(h.score_new or 0) - (h.score_old or 0) for h in history]
        )

        volatility = pstdev(scores) if len(scores) > 1 else 0.0

        level_upgrades = sum(
            1
            for h in history
            if _risk_level_rank(h.risk_level_new)
            > _risk_level_rank(h.risk_level_old)
        )

        days_since_last_change = (now - history[-1].changed_at).days

        # Logistic Model
        x = (
            0.45 * _normalize(score_trend)
            + 0.25 * _normalize(volatility)
            + 0.20 * _normalize(level_upgrades, scale=5)
            + 0.10 * _normalize(days_since_last_change, scale=30)
        )

        prob = 1 / (1 + exp(-x))

        expected_delta = score_trend * 30

        forecast = RiskForecast(
            tenant_id=tenant_id,
            risk_id=risk.id,
            model_version="risk_history_v1",
            escalation_probability_30d=prob,
            expected_score_delta=expected_delta,
            explanation={
                "score_trend": score_trend,
                "volatility": volatility,
                "level_upgrades": level_upgrades,
                "days_since_last_change": days_since_last_change,
            },
        )

        db.add(forecast)

    db.commit()