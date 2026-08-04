# backend/app/services/audit_plan_engine.py

from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from datetime import date, timedelta

from app.models.process import Process
from app.models.process_risk_link import ProcessRiskLink
from app.models.risks import Risk
from app.models.controls import Control
from app.models.requirements import Requirement
from app.models.clauses import Clause
from app.models.standards import Standard
from app.models.user import User

from app.schemas.audit_plan_schema import AuditPlanResponse, AuditActionItem


class AuditPlanEngine:

    @staticmethod
    def generate(process_id: int, db: Session, user: User) -> AuditPlanResponse:
        """
        Generates action plan based on uncovered / partial controls.
        Clean service layer implementation.
        """

        process = db.execute(
            select(Process).where(
                and_(
                    Process.id == process_id,
                    Process.tenant_id == user.tenant_id
                )
            )
        ).scalar_one_or_none()

        if not process:
            raise ValueError("Process not found")

        controls = db.execute(
            select(Control)
        ).scalars().all()

        actions: List[AuditActionItem] = []

        for control in controls:

            # Simplified gap logic (refine later)
            if control.coverage_status in (None, "uncovered", "partial"):

                actions.append(
                    AuditActionItem(
                        control_id=control.id,
                        control_code=control.code,
                        standard_code=control.standard.code if control.standard else "",
                        clause_code=control.clause.code if control.clause else "",
                        requirement_code=control.requirement.code if control.requirement else "",
                        priority_score=50,
                        suggested_owner_role="process_owner",
                        suggested_due_date=date.today() + timedelta(days=30),
                    )
                )

        return AuditPlanResponse(
            process_id=process_id,
            actions=actions,
        )