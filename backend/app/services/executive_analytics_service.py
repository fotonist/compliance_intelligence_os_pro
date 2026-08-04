from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session
from app.services.exposure_engine import ExposureEngine

# ==========================================================
# OPTIONAL MODEL IMPORTS
# ==========================================================

try:
    from app.models.risks import Risk
except Exception:
    Risk = None

try:
    from app.models.controls import Control
except Exception:
    Control = None

try:
    from app.models.evidences import Evidence
except Exception:
    Evidence = None

try:
    from app.models.compliance_tasks import ComplianceTask
except Exception:
    ComplianceTask = None


# ==========================================================
# DATA MODELS
# ==========================================================

@dataclass
class ExecutiveMetric:

    name: str

    score: float

    status: str

    trend: str

    description: str


@dataclass
class ExecutiveAnalyticsResult:

    generated_at: datetime

    compliance_health: float

    risk_exposure: float

    evidence_quality: float

    coverage_score: float

    task_pressure: float

    audit_readiness: float

    maturity_score: float

    metrics: list[ExecutiveMetric]

    recommendations: list[dict[str, Any]]

    trend_analysis: dict[str, Any]


# ==========================================================
# SERVICE
# ==========================================================

class ExecutiveAnalyticsService:

def __init__(
    self,
    db: Session,
    tenant_id: int,
):
    self.db = db
    self.tenant_id = tenant_id

    # ======================================================
    # PUBLIC
    # ======================================================

    def build(self) -> ExecutiveAnalyticsResult:

        compliance = self.compliance_health()

        risk = self.risk_exposure()

        evidence = self.evidence_quality()

        coverage = self.coverage_score()

        tasks = self.task_pressure()

        maturity = self.maturity_score()

        readiness = self.audit_readiness(
            compliance,
            risk,
            evidence,
            coverage,
            tasks,
            maturity,
        )

        return ExecutiveAnalyticsResult(

            generated_at=datetime.utcnow(),

            compliance_health=compliance,

            risk_exposure=risk,

            evidence_quality=evidence,

            coverage_score=coverage,

            task_pressure=tasks,

            audit_readiness=readiness,

            maturity_score=maturity,

            metrics=self.metric_cards(
                compliance,
                risk,
                evidence,
                coverage,
                tasks,
                maturity,
                readiness,
            ),

            recommendations=self.recommendations(),

            trend_analysis=self.trend_analysis(),
        )

    # ======================================================
    # COMPLIANCE HEALTH
    # ======================================================

    def compliance_health(self) -> float:

        coverage = self.coverage_score()

        evidence = self.evidence_quality()

        risk = self.risk_exposure()

        score = (
            coverage * 0.40 +
            evidence * 0.30 +
            (100 - risk) * 0.30
        )

        return round(
            max(0.0, min(score, 100.0)),
            2,
        )

    # ======================================================
    # RISK EXPOSURE
    # ======================================================

    def risk_exposure(self) -> float:

        if Risk is None:
            return 0.0

        try:

engine = ExposureEngine(
    self.db
)

rows = engine.compute_risk_exposure(
    tenant_id=1,
    limit=1000000,
)

if not rows:
    return 0.0


total = sum(
    r.residual_exposure
    for r in rows
)

