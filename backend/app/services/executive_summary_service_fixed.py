from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.risks import Risk
from app.models.evidences import Evidence
from app.models.compliance_tasks import ComplianceTask
from app.services.exposure_engine import ExposureEngine


class ExecutiveSummaryService:
    """Production-safe Executive Intelligence aggregation.

    Controls are tenant-scoped through matrix_rows because the production
    controls table has no tenant_id column.
    """

    def __init__(self, db: Session, tenant_id: int):
        self.db = db
        self.tenant_id = tenant_id

    def build(self) -> dict[str, Any]:
        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "executive": self.executive_metrics(),
            "controls": self.control_metrics(),
            "risks": self.risk_metrics(),
            "evidence": self.evidence_metrics(),
            "tasks": self.task_metrics(),
        }

    def executive_metrics(self) -> dict[str, Any]:
        compliance = self.calculate_compliance_score()
        evidence = self.calculate_evidence_score()
        risk = self.calculate_risk_health()
        readiness = compliance * 0.40 + evidence * 0.30 + risk * 0.30
        return {
            "readiness_score": round(readiness, 2),
            "compliance_score": round(compliance, 2),
            "evidence_score": round(evidence, 2),
            "risk_health_score": round(risk, 2),
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

    def control_metrics(self) -> dict[str, Any]:
        row = self.db.execute(
            text("""
                SELECT
                    COUNT(DISTINCT mr.control_id) AS total,
                    COUNT(DISTINCT CASE WHEN e.id IS NOT NULL THEN mr.control_id END) AS covered
                FROM matrix_rows mr
                LEFT JOIN evidences e
                  ON e.control_id = mr.control_id
                 AND e.tenant_id = :tenant_id
                 AND COALESCE(e.is_deleted, false) = false
                WHERE mr.tenant_id = :tenant_id
                  AND mr.control_id IS NOT NULL
            """),
            {"tenant_id": self.tenant_id},
        ).mappings().one()
        total = int(row["total"] or 0)
        covered = int(row["covered"] or 0)
        return {
            "total": total,
            "covered": covered,
            "uncovered": total - covered,
            "coverage_percent": round((covered / total * 100) if total else 0.0, 2),
        }

    def calculate_compliance_score(self) -> float:
        return float(self.control_metrics()["coverage_percent"])

    def risk_metrics(self) -> dict[str, Any]:
        try:
            rows = ExposureEngine(self.db).compute_risk_exposure(
                tenant_id=self.tenant_id, limit=1000000
            )
        except Exception:
            rows = []

        distribution = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        total_score = 0.0
        for item in rows:
            level = str(getattr(item, "risk_level", "") or "").lower()
            if level in distribution:
                distribution[level] += 1
            total_score += float(getattr(item, "inherent_score", 0) or 0)
        total = len(rows)
        average = total_score / total if total else 0.0
        exposure = sum(float(getattr(x, "unified_score", 0) or 0) for x in rows)
        return {
            "total": total,
            "critical": distribution["critical"],
            "high": distribution["high"],
            "medium": distribution["medium"],
            "low": distribution["low"],
            "average_score": round(average, 2),
            "unified_exposure": round(exposure, 2),
            "distribution": distribution,
            "top_risks": [
                {
                    "id": getattr(x, "risk_id", None),
                    "title": getattr(x, "title", None),
                    "score": getattr(x, "inherent_score", 0),
                    "level": getattr(x, "risk_level", None),
                    "unified_score": getattr(x, "unified_score", 0),
                }
                for x in rows[:5]
            ],
        }

    def calculate_risk_health(self) -> float:
        return round(max(0.0, 100.0 - self.risk_metrics()["average_score"] * 2.0), 2)

    def top_risks(self, limit: int = 5) -> list[dict[str, Any]]:
        risks = (
            self.db.query(Risk)
            .filter(Risk.tenant_id == self.tenant_id)
            .order_by(Risk.score.desc())
            .limit(limit)
            .all()
        )
        return [
            {"id": r.id, "title": r.title, "score": r.score, "level": r.risk_level, "status": r.status}
            for r in risks
        ]

    def _evidence_state(self, evidence: Evidence) -> str:
        files = [f for f in (getattr(evidence, "files", None) or []) if not getattr(f, "is_deleted", False)]
        if not files:
            return "PENDING"
        statuses = {str(getattr(f, "status", "") or "").lower() for f in files}
        if "rejected" in statuses:
            return "REJECTED"
        if statuses and statuses.issubset({"approved"}):
            return "APPROVED"
        return "PENDING"

    def evidence_metrics(self) -> dict[str, Any]:
        evidences = (
            self.db.query(Evidence)
            .filter(Evidence.tenant_id == self.tenant_id, Evidence.is_deleted.is_(False))
            .all()
        )
        states = [self._evidence_state(e) for e in evidences]
        approved = states.count("APPROVED")
        rejected = states.count("REJECTED")
        pending = len(states) - approved - rejected
        strength = approved / len(states) * 100 if states else 0.0
        return {
            "total": len(states),
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
            .filter(Evidence.tenant_id == self.tenant_id, Evidence.is_deleted.is_(False))
            .all()
        )
        result = []
        for e in evidences:
            state = self._evidence_state(e)
            if state != "APPROVED":
                result.append({
                    "id": e.id,
                    "title": e.title,
                    "status": e.status,
                    "approval_status": state,
                    "control_id": e.control_id,
                    "requirement_id": e.requirement_id,
                })
            if len(result) >= limit:
                break
        return result

    def task_metrics(self) -> dict[str, Any]:
        tasks = (
            self.db.query(ComplianceTask)
            .filter(ComplianceTask.tenant_id == self.tenant_id)
            .all()
        )
        closed = {"closed", "completed", "done"}
        open_count = 0
        overdue = 0
        critical = 0
        high = 0
        now = datetime.now(timezone.utc)
        for task in tasks:
            status = str(getattr(task, "status", "") or "").lower()
            if status not in closed:
                open_count += 1
            priority = int(getattr(task, "priority_score", 0) or 0)
            if priority >= 80:
                critical += 1
            elif priority >= 50:
                high += 1
            due = getattr(task, "due_date", None)
            if due and status not in closed:
                due = due.replace(tzinfo=timezone.utc) if due.tzinfo is None else due
                if due < now:
                    overdue += 1
        return {
            "total": len(tasks),
            "open": open_count,
            "overdue": overdue,
            "critical": critical,
            "high": high,
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
                "id": t.id,
                "title": t.title,
                "priority_score": t.priority_score,
                "owner_role": t.owner_role,
                "status": t.status,
                "due_date": t.due_date,
            }
            for t in tasks
        ]

    def alerts(self) -> list[dict[str, Any]]:
        alerts = []
        risks = self.risk_metrics()
        if risks["critical"]:
            alerts.append({"type": "CRITICAL_RISK", "count": risks["critical"], "severity": "CRITICAL"})
        tasks = self.task_metrics()
        if tasks["overdue"]:
            alerts.append({"type": "OVERDUE_TASK", "count": tasks["overdue"], "severity": "HIGH"})
        evidence = self.evidence_metrics()
        if evidence["rejected"]:
            alerts.append({"type": "REJECTED_EVIDENCE", "count": evidence["rejected"], "severity": "MEDIUM"})
        return alerts

    def landing_page_payload(self) -> dict[str, Any]:
        executive = self.executive_metrics()
        return {
            "hero": {"title": "Compliance Intelligence OS", "readiness_score": executive["readiness_score"], "status": executive["status"]},
            "cards": [
                {"key": "compliance", "label": "Compliance Health", "value": executive["compliance_score"]},
                {"key": "evidence", "label": "Evidence Strength", "value": executive["evidence_score"]},
                {"key": "risk", "label": "Risk Health", "value": executive["risk_health_score"]},
            ],
            "risk": self.risk_metrics(),
            "controls": self.control_metrics(),
            "evidence": self.evidence_metrics(),
            "tasks": self.task_metrics(),
            "alerts": self.alerts(),
        }

    def api_response(self) -> dict[str, Any]:
        return {"success": True, "data": self.build(), "landing": self.landing_page_payload(), "generated_at": datetime.now(timezone.utc).isoformat()}


def build_executive_summary(db: Session, tenant_id: int) -> dict[str, Any]:
    return ExecutiveSummaryService(db=db, tenant_id=tenant_id).api_response()


__all__ = ["ExecutiveSummaryService", "build_executive_summary"]
