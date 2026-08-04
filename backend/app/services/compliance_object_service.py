from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload

from app.models.controls import Control
from app.models.requirements import Requirement
from app.models.clauses import Clause

from app.services.compliance_workspace_mapper import (
    ComplianceWorkspaceMapper,
)

from app.services.compliance_intelligence_service import (
    ComplianceIntelligenceService,
)


class ComplianceObjectService:

    def __init__(self, db: Session):

        self.db = db

        self.intelligence_service = (
            ComplianceIntelligenceService()
        )


    async def get_workspace(
        self,
        control_id: int,
    ):

        control = (
            self.db.query(Control)
            .options(
                joinedload(Control.requirement)
                .joinedload(Requirement.clause)
                .joinedload(Clause.standard),

                joinedload(Control.evidences),

                joinedload(Control.risks),

                joinedload(Control.tasks),
            )
            .filter(
                Control.id == control_id
            )
            .first()
        )


        if control is None:
            return None


        coverage = (
            ComplianceWorkspaceMapper
            .map_coverage(control)
        )

        risk_summary = (
            ComplianceWorkspaceMapper
            .map_risk_summary(control)
        )

        task_summary = (
            ComplianceWorkspaceMapper
            .map_task_summary(control)
        )

        analytics = (
            ComplianceWorkspaceMapper
            .map_analytics(control)
        )


        ai_summary = await (
            self.intelligence_service
            .generate_workspace_observations(
                coverage=coverage,
                risk_summary=risk_summary,
                task_summary=task_summary,
                analytics=analytics,
            )
            
        )

        ai_executive_summary = await (
           self.intelligence_service
            .generate_executive_summary(
            ai_summary
    )
)
        return ComplianceWorkspaceMapper.map_workspace(
            control,
            ai_summary=ai_summary,
            ai_executive_summary=ai_executive_summary,
        )