from typing import List, Dict, Any

from app.services.ai_client import generate_ai_insight

from app.schemas.compliance_workspace_schema import (
    AnalyticsDto,
    CoverageDto,
    RiskSummaryDto,
    TaskSummaryDto,
)


class ComplianceIntelligenceService:
    """
    Compliance Intelligence Engine

    Generates executive-level AI observations
    from compliance signals.
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

        result = await generate_ai_insight(
            kpis=context,
            period_days=30,
        )

        summary = result.get(
            "summary",
            [],
        )

        if summary:
            return summary


        return self._generate_fallback_observations(
            context
        )



    def _generate_fallback_observations(
        self,
        context: Dict[str, Any],
    ) -> List[str]:

        observations = []

        coverage = context["compliance"]

        risk = context["risk"]

        tasks = context["tasks"]


        if coverage["coverage_percentage"] < 80:
            observations.append(
                "Evidence coverage requires improvement."
            )


        if risk["critical"] > 0:
            observations.append(
                f"{risk['critical']} critical risk(s) require immediate attention."
            )


        if tasks["overdue"] > 0:
            observations.append(
                f"{tasks['overdue']} overdue compliance task(s) detected."
            )


        if not observations:
            observations.append(
                "Compliance posture is currently stable based on available indicators."
            )


        return observations



    async def generate_executive_summary(
        self,
        context: Dict[str, Any],
    ) -> str:

        result = await generate_ai_insight(
            kpis=context,
            period_days=30,
        )


        summary = result.get(
            "executive_summary"
        )


        if summary:
            return summary


        return (
            "The compliance posture requires attention "
            "due to identified risk exposure, evidence "
            "coverage gaps and remediation activities."
        )