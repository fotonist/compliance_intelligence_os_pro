from typing import Dict, Any

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.models.compliance_tasks import ComplianceTask
from app.models.risks import Risk
from app.models.user import User


class CoverageEngine:

    @staticmethod
    def get_process_coverage(
        process_id: int,
        db: Session,
        user: User,
    ) -> Dict[str, Any]:

        tenant_id = user.tenant_id

        # --------------------------------------------------
        # PROCESS -> COMPLIANCE TASK -> CONTROL
        # --------------------------------------------------
        control_rows = (
            db.query(ComplianceTask.control_id)
            .filter(
                ComplianceTask.tenant_id == tenant_id,
                ComplianceTask.process_id == process_id,
                ComplianceTask.control_id.isnot(None),
            )
            .distinct()
            .all()
        )

        control_ids = {
            int(row.control_id)
            for row in control_rows
            if row.control_id is not None
        }

        # --------------------------------------------------
        # NO CONTROLS
        # --------------------------------------------------
        if not control_ids:
            return {
                "summary": {
                    "controls_total": 0,
                    "covered_controls": 0,
                }
            }

        # --------------------------------------------------
        # CANONICAL CONTROL COVERAGE
        #
        # The analytics view is the authoritative source for
        # evidence coverage. Restrict it to this tenant and
        # to the controls actually assigned to this process.
        # --------------------------------------------------
        coverage_rows = db.execute(
            text(
                """
                SELECT
                    control_id,
                    coverage_status
                FROM analytics.v_control_coverage_uee
                WHERE tenant_id = :tenant_id
                  AND control_id = ANY(
                      CAST(:control_ids AS integer[])
                  )
                """
            ),
            {
                "tenant_id": tenant_id,
                "control_ids": list(control_ids),
            },
        ).mappings().all()

        coverage_by_control = {
            int(row["control_id"]): str(
                row["coverage_status"] or ""
            ).lower()
            for row in coverage_rows
        }

        total = len(control_ids)

        covered = sum(
            1
            for control_id in control_ids
            if coverage_by_control.get(control_id) == "covered"
        )

        return {
            "summary": {
                "controls_total": total,
                "covered_controls": covered,
            }
        }

    @staticmethod
    def get_process_gaps(
        process_id: int,
        db: Session,
        user: User,
    ):
        # --------------------------------------------------
        # PROCESS-SCOPED RISKS
        # --------------------------------------------------
        risks = db.execute(
            text(
                """
                SELECT
                    r.risk_score
                FROM risks r
                INNER JOIN process_risk_links prl
                    ON prl.risk_id = r.id
                WHERE prl.process_id = :process_id
                  AND prl.tenant_id = :tenant_id
                  AND r.tenant_id = :tenant_id
                """
            ),
            {
                "process_id": process_id,
                "tenant_id": user.tenant_id,
            },
        ).mappings().all()

        worst = 0

        for risk in risks:
            score = risk["risk_score"]

            if score is not None and score > worst:
                worst = score

        class DummySummary:
            worst_max_risk_score = worst

        class DummyResponse:
            summary = DummySummary()

        return DummyResponse()
