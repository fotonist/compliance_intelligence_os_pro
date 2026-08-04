from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.risks import Risk
from app.models.controls import Control
from app.models.evidences import Evidence
from app.models.compliance_tasks import ComplianceTask
from app.services.exposure_engine import ExposureEngine

class ExecutiveSummaryService:
    """
    Compliance Intelligence OS Pro

    Executive Intelligence aggregation layer.

    Data sources:
    - Controls
    - Risks
    - Evidences
    - Compliance Tasks

    Used by:
    - Executive Dashboard
    - Landing Page
    - Management Summary APIs
    """

    def __init__(
    self,
    db: Session,
    tenant_id: int,
):
    self.db = db
    self.tenant_id = tenant_id


    # =====================================================
    # MAIN ENTRY
    # =====================================================

    def build(
        self,
    ) -> dict[str, Any]:

        return {

            "generated_at":
                datetime.utcnow().isoformat(),

            "executive":
                self.executive_metrics(),

            "controls":
                self.control_metrics(),

            "risks":
                self.risk_metrics(),

            "evidence":
                self.evidence_metrics(),

            "tasks":
                self.task_metrics(),

        }


    # =====================================================
    # EXECUTIVE METRICS
    # =====================================================

    def executive_metrics(
        self,
    ) -> dict[str, Any]:

        compliance_score = (
            self.calculate_compliance_score()
        )

        evidence_score = (
            self.calculate_evidence_score()
        )

        risk_score = (
            self.calculate_risk_health()
        )


        readiness = (
            (
                compliance_score * 0.40
            )
            +
            (
                evidence_score * 0.30
            )
            +
            (
                risk_score * 0.30
            )
        )


        return {

            "readiness_score":
                round(
                    readiness,
                    2,
                ),

            "compliance_score":
                compliance_score,

            "evidence_score":
                evidence_score,

            "risk_health_score":
                risk_score,

            "status":
                self.status_from_score(
                    readiness
                ),

        }


    def status_from_score(
        self,
        score: float,
    ) -> str:

        if score >= 85:
            return "READY"

        if score >= 70:
            return "IMPROVING"

        if score >= 50:
            return "AT_RISK"

        return "CRITICAL"


    # =====================================================
    # CONTROL METRICS
    # =====================================================

    def control_metrics(
        self,
    ) -> dict[str, Any]:

        controls = (
            self.db
            .query(Control)
            .filter(
        Control.tenant_id == self.tenant_id
    )
            .all()
        )


        total = len(
            controls
        )

        covered = 0

        uncovered = 0


        for control in controls:

            evidences = getattr(
                control,
                "evidences",
                [],
            )


            if evidences:

                covered += 1

            else:

                uncovered += 1



        coverage = 0


        if total:

            coverage = (
                covered
                /
                total
                *
                100
            )


        return {

            "total":
                total,

            "covered":
                covered,

            "uncovered":
                uncovered,

            "coverage_percent":
                round(
                    coverage,
                    2,
                ),

        }


    def calculate_compliance_score(
        self,
    ) -> float:

        metrics = (
            self.control_metrics()
        )

        return metrics[
            "coverage_percent"
        ]
           
   # =====================================================
    # RISK METRICS
    # =====================================================

   def risk_metrics(
    self,
) -> dict[str, Any]:

    engine = ExposureEngine(
        self.db
    )

    exposure_rows = (
        engine.compute_risk_exposure(
            tenant_id=self.tenant_id,
            limit=1000000,
        )
    )


    total = len(
        exposure_rows
    )

    critical = 0
    high = 0
    medium = 0
    low = 0


    total_score = 0


    for item in exposure_rows:

        total_score += (
            item.inherent_score
        )


        level = str(
            item.risk_level or ""
        ).upper()


        if level == "CRITICAL":

            critical += 1

        elif level == "HIGH":

            high += 1

        elif level == "MEDIUM":

            medium += 1

        elif level == "LOW":

            low += 1



    average_score = 0


    if total:

        average_score = (
            total_score
            /
            total
        )



    return {

        "total":

            total,


        "critical":

            critical,


        "high":

            high,


        "medium":

            medium,


        "low":

            low,


        "average_score":

            round(
                average_score,
                2,
            ),


        "unified_exposure":

            sum(
                x.unified_score
                for x in exposure_rows
            ),


        "top_risks":

            [
                {

                    "id":

                        x.risk_id,


                    "title":

                        x.title,


                    "score":

                        x.inherent_score,


                    "level":

                        x.risk_level,


                    "unified_score":

                        x.unified_score,


                }

                for x in exposure_rows[:5]

            ],

    }



    def calculate_risk_health(
        self,
    ) -> float:

        metrics = (
            self.risk_metrics()
        )


        score = (
            metrics[
                "average_score"
            ]
        )


        health = (
            100
            -
            (
                score * 2
            )
        )


        if health < 0:

            health = 0


        return round(
            health,
            2,
        )



    def top_risks(
        self,
        limit: int = 5,
    ) -> list[dict[str, Any]]:

        risks = (

            self.db
            .query(Risk)
            .order_by(
                Risk.score.desc()
            )
            .limit(limit)
            .all()

        )


        result = []


        for risk in risks:

            result.append(
                {

                    "id":
                        risk.id,

                    "title":
                        risk.title,

                    "score":
                        risk.score,

                    "level":
                        risk.risk_level,

                    "status":
                        risk.status,

                }
            )


        return result



    # =====================================================
    # EVIDENCE METRICS
    # =====================================================

    def evidence_metrics(
        self,
    ) -> dict[str, Any]:

        evidences = (

            self.db
            .query(Evidence)
             .filter(
        Evidence.tenant_id == self.tenant_id,
        Evidence.is_deleted == False
    )
            .all()

        )


        total = len(
            evidences
        )


        approved = 0

        pending = 0

        rejected = 0



        for evidence in evidences:


            approval = str(
                getattr(
                    evidence,
                    "approval_status",
                    "",
                )
            ).upper()



            if approval == "APPROVED":

                approved += 1


            elif approval == "REJECTED":

                rejected += 1


            else:

                pending += 1



        strength = 0


        if total:

            strength = (

                approved

                /

                total

                *

                100

            )


        return {

            "total":
                total,

            "approved":
                approved,

            "pending":
                pending,

            "rejected":
                rejected,

            "strength_percent":
                round(
                    strength,
                    2,
                ),

            "weak_evidences":
                self.weak_evidences(),

        }



    def calculate_evidence_score(
        self,
    ) -> float:

        return (

            self.evidence_metrics()
            [
                "strength_percent"
            ]

        )
            def weak_evidences(
        self,
        limit: int = 10,
    ) -> list[dict[str, Any]]:

        evidences = (

            self.db
            .query(Evidence)
            .filter(
                Evidence.is_deleted == False
            )
            .all()

        )


        result = []


        for evidence in evidences:

            approval = str(
                getattr(
                    evidence,
                    "approval_status",
                    "",
                )
            ).upper()



            if approval == "APPROVED":

                continue



            result.append(
                {

                    "id":
                        evidence.id,

                    "title":
                        evidence.title,

                    "status":
                        evidence.status,

                    "approval_status":
                        evidence.approval_status,

                    "control_id":
                        evidence.control_id,

                    "requirement_id":
                        evidence.requirement_id,

                }
            )



        return result[:limit]



    # =====================================================
    # TASK METRICS
    # =====================================================

    def task_metrics(
        self,
    ) -> dict[str, Any]:

        tasks = (

            self.db
            .query(ComplianceTask)
            .filter(
                ComplianceTask.tenant_id == self.tenant_id
    )
            .all()

        )


        total = len(
            tasks
        )

        open_tasks = 0

        overdue_tasks = 0

        critical_tasks = 0

        high_tasks = 0



        now = datetime.utcnow()



        for task in tasks:


            status = str(
                getattr(
                    task,
                    "status",
                    "",
                )
            ).lower()



            if status not in (

                "closed",

                "completed",

                "done",

            ):

                open_tasks += 1



            priority = getattr(
                task,
                "priority_score",
                0,
            )



            if priority >= 80:

                critical_tasks += 1


            elif priority >= 50:

                high_tasks += 1



            due_date = getattr(
                task,
                "due_date",
                None,
            )



            if due_date:

                try:

                    if due_date < now:

                        overdue_tasks += 1


                except Exception:

                    pass



        return {

            "total":
                total,

            "open":
                open_tasks,

            "overdue":
                overdue_tasks,

            "critical":
                critical_tasks,

            "high":
                high_tasks,

            "priority_tasks":
                self.priority_tasks(),

        }



    def priority_tasks(
        self,
        limit: int = 10,
    ) -> list[dict[str, Any]]:

        tasks = (

            self.db
            .query(ComplianceTask)
            .order_by(
                ComplianceTask.priority_score.desc()
            )
            .limit(limit)
            .all()

        )


        result = []


        for task in tasks:

            result.append(
                {

                    "id":
                        task.id,

                    "title":
                        task.title,

                    "priority_score":
                        task.priority_score,

                    "owner_role":
                        task.owner_role,

                    "status":
                        task.status,

                    "due_date":
                        task.due_date,

                }
            )


        return result



    # =====================================================
    # EXECUTIVE ALERTS
    # =====================================================

    def alerts(
        self,
    ) -> list[dict[str, Any]]:

        alerts = []



        risks = (
            self.risk_metrics()
        )


        if risks["distribution"]["critical"]:

            alerts.append(
                {

                    "type":
                        "CRITICAL_RISK",

                    "count":
                        risks["distribution"]["critical"],

                    "severity":
                        "CRITICAL",

                }
            )



        tasks = (
            self.task_metrics()
        )


        if tasks["overdue"]:

            alerts.append(
                {

                    "type":
                        "OVERDUE_TASK",

                    "count":
                        tasks["overdue"],

                    "severity":
                        "HIGH",

                }
            )



        evidence = (
            self.evidence_metrics()
        )


        if evidence["rejected"]:

            alerts.append(
                {

                    "type":
                        "REJECTED_EVIDENCE",

                    "count":
                        evidence["rejected"],

                    "severity":
                        "MEDIUM",

                }
            )



        return alerts
            # =====================================================
    # LANDING PAGE CONTRACT
    # =====================================================

    def landing_page_payload(
        self,
    ) -> dict[str, Any]:

        executive = (
            self.executive_metrics()
        )


        return {

            "hero":
            {

                "title":
                    "Compliance Intelligence OS",

                "readiness_score":
                    executive[
                        "readiness_score"
                    ],

                "status":
                    executive[
                        "status"
                    ],

            },


            "cards":
            [

                {

                    "key":
                        "compliance",

                    "label":
                        "Compliance Health",

                    "value":
                        executive[
                            "compliance_score"
                        ],

                },

                {

                    "key":
                        "evidence",

                    "label":
                        "Evidence Strength",

                    "value":
                        executive[
                            "evidence_score"
                        ],

                },

                {

                    "key":
                        "risk",

                    "label":
                        "Risk Health",

                    "value":
                        executive[
                            "risk_health_score"
                        ],

                },

            ],


            "risk":
                self.risk_metrics(),


            "controls":
                self.control_metrics(),


            "evidence":
                self.evidence_metrics(),


            "tasks":
                self.task_metrics(),


            "alerts":
                self.alerts(),

        }



    # =====================================================
    # EXECUTIVE API RESPONSE
    # =====================================================

    def api_response(
        self,
    ) -> dict[str, Any]:

        return {

            "success":
                True,

            "data":
                self.build(),

            "landing":
                self.landing_page_payload(),

            "generated_at":
                datetime.utcnow()
                .isoformat(),

        }



# =========================================================
# FACTORY
# =========================================================

def build_executive_summary(
    db: Session,
    tenant_id: int,
) -> dict[str, Any]:

    service = ExecutiveSummaryService(
        db=db,
        tenant_id=tenant_id,
    )

    return service.api_response()
# =========================================================
# MODULE EXPORTS
# =========================================================

__all__ = [

    "ExecutiveSummaryService",

    "build_executive_summary",

]