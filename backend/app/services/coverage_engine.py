# backend/app/services/coverage_engine.py

from typing import Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from app.models.process import Process
from app.models.controls import Control
from app.models.process_risk_link import ProcessRiskLink
from app.models.risks import Risk
from app.models.user import User


class CoverageEngine:

    @staticmethod
    def get_process_coverage(process_id: int, db: Session, user: User) -> Dict[str, Any]:

        controls = db.execute(select(Control)).scalars().all()

        total = len(controls)
        covered = len([c for c in controls if c.coverage_status == "covered"])

        return {
            "summary": {
                "controls_total": total,
                "covered_controls": covered,
            }
        }

    @staticmethod
    def get_process_gaps(process_id: int, db: Session, user: User):

        risks = db.execute(
            select(Risk).where(Risk.tenant_id == user.tenant_id)
        ).scalars().all()

        worst = 0
        for r in risks:
            if r.risk_score and r.risk_score > worst:
                worst = r.risk_score

        class DummySummary:
            worst_max_risk_score = worst

        class DummyResponse:
            summary = DummySummary()

        return DummyResponse()