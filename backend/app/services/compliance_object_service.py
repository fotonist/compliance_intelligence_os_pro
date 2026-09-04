from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.controls import Control
from app.models.requirements import Requirement
from app.models.clauses import Clause

from app.services.compliance_workspace_mapper import ComplianceWorkspaceMapper


class ComplianceObjectService:
    def __init__(self, db: Session):
        self.db = db

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

        # Workspace data is deterministic and comes exclusively from the
        # persisted compliance model / database relationships.
        #
        # External AI is intentionally NOT called here.
        # AI Insight is an explicit user-initiated operation handled by
        # POST /ai/dashboard/insights.

        return ComplianceWorkspaceMapper.map_workspace(
            control,
        )
