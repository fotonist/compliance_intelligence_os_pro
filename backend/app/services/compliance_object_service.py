from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.controls import Control
from app.models.requirements import Requirement
from app.models.clauses import Clause

from app.services.compliance_workspace_mapper import ComplianceWorkspaceMapper
from app.services.compliance_intelligence_service import ComplianceIntelligenceService


class ComplianceObjectService:
    def __init__(self, db: Session):
        self.db = db
        self.intelligence_service = ComplianceIntelligenceService()

    async def get_workspace(self, control_id: int):
        # Keep the scalar hierarchy joined, but load collection relationships
        # independently. This avoids a large cartesian join across evidences,
        # risks and tasks and is safer for production data volumes.
        control = (
            self.db.query(Control)
            .options(
                joinedload(Control.requirement)
                .joinedload(Requirement.clause)
                .joinedload(Clause.standard),
                selectinload(Control.evidences),
                selectinload(Control.risks),
                selectinload(Control.tasks),
            )
            .filter(Control.id == control_id)
            .first()
        )

        if control is None:
            return None

        coverage = ComplianceWorkspaceMapper.map_coverage(control)
        risk_summary = ComplianceWorkspaceMapper.map_risk_summary(control)
        task_summary = ComplianceWorkspaceMapper.map_task_summary(control)
        analytics = ComplianceWorkspaceMapper.map_analytics(control)

        # AI is an enhancement, not a prerequisite for the Workspace itself.
        # If an external AI provider is unavailable, the deterministic workspace
        # data must still load normally.
        try:
            ai_summary = await self.intelligence_service.generate_workspace_observations(
                coverage=coverage,
                risk_summary=risk_summary,
                task_summary=task_summary,
                analytics=analytics,
            )
        except Exception as exc:
            print("Compliance Workspace AI observations failed:", str(exc))
            ai_summary = []

        try:
            ai_executive_summary = await self.intelligence_service.generate_executive_summary(
                {
                    "coverage": coverage.model_dump(),
                    "risk_summary": risk_summary.model_dump(),
                    "task_summary": task_summary.model_dump(),
                    "analytics": analytics.model_dump(),
                }
            )
        except Exception as exc:
            print("Compliance Workspace AI executive summary failed:", str(exc))
            ai_executive_summary = None

        return ComplianceWorkspaceMapper.map_workspace(
            control,
            ai_summary=ai_summary,
            ai_executive_summary=ai_executive_summary,
        )
