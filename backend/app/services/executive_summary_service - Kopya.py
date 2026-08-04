from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.risks import Risk
from app.models.controls import Control
from app.models.evidences import Evidence
from app.models.tasks import ComplianceTask

# ---- Models ----
#
# Bu importlar proje geliştikçe aktif hale gelecek.
# Model isimlerini mevcut mimariye göre güncellemeniz yeterlidir.
#
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


@dataclass
class ExecutiveSummaryResult:
    generated_at: datetime

    compliance_score: float
    risk_score: float
    maturity_score: float
    evidence_strength: float

    total_controls: int
    implemented_controls: int
    coverage_percent: float

    open_findings: int

    top_risks: list[dict]
    critical_tasks: list[dict]
    weak_evidences: list[dict]


class ExecutiveSummaryService:

    def __init__(self, db: Session):
        self.db = db

    # ---------------------------------------------------
    # PUBLIC
    # ---------------------------------------------------

    def build(self) -> ExecutiveSummaryResult:

        return ExecutiveSummaryResult(
            generated_at=datetime.utcnow(),

            compliance_score=self.calculate_compliance_score(),

            risk_score=self.calculate_risk_score(),

            maturity_score=self.calculate_maturity_score(),

            evidence_strength=self.calculate_evidence_strength(),

            total_controls=self.total_controls(),

            implemented_controls=self.implemented_controls(),

            coverage_percent=self.coverage_percentage(),

            open_findings=self.open_findings(),

            top_risks=self.top_risks(),

            critical_tasks=self.critical_tasks(),

            weak_evidences=self.weak_evidences(),
        )

    # ---------------------------------------------------
    # KPI
    # ---------------------------------------------------

    def calculate_compliance_score(self) -> float:

        total = self.total_controls()

        if total == 0:
            return 0.0

        implemented = self.implemented_controls()

        return round(
            (implemented / total) * 100,
            2,
        )

    def calculate_risk_score(self) -> float:

        if Risk is None:
            return 0.0

        try:

            value = (
                self.db.query(
                    func.avg(Risk.risk_score)
                ).scalar()
            )

            if value is None:
                return 0.0

            return round(float(value), 2)

        except Exception:
            return 0.0

    def calculate_maturity_score(self) -> float:

        if Control is None:
            return 0.0

        try:

            rows = self.db.query(Control).all()

            if not rows:
                return 0.0

            total = 0

            count = 0

            for item in rows:

                score = getattr(
                    item,
                    "maturity_score",
                    None,
                )

                if score is None:
                    continue

                total += float(score)

                count += 1

            if count == 0:
                return 0.0

            return round(total / count, 2)

        except Exception:
            return 0.0

    def calculate_evidence_strength(self) -> float:

        if Evidence is None:
            return 0.0

        try:

            evidences = self.db.query(Evidence).all()

            if not evidences:
                return 0.0

            approved = 0

            for ev in evidences:

                status = (
                    str(
                        getattr(
                            ev,
                            "status",
                            "",
                        )
                    )
                    .upper()
                )

                if status in (
                    "APPROVED",
                    "VALID",
                    "UPLOADED",
                ):
                    approved += 1

            return round(
                approved / len(evidences) * 100,
                2,
            )

        except Exception:
            return 0.0
                # ---------------------------------------------------
    # CONTROL METRICS
    # ---------------------------------------------------

    def total_controls(self) -> int:

        if Control is None:
            return 0

        try:
            return int(
                self.db.query(Control).count()
            )
        except Exception:
            return 0

    def implemented_controls(self) -> int:

        if Control is None:
            return 0

        try:

            implemented = 0

            for control in self.db.query(Control).all():

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

            return implemented

        except Exception:
            return 0

    def coverage_percentage(self) -> float:

        total = self.total_controls()

        if total == 0:
            return 0.0

        implemented = self.implemented_controls()

        return round(
            implemented / total * 100,
            2,
        )

    # ---------------------------------------------------
    # FINDINGS
    # ---------------------------------------------------

    def open_findings(self) -> int:

        if Risk is None:
            return 0

        try:

            total = 0

            for risk in self.db.query(Risk).all():

                status = str(
                    getattr(
                        risk,
                        "status",
                        "",
                    )
                ).upper()

                if status not in (
                    "CLOSED",
                    "ACCEPTED",
                    "MITIGATED",
                ):
                    total += 1

            return total

        except Exception:
            return 0

    # ---------------------------------------------------
    # TOP RISKS
    # ---------------------------------------------------

    def top_risks(self) -> list[dict]:

        if Risk is None:
            return []

        try:

            rows = (
                self.db.query(Risk)
                .order_by(
                    getattr(
                        Risk,
                        "risk_score",
                    ).desc()
                )
                .limit(10)
                .all()
            )

            result = []

            for item in rows:

                result.append(
                    {
                        "risk_id": getattr(
                            item,
                            "id",
                            None,
                        ),
                        "title": getattr(
                            item,
                            "title",
                            "",
                        ),
                        "score": getattr(
                            item,
                            "risk_score",
                            0,
                        ),
                        "level": getattr(
                            item,
                            "risk_level",
                            "",
                        ),
                    }
                )

            return result

        except Exception:
            return []

    # ---------------------------------------------------
    # TASKS
    # ---------------------------------------------------

    def critical_tasks(self) -> list[dict]:

        if ComplianceTask is None:
            return []

        try:

            rows = (
                self.db.query(
                    ComplianceTask
                )
                .all()
            )

            result = []

            for task in rows:

                priority = str(
                    getattr(
                        task,
                        "priority",
                        "",
                    )
                ).upper()

                if priority not in (
                    "CRITICAL",
                    "HIGH",
                ):
                    continue

                result.append(
                    {
                        "task_id": getattr(
                            task,
                            "id",
                            None,
                        ),
                        "title": getattr(
                            task,
                            "title",
                            "",
                        ),
                        "status": getattr(
                            task,
                            "status",
                            "",
                        ),
                        "priority": getattr(
                            task,
                            "priority",
                            "",
                        ),
                        "due_date": getattr(
                            task,
                            "due_date",
                            None,
                        ),
                    }
                )

            result.sort(
                key=lambda x: (
                    x["due_date"] is None,
                    x["due_date"],
                )
            )

            return result[:10]

        except Exception:
            return []

    # ---------------------------------------------------
    # EVIDENCE
    # ---------------------------------------------------

    def weak_evidences(self) -> list[dict]:

        if Evidence is None:
            return []

        try:

            result = []

            for evidence in self.db.query(Evidence).all():

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
                ):
                    continue

                result.append(
                    {
                        "evidence_id": getattr(
                            evidence,
                            "id",
                            None,
                        ),
                        "title": getattr(
                            evidence,
                            "title",
                            "",
                        ),
                        "status": getattr(
                            evidence,
                            "status",
                            "",
                        ),
                        "coverage": getattr(
                            evidence,
                            "coverage",
                            0,
                        ),
                    }
                )

            return result

        except Exception:
            return []
                # ---------------------------------------------------
    # DASHBOARD EXPORT
    # ---------------------------------------------------

    def as_dict(self) -> dict[str, Any]:
        """
        Executive Summary'yi sözlük olarak döndürür.
        API endpoint'leri ve dashboard widget'ları bunu kullanabilir.
        """

        summary = self.build()

        return {
            "generated_at": summary.generated_at.isoformat(),

            "kpi": {
                "compliance_score": summary.compliance_score,
                "risk_score": summary.risk_score,
                "maturity_score": summary.maturity_score,
                "evidence_strength": summary.evidence_strength,
            },

            "controls": {
                "total": summary.total_controls,
                "implemented": summary.implemented_controls,
                "coverage_percent": summary.coverage_percent,
            },

            "findings": {
                "open": summary.open_findings,
            },

            "top_risks": summary.top_risks,

            "critical_tasks": summary.critical_tasks,

            "weak_evidences": summary.weak_evidences,
        }


# -------------------------------------------------------
# FACTORY
# -------------------------------------------------------

def build_executive_summary(
    db: Session,
) -> dict[str, Any]:
    """
    API katmanının çağıracağı yardımcı fonksiyon.

    Example
    -------
    summary = build_executive_summary(db)
    """

    service = ExecutiveSummaryService(db)

    return service.as_dict()