count = len(rows)

            if count == 0:
                return 0.0

            return round(
                total / count,
                2,
            )

        except Exception:

            return 0.0

    # ======================================================
    # EVIDENCE QUALITY
    # ======================================================

    def evidence_quality(self) -> float:

        if Evidence is None:
            return 0.0

        try:

            evidences = self.db.query(Evidence).all()

            if not evidences:
                return 0.0

            approved = 0

            for evidence in evidences:

                status = str(
                    getattr(
                        evidence,
                        "status",
                        "",
                    )
                ).upper()

                if status in (
                    "APPROVED",
                    "VALID",
                    "UPLOADED",
                ):
                    approved += 1

            return round(
                approved * 100 / len(evidences),
                2,
            )

        except Exception:

            return 0.0
                # ======================================================
    # COVERAGE SCORE
    # ======================================================

    def coverage_score(self) -> float:

        if Control is None:
            return 0.0

        try:

            controls = self.db.query(Control).all()

            if not controls:
                return 0.0

            implemented = 0

            for control in controls:

                status = str(
                    getattr(
                        control,
                        "implementation_status",
                        "",
                    )
                ).upper()

                if status in (
                    "IMPLEMENTED",
                    "ACTIVE",
                    "COMPLETED",
                    "DONE",
                ):
                    implemented += 1

            return round(
                implemented * 100 / len(controls),
                2,
            )

        except Exception:

            return 0.0

    # ======================================================
    # TASK PRESSURE
    # ======================================================

    def task_pressure(self) -> float:

        if ComplianceTask is None:
            return 0.0

        try:

            tasks = self.db.query(ComplianceTask).all()

            if not tasks:
                return 0.0

            pressure = 0.0

            for task in tasks:

                priority = str(
                    getattr(
                        task,
                        "priority",
                        "",
                    )
                ).upper()

                status = str(
                    getattr(
                        task,
                        "status",
                        "",
                    )
                ).upper()

                if status in (
                    "DONE",
                    "COMPLETED",
                    "CLOSED",
                ):
                    continue

                if priority == "CRITICAL":
                    pressure += 10

                elif priority == "HIGH":
                    pressure += 7

                elif priority == "MEDIUM":
                    pressure += 4

                else:
                    pressure += 2

            pressure = min(
                pressure,
                100,
            )

            return round(
                pressure,
                2,
            )

        except Exception:

            return 0.0

    # ======================================================
    # MATURITY SCORE
    # ======================================================

    def maturity_score(self) -> float:

        if Control is None:
            return 0.0

        try:

            controls = self.db.query(Control).all()

            total = 0.0

            count = 0

            for control in controls:

                score = getattr(
                    control,
                    "maturity_score",
                    None,
                )

                if score is None:
                    continue

                total += float(score)

                count += 1

            if count == 0:
                return 0.0

            return round(
                total / count,
                2,
            )

        except Exception:

            return 0.0

    # ======================================================
    # AUDIT READINESS
    # ======================================================

    def audit_readiness(
        self,
        compliance: float,
        risk: float,
        evidence: float,
        coverage: float,
        tasks: float,
        maturity: float,
    ) -> float:

        readiness = (

            compliance * 0.30 +

            coverage * 0.20 +

            evidence * 0.20 +

            maturity * 0.20 +

            (100 - tasks) * 0.10
        )

        readiness -= risk * 0.10

        readiness = max(
            0.0,
            min(
                readiness,
                100.0,
            ),
        )

        return round(
            readiness,
            2,
        )

    # ======================================================
    # KPI CARDS
    # ======================================================

    def metric_cards(
        self,
        compliance: float,
        risk: float,
        evidence: float,
        coverage: float,
        tasks: float,
        maturity: float,
        readiness: float,
    ) -> list[ExecutiveMetric]:

        return [

            ExecutiveMetric(
                name="Compliance Health",
                score=compliance,
                status=self._status(compliance),
                trend="stable",
                description="Overall compliance posture.",
            ),

            ExecutiveMetric(
                name="Risk Exposure",
                score=risk,
                status=self._inverse_status(risk),
                trend="stable",
                description="Average enterprise risk exposure.",
            ),

            ExecutiveMetric(
                name="Evidence Quality",
                score=evidence,
                status=self._status(evidence),
                trend="stable",
                description="Quality and approval rate of evidences.",
            ),

            ExecutiveMetric(
                name="Coverage",
                score=coverage,
                status=self._status(coverage),
                trend="stable",
                description="Implemented control coverage.",
            ),

            ExecutiveMetric(
                name="Task Pressure",
                score=tasks,
                status=self._inverse_status(tasks),
                trend="stable",
                description="Pressure created by open actions.",
            ),

            ExecutiveMetric(
                name="Maturity",
                score=maturity,
                status=self._status(maturity),
                trend="stable",
                description="Average maturity level.",
            ),

            ExecutiveMetric(
                name="Audit Readiness",
                score=readiness,
                status=self._status(readiness),
                trend="stable",
                description="Estimated audit readiness.",
            ),
        ]

    # ======================================================
    # STATUS HELPERS
    # ======================================================

    def _status(
        self,
        value: float,
    ) -> str:

        if value >= 90:
            return "EXCELLENT"

        if value >= 75:
            return "GOOD"

        if value >= 50:
            return "WARNING"

        return "CRITICAL"

    def _inverse_status(
        self,
        value: float,
    ) -> str:

        if value <= 20:
            return "EXCELLENT"

        if value <= 40:
            return "GOOD"

        if value <= 70:
            return "WARNING"

        return "CRITICAL"
            # ======================================================
    # RECOMMENDATION ENGINE
    # ======================================================

    def recommendations(self) -> list[dict[str, Any]]:

        recommendations: list[dict[str, Any]] = []

        # --------------------------------------------------
        # Pending Evidences
        # --------------------------------------------------

        if Evidence is not None:

            try:

                pending = (
                    self.db.query(Evidence)
                    .filter(
                        func.lower(Evidence.status).in_(
                            [
                                "pending",
                                "waiting_approval",
                                "uploaded",
                            ]
                        )
                    )
                    .count()
                )

                if pending > 0:

                    recommendations.append(
                        {
                            "priority": 1,
                            "category": "Evidence",
                            "title": "Approve pending evidences",
                            "description": (
                                f"{pending} evidences are waiting for approval."
                            ),
                            "impact": "HIGH",
                        }
                    )

            except Exception:
                pass

        # --------------------------------------------------
        # Critical Risks
        # --------------------------------------------------

        if Risk is not None:

            try:

                critical = (
                    self.db.query(Risk)
                    .filter(
                        func.lower(Risk.risk_level) == "critical"
                    )
                    .count()
                )

                if critical > 0:

                    recommendations.append(
                        {
                            "priority": 2,
                            "category": "Risk",
                            "title": "Mitigate critical risks",
                            "description": (
                                f"{critical} critical risks require mitigation."
                            ),
                            "impact": "CRITICAL",
                        }
                    )

            except Exception:
                pass

        # --------------------------------------------------
        # Open Critical Tasks
        # --------------------------------------------------

        if ComplianceTask is not None:

            try:

                tasks = (
                    self.db.query(ComplianceTask)
                    .filter(
                        func.lower(
                            ComplianceTask.priority
                        ) == "critical"
                    )
                    .count()
                )

                if tasks > 0:

                    recommendations.append(
                        {
                            "priority": 3,
                            "category": "Tasks",
                            "title": "Complete critical tasks",
                            "description": (
                                f"{tasks} critical tasks remain open."
                            ),
                            "impact": "HIGH",
                        }
                    )

            except Exception:
                pass

        recommendations.sort(
            key=lambda x: x["priority"]
        )

        return recommendations

    # ======================================================
    # TREND ANALYSIS
    # ======================================================

    def trend_analysis(self) -> dict[str, Any]:

        #
        # Placeholder
        #
        # İleride analytics views
        # üzerinden gerçek trend hesaplanacak.
        #

        return {

            "risk_trend": "stable",

            "coverage_trend": "up",

            "evidence_trend": "up",

            "task_trend": "down",

            "maturity_trend": "stable",
        }

    # ======================================================
    # EXPORT
    # ======================================================

    def to_dict(self) -> dict[str, Any]:

        result = self.build()

        return {

            "generated_at": result.generated_at.isoformat(),

            "compliance_health": result.compliance_health,

            "risk_exposure": result.risk_exposure,

            "evidence_quality": result.evidence_quality,

            "coverage_score": result.coverage_score,

            "task_pressure": result.task_pressure,

            "audit_readiness": result.audit_readiness,

            "maturity_score": result.maturity_score,

            "metrics": [
                asdict(metric)
                for metric in result.metrics
            ],

            "recommendations": result.recommendations,

            "trend_analysis": result.trend_analysis,
        }


# ==========================================================
# FACTORY
# ==========================================================

def build_executive_analytics(
    db: Session,
) -> dict[str, Any]:

    """
    Factory method

    Example
    -------
    analytics = build_executive_analytics(db)
    """

    service = ExecutiveAnalyticsService(db)

    return service.to_dict()