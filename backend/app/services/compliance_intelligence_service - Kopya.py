from typing import List, Dict, Any
from app.ai_client import generate_ai_insight

from app.schemas.compliance_workspace_schema import (
    AnalyticsDto,
    CoverageDto,
    RiskSummaryDto,
    TaskSummaryDto,
)


class ComplianceIntelligenceService:
    """
    Compliance Intelligence Engine

    Responsible for generating executive-level
    AI observations from compliance signals.

    This layer does NOT belong to mapper.
    """

    async def generate_workspace_observations(
        self,
        coverage: CoverageDto,
        risk_summary: RiskSummaryDto,
        task_summary: TaskSummaryDto,
        analytics: AnalyticsDto,
    ) -> List[str]:

        context = self._build_context(
            coverage,
            risk_summary,
            task_summary,
            analytics,
        )

        return await self._generate_ai_observations(
        context
    )


    def _build_context(
        self,
        coverage: CoverageDto,
        risk_summary: RiskSummaryDto,
        task_summary: TaskSummaryDto,
        analytics: AnalyticsDto,
    ) -> Dict[str, Any]:

        return {
            "compliance": {
                "coverage_percentage": coverage.percentage,
                "coverage_status": coverage.status,
            },

            "risk": {
                "total": risk_summary.total,
                "critical": risk_summary.critical,
                "high": risk_summary.high,
                "medium": risk_summary.medium,
                "low": risk_summary.low,
                "total_score": risk_summary.total_score,
            },

            "tasks": {
                "total": task_summary.total,
                "open": task_summary.open,
                "completed": task_summary.completed,
                "overdue": task_summary.overdue,
            },

            "health": {
                "health_score": analytics.health_score,
                "risk_score": analytics.risk_score,
            },
        }


    async def _generate_ai_observations(
        self,
        context: Dict[str, Any],
    ) -> List[str]:

        """
        AI Provider integration point.

        Future:
        - OpenAI
        - Azure OpenAI
        - Local LLM
        - Enterprise AI Gateway
        """

        result = await generate_ai_insight(
        kpis=context,
        period_days=30,
    )

    return result.get(
    "summary",
    [],
    )