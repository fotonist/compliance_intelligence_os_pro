from typing import Dict, Any

from app.schemas.compliance_workspace_schema import (
    AnalyticsDto,
    CoverageDto,
    RiskSummaryDto,
    TaskSummaryDto,
)


class ComplianceIntelligenceService:
    """
    Deterministic compliance intelligence context builder.

    This service does not call an external AI provider and does not
    generate fallback or synthetic observations.

    External AI interpretation is explicitly requested through the
    dedicated AI endpoint.
    """

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
