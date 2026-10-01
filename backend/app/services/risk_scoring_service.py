from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RiskScoreResult:
    likelihood: int
    impact: int
    score: int
    risk_level: str


class RiskScoringService:
    MIN_FACTOR = 1
    MAX_FACTOR = 5

    @classmethod
    def calculate(
        cls,
        likelihood: int,
        impact: int,
    ) -> RiskScoreResult:
        likelihood_value = int(likelihood)
        impact_value = int(impact)

        if not cls.MIN_FACTOR <= likelihood_value <= cls.MAX_FACTOR:
            raise ValueError("likelihood must be between 1 and 5")

        if not cls.MIN_FACTOR <= impact_value <= cls.MAX_FACTOR:
            raise ValueError("impact must be between 1 and 5")

        score = likelihood_value * impact_value

        return RiskScoreResult(
            likelihood=likelihood_value,
            impact=impact_value,
            score=score,
            risk_level=cls.resolve_level(score),
        )

    @staticmethod
    def resolve_level(score: int) -> str:
        score_value = int(score)

        if score_value >= 20:
            return "CRITICAL"
        if score_value >= 15:
            return "HIGH"
        if score_value >= 10:
            return "MEDIUM"
        if score_value >= 5:
            return "LOW"
        return "VERY_LOW"
