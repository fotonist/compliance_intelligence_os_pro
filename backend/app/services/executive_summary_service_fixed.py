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
    """Production-safe Executive Intelligence aggregation."""

    def __init__(self, db: Session, tenant_id: int):
        self.db = db
        self.tenant_id = tenant_id

    def _dashboard_metrics(self) -> dict[str, Any]:
        row = self.db.execute(
            text("""
                SELECT tenant_id, unified_exposure, compliance_health,
                       risk_pressure, mttr_hours, total_controls, total_risks,
                       total_evidences, open_tasks
                FROM analytics.v_dashboard_summary
                WHERE tenant_id = :tenant_id
                LIMIT 1
            """),
            {"tenant_id": self.tenant_id},
        ).mappings().first()
        if not row:
            raise RuntimeError(
                f"analytics.v_dashboard_summary returned no row for tenant_id={self.tenant_id}"
            )
        return dict(row)

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
        dashboard = self._dashboard_metrics()
        compliance = float(dashboard["compliance_health"] or 0.0)
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
        """Calculate tenant-scoped control posture from real control/evidence data.

        Controls do not carry tenant_id in the current schema. Tenant isolation is
        therefore established through tenant-scoped Evidence records linked to a
        control. This avoids filtering a canonical view by a column it does not
        expose.
        """
        dashboard = self._dashboard_metrics()
        total = int(dashboard["total_controls"] or 0)

        # A control is covered when at least one non-deleted evidence belonging to
        # the current tenant has at least one approved file. Partial means tenant
        # evidence exists for the control but none of its current evidence files
        # are approved. Uncovered means no tenant evidence.
        evidence_rows = self.db.execute(
            text("""
                SELECT
                    e.control_id,
                    COUNT(DISTINCT e.id) AS evidence_count,
                    COUNT(DISTINCT CASE
                        WHEN ef.status = 'approved' THEN ef.id
                    END) AS approved_file_count
                FROM evidences e
                LEFT JOIN evidence_files ef
                    ON ef.evidence_id = e.id
                    AND ef.tenant_id = e.tenant_id
                WHERE e.tenant_id = :tenant_id
                  AND e.is_deleted = FALSE
                  AND e.control_id IS NOT NULL
                GROUP BY e.control_id
            """),
            {"tenant_id": self.tenant_id},
        ).mappings().all()

        covered = sum(1 for row in evidence_rows if int(row["approved_file_count"] or 0) > 0)
        partial = sum(
            1 for row in evidence_rows
            if int(row["evidence_count"] or 0) > 0
            and int(row["approved_file_count"] or 0) == 0
        )
        uncovered = max(total - covered - partial, 0)

        if covered + partial > total:
            partial = max(total - covered, 0)
            uncovered = 0

        return {
            "total": total,
            "covered": covered,
            "partial": partial,
            "uncovered": uncovered,
            "coverage_percent": round((covered / total * 100) if total else 0.0, 2),
        }

    def calculate_compliance_score(self) -> float:
        return float(self._dashboard_metrics()["compliance_health"] or 0.0)

    def risk_metrics(self) -> dict[str, Any]:
        dashboard = self._dashboard_metrics()
        risks = self.db.query(Risk).filter(Risk.tenant_id == self.tenant_id).all()
        distribution = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        scores: list[float] = []
        for risk in risks:
            level = str(getattr(risk, "risk_level", "") or "").strip().lower()
            score = getattr(risk, "score", None)
            if score is not None:
                scores.append(float(score))
            if level in distribution:
                distribution[level] += 1
            elif score is not None:
                numeric_score = float(score)
                if numeric_score >= 17:
                    distribution["critical"] += 1
                elif numeric_score >= 10:
                    distribution["high"] += 1
                elif numeric_score >= 5:
                    distribution["medium"] += 1
                else:
                    distribution["low"] += 1
        total = len(risks)
        average = sum(scores) / len(scores) if scores else 0.0
        exposure = float(dashboard["unified_exposure"] or 0.0)
        try:
            exposure_rows = ExposureEngine(self.db).compute_risk_exposure(
                tenant_id=self.tenant_id, limit=1000000
            )
        except Exception:
            exposure_rows = []
        exposure_by_risk = {
            int(getattr(item, "risk_id")): item
            for item in exposure_rows
            if getattr(item, "risk_id", None) is not None
        }
        ranked = sorted(
            risks,
            key=lambda risk: float(getattr(exposure_by_risk.get(risk.id), "unified_score", 0) or 0),
            reverse=True,
        )
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
                    "id": risk.id,
                    "title": risk.title,
                    "score": risk.score,
                    "level": risk.risk_level,
                    "unified_score": float(getattr(exposure_by_risk.get(risk.id), "unified_score", 0) or 0),
                }
                for risk in ranked[:5]
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
        tasks = self.db.query(ComplianceTask).filter(ComplianceTask.tenant_id == self.tenant_id).all()
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
        dashboard = self._dashboard_metrics()
        return {
            "total": len(tasks),
            "open": int(dashboard["open_tasks"] or open_count),
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
        return {
            "success": True,
            "data": self.build(),
            "landing": self.landing_page_payload(),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }


def build_executive_summary(db: Session, tenant_id: int) -> dict[str, Any]:
    return ExecutiveSummaryService(db=db, tenant_id=tenant_id).api_response()


__all__ = ["ExecutiveSummaryService", "build_executive_summary"]
