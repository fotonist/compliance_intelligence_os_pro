from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models.risks import Risk
from app.models.controls import Control
from app.models.evidences import Evidence
from app.models.compliance_tasks import ComplianceTask
from app.services.exposure_engine import ExposureEngine


class ExecutiveSummaryService:
    """Executive Intelligence aggregation layer.

    Uses the production Evidence model contract: evidence approval is derived
    from EvidenceFile.status rather than a non-existent Evidence.approval_status
    column.
    """

    def __init__(self, db: Session, tenant_id: int):
        self.db = db
        self.tenant_id = tenant_id

    # =====================================================
    # MAIN ENTRY
    # =====================================================

    def build(self) -> dict[str, Any]:
        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "executive": self.executive_metrics(),
            "controls": self.control_metrics(),
            "risks": self.risk_metrics(),
            "evidence": self.evidence_metrics(),
            "tasks": self.task_metrics(),
        }

    # =====================================================
    # EXECUTIVE METRICS
    # =====================================================

    def executive_metrics(self) -> dict[str, Any]:
        compliance_score = self.calculate_compliance_score()
        evidence_score = self.calculate_evidence_score()
        risk_score = self.calculate_risk_health()

        readiness = (
            compliance_score * 0.40
            + evidence_score * 0.30
            + risk_score * 0.30
        )

        return {
            "readiness_score": round(readiness, 2),
            "compliance_score": compliance_score,
            "evidence_score": evidence_score,
            "risk_health_score": risk_score,
            "status": self.status_from_score(readiness),
        }

    @staticmethod
    def status_from_score(score: float) -> str:
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

    def control_metrics(self) -> dict[str, Any]:
        controls = (
            self.db.query(Control)
            .filter(Control.tenant_id == self.tenant_id)
            .all()
        )

        total = len(controls)
        covered = 0

        for control in controls:
            evidences = getattr(control, "evidences", None) or []
            active_evidences = [
                evidence
                for evidence in evidences
                if not getattr(evidence, "is_deleted", False)
            ]
            if active_evidences:
                covered += 1

        uncovered = total - covered
        coverage = (covered / total * 100) if total else 0.0

        return {
            "total": total,
            "covered": covered,
            "uncovered": uncovered,
            "coverage_percent": round(coverage, 2),
        }

    def calculate_compliance_score(self) -> float:
        return float(self.control_metrics()["coverage_percent"])

    # =====================================================
    # RISK METRICS
    # =====================================================

    def risk_metrics(self) -> dict[str, Any]:
        engine = ExposureEngine(self.db)
        exposure_rows = engine.compute_risk_exposure(
            tenant_id=self.tenant_id,
            limit=1000000,
        )

        total = len(exposure_rows)
        critical = 0
        high = 0
        medium = 0
        low = 0
        total_score = 0.0

        for item in exposure_rows:
            total_score += float(item.inherent_score or 0)
            level = str(item.risk_level or "").upper()

            if level == "CRITICAL":
                critical += 1
            elif level == "HIGH":
                high += 1
            elif level == "MEDIUM":
                medium += 1
            elif level == "LOW":
                low += 1

        average_score = total_score / total if total else 0.0
        unified_exposure = sum(
            float(getattr(item, "unified_score", 0) or 0)
            for item in exposure_rows
        )

        top_risks = [
            {
                "id": item.risk_id,
                "title": item.title,
                "score": item.inherent_score,
                "level": item.risk_level,
                "unified_score": item.unified_score,
            }
            for item in exposure_rows[:5]
        ]

        return {
            "total": total,
            "critical": critical,
            "high": high,
            "medium": medium,
            "low": low,
            "average_score": round(average_score, 2),
            "unified_exposure": round(unified_exposure, 2),
            "distribution": {
                "critical": critical,
                "high": high,
                "medium": medium,
                "low": low,
            },
            "top_risks": top_risks,
        }

    def calculate_risk_health(self) -> float:
        average_score = self.risk_metrics()["average_score"]
        health = max(0.0, 100.0 - (float(average_score) * 2.0))
        return round(health, 2)

    def top_risks(self, limit: int = 5) -> list[dict[str, Any]]:
        risks = (
            self.db.query(Risk)
            .filter(Risk.tenant_id == self.tenant_id)
            .order_by(Risk.score.desc())
            .limit(limit)
            .all()
        )

        return [
            {
                "id": risk.id,
                "title": risk.title,
                "score": risk.score,
                "level": risk.risk_level,
                "status": risk.status,
            }
            for risk in risks
        ]

    # =====================================================
    # EVIDENCE METRICS
    # =====================================================

    def _evidence_approval_state(self, evidence: Evidence) -> str:
        """Derive approval state from the current EvidenceFile records."""
        files = getattr(evidence, "files", None) or []
        active_files = [
            item
            for item in files
            if not getattr(item, "is_deleted", False)
        ]

        if not active_files:
            return "PENDING"

        statuses = {
            str(getattr(item, "status", "") or "").lower()
            for item in active_files
        }

        if "rejected" in statuses:
            return "REJECTED"

        if active_files and all(status == "approved" for status in statuses):
            return "APPROVED"

        return "PENDING"

    def evidence_metrics(self) -> dict[str, Any]:
        evidences = (
            self.db.query(Evidence)
            .filter(
                Evidence.tenant_id == self.tenant_id,
                Evidence.is_deleted.is_(False),
            )
            .all()
        )

        total = len(evidences)
        approved = 0
        pending = 0
        rejected = 0

        for evidence in evidences:
            state = self._evidence_approval_state(evidence)
            if state == "APPROVED":
                approved += 1
            elif state == "REJECTED":
                rejected += 1
            else:
                pending += 1

        strength = approved / total * 100 if total else 0.0

        return {
            "total": total,
            "approved": approved,
            "pending": pending,
            "rejected": rejected,
            "strength_percent": round(strength, 2),
            "weak_evidences": self.weak_evidences(),
        }

    def calculate_evidence_score(self) -> float:
        return float(self.evidence_metrics()["strength_percent"])

    def weak_evidences(self, limit: int = 10) -> list[dict[str, Any]]:
        evidences = (
            self.db.query(Evidence)
            .filter(
                Evidence.tenant_id == self.tenant_id,
                Evidence.is_deleted.is_(False),
            )
            .all()
        )

        result = []
        for evidence in evidences:
            state = self._evidence_approval_state(evidence)
            if state == "APPROVED":
                continue

            result.append(
                {
                    "id": evidence.id,
                    "title": evidence.title,
                    "status": evidence.status,
                    "approval_status": state,
                    "control_id": evidence.control_id,
                    "requirement_id": evidence.requirement_id,
                }
            )

            if len(result) >= limit:
                break

        return result

    # =====================================================
    # TASK METRICS
    # =====================================================

    def task_metrics(self) -> dict[str, Any]:
        tasks = (
            self.db.query(ComplianceTask)
            .filter(ComplianceTask.tenant_id == self.tenant_id)
            .all()
        )

        total = len(tasks)
        open_tasks = 0
        overdue_tasks = 0
        critical_tasks = 0
        high_tasks = 0
        now = datetime.now(timezone.utc)

        for task in tasks:
            status = str(getattr(task, "status", "") or "").lower()
            if status not in {"closed", "completed", "done"}:
                open_tasks += 1

            priority = int(getattr(task, "priority_score", 0) or 0)
            if priority >= 80:
                critical_tasks += 1
            elif priority >= 50:
                high_tasks += 1

            due_date = getattr(task, "due_date", None)
            if due_date:
                try:
                    due = (
                        due_date.replace(tzinfo=timezone.utc)
                        if due_date.tzinfo is None
                        else due_date
                    )
                    if due < now and status not in {"closed", "completed", "done"}:
                        overdue_tasks += 1
                except (TypeError, ValueError):
                    pass

        return {
            "total": total,
            "open": open_tasks,
            "overdue": overdue_tasks,
            "critical": critical_tasks,
            "high": high_tasks,
            "priority_tasks": self.priority_tasks(),
        }

    def priority_tasks(self, limit: int = 10) -> list[dict[str, Any]]:
        tasks = (
            self.db.query(ComplianceTask)
            .filter(ComplianceTask.tenant_id == self.tenant_id)
            .order_by(ComplianceTask.priority_score.desc())
            .limit(limit)
            .all()
        )

        return [
            {
                "id": task.id,
                "title": task.title,
                "priority_score": task.priority_score,
                "owner_role": task.owner_role,
                "status": task.status,
                "due_date": task.due_date,
            }
            for task in tasks
        ]

    # =====================================================
    # EXECUTIVE ALERTS
    # =====================================================

    def alerts(self) -> list[dict[str, Any]]:
        alerts: list[dict[str, Any]] = []

        risks = self.risk_metrics()
        if risks["critical"]:
            alerts.append(
                {
                    "type": "CRITICAL_RISK",
                    "count": risks["critical"],
                    "severity": "CRITICAL",
                }
            )

        tasks = self.task_metrics()
        if tasks["overdue"]:
            alerts.append(
                {
                    "type": "OVERDUE_TASK",
                    "count": tasks["overdue"],
                    "severity": "HIGH",
                }
            )

        evidence = self.evidence_metrics()
        if evidence["rejected"]:
            alerts.append(
                {
                    "type": "REJECTED_EVIDENCE",
                    "count": evidence["rejected"],
                    "severity": "MEDIUM",
                }
            )

        return alerts

    # =====================================================
    # LANDING PAGE CONTRACT
    # =====================================================

    def landing_page_payload(self) -> dict[str, Any]:
        executive = self.executive_metrics()

        return {
            "hero": {
                "title": "Compliance Intelligence OS",
                "readiness_score": executive["readiness_score"],
                "status": executive["status"],
            },
            "cards": [
                {
                    "key": "compliance",
                    "label": "Compliance Health",
                    "value": executive["compliance_score"],
                },
                {
                    "key": "evidence",
                    "label": "Evidence Strength",
                    "value": executive["evidence_score"],
                },
                {
                    "key": "risk",
                    "label": "Risk Health",
                    "value": executive["risk_health_score"],
                },
            ],
            "risk": self.risk_metrics(),
            "controls": self.control_metrics(),
            "evidence": self.evidence_metrics(),
            "tasks": self.task_metrics(),
            "alerts": self.alerts(),
        }

    # =====================================================
    # EXECUTIVE API RESPONSE
    # =====================================================

    def api_response(self) -> dict[str, Any]:
        return {
            "success": True,
            "data": self.build(),
            "landing": self.landing_page_payload(),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }


# =========================================================
# FACTORY
# =========================================================


def build_executive_summary(db: Session, tenant_id: int) -> dict[str, Any]:
    service = ExecutiveSummaryService(db=db, tenant_id=tenant_id)
    return service.api_response()


__all__ = [
    "ExecutiveSummaryService",
    "build_executive_summary",
]
