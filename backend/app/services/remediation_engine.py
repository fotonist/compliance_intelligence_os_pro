from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Set

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.compliance_tasks import ComplianceTask
from app.services.exposure_engine import ExposureEngine


class RemediationEngine:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _control_ai_priority(
        worst_severity: float,
        avg_exposure: float,
        avg_escalation: float,
        gap_count: int,
    ) -> float:
        ws = float(worst_severity or 0.0)
        ae = float(avg_exposure or 0.0)
        ap = float(avg_escalation or 0.0)
        gc = int(gap_count or 0)

        score = (
            (ws * 0.40)
            + (ae * 0.30)
            + ((ap * 100.0) * 0.20)
            + (gc * 0.10)
        )
        return round(score, 2)

    @staticmethod
    def _priority_score(ai_score: float) -> int:
        score = int(round(float(ai_score or 0.0)))
        if score < 0:
            return 0
        if score > 100:
            return 100
        return score

    @staticmethod
    def _owner_role(ai_score: float) -> str:
        if ai_score >= 50:
            return "control_owner"
        return "process_owner"

    @staticmethod
    def _due_days(ai_score: float) -> int:
        if ai_score >= 50:
            return 7
        if ai_score >= 35:
            return 14
        if ai_score >= 20:
            return 21
        return 30

    def _find_process_id_for_risk(self, tenant_id: int, risk_id: int) -> int | None:
        stmt = text(
            """
            SELECT prl.process_id
            FROM process_risk_link prl
            JOIN process p ON p.id = prl.process_id
            WHERE prl.tenant_id = :tenant_id
              AND prl.risk_id = :risk_id
              AND p.tenant_id = :tenant_id
            ORDER BY prl.process_id
            LIMIT 1
            """
        )

        row = self.db.execute(
            stmt,
            {"tenant_id": tenant_id, "risk_id": risk_id},
        ).mappings().first()

        return int(row["process_id"]) if row and row.get("process_id") is not None else None

    def _existing_open_task(self, tenant_id: int, control_id: int) -> ComplianceTask | None:
        return (
            self.db.query(ComplianceTask)
            .filter(
                ComplianceTask.tenant_id == tenant_id,
                ComplianceTask.source_type == "control_gap_auto",
                ComplianceTask.source_id == control_id,
                ComplianceTask.status.in_(["open", "in_progress"]),
            )
            .first()
        )

    def generate_gap_tasks(
        self,
        tenant_id: int,
        threshold: float = 25.0,
    ) -> Dict[str, Any]:

        gap_stmt = text(
            """
            SELECT
                gi.id,
                gi.risk_id,
                gi.control_id,
                gi.severity_score,
                gi.status,
                co.code AS control_code,
                co.title AS control_title,
                r.title AS risk_title
            FROM gap_items gi
            LEFT JOIN controls co ON co.id = gi.control_id
            LEFT JOIN risks r ON r.id = gi.risk_id
            WHERE gi.tenant_id = :tenant_id
              AND lower(coalesce(gi.status, '')) IN ('uncovered', 'partial')
            ORDER BY gi.severity_score DESC NULLS LAST, gi.id DESC
            """
        )

        gap_rows = self.db.execute(gap_stmt, {"tenant_id": tenant_id}).mappings().all()

        if not gap_rows:
            return {
                "threshold": threshold,
                "evaluated_controls": 0,
                "created_tasks": 0,
                "existing_tasks": 0,
                "below_threshold": 0,
                "missing_process": 0,
                "created": [],
                "existing": [],
                "skipped": [],
            }

        exposure_engine = ExposureEngine(self.db)
        exposure_rows = exposure_engine.compute_risk_exposure(
            tenant_id=tenant_id,
            limit=100000,
        )

        exposure_map = {int(r.risk_id): r for r in exposure_rows}

        control_map: Dict[int, Dict[str, Any]] = {}

        for row in gap_rows:
            cid = row["control_id"]
            rid = row["risk_id"]

            if cid is None or rid is None:
                continue

            if cid not in control_map:
                control_map[cid] = {
                    "control_id": int(cid),
                    "control_code": row["control_code"],
                    "control_title": row["control_title"],
                    "gap_count": 0,
                    "worst_severity": 0.0,
                    "top_risk_id": int(rid),
                    "risk_ids": set(),
                    "risk_nodes": [],
                }

            node = control_map[cid]
            sev = float(row["severity_score"] or 0.0)

            node["gap_count"] += 1
            node["risk_ids"].add(int(rid))

            if sev >= float(node["worst_severity"]):
                node["worst_severity"] = sev
                node["top_risk_id"] = int(rid)

            exposure = exposure_map.get(int(rid))

            node["risk_nodes"].append(
                {
                    "risk_id": int(rid),
                    "exposure_score": float(exposure.residual_exposure) if exposure else 0.0,
                    "escalation_probability": float(exposure.escalation_probability_30d) if exposure else 0.0,
                }
            )

        created: List[Dict[str, Any]] = []
        existing: List[Dict[str, Any]] = []
        skipped: List[Dict[str, Any]] = []

        created_count = 0
        existing_count = 0
        below_threshold_count = 0
        missing_process_count = 0

        for control in control_map.values():
            risks = control["risk_nodes"]

            avg_exposure = 0.0
            avg_escalation = 0.0

            if risks:
                avg_exposure = sum(
                    float(r.get("exposure_score", 0.0) or 0.0)
                    for r in risks
                ) / len(risks)

                avg_escalation = sum(
                    float(r.get("escalation_probability", 0.0) or 0.0)
                    for r in risks
                ) / len(risks)

            ai_score = self._control_ai_priority(
                worst_severity=float(control["worst_severity"] or 0.0),
                avg_exposure=avg_exposure,
                avg_escalation=avg_escalation,
                gap_count=int(control["gap_count"] or 0),
            )

            if ai_score < threshold:
                below_threshold_count += 1
                skipped.append(
                    {
                        "control_id": control["control_id"],
                        "control_code": control["control_code"],
                        "reason": "below_threshold",
                        "ai_priority_score": ai_score,
                    }
                )
                continue

            existing_task = self._existing_open_task(
                tenant_id=tenant_id,
                control_id=int(control["control_id"]),
            )

            if existing_task:
                existing_count += 1
                existing.append(
                    {
                        "task_id": existing_task.id,
                        "control_id": control["control_id"],
                        "control_code": control["control_code"],
                        "ai_priority_score": ai_score,
                    }
                )
                continue

            process_id = self._find_process_id_for_risk(
                tenant_id=tenant_id,
                risk_id=int(control["top_risk_id"]),
            )

            if process_id is None:
                missing_process_count += 1
                skipped.append(
                    {
                        "control_id": control["control_id"],
                        "control_code": control["control_code"],
                        "reason": "missing_process",
                        "ai_priority_score": ai_score,
                    }
                )
                continue

            due_days = self._due_days(ai_score)
            owner_role = self._owner_role(ai_score)
            priority_score = self._priority_score(ai_score)

            task = ComplianceTask(
                tenant_id=tenant_id,
                process_id=process_id,
                control_id=int(control["control_id"]),
                priority_score=priority_score,
                owner_role=owner_role,
                due_date=datetime.now(timezone.utc) + timedelta(days=due_days),
                status="open",
                source_type="control_gap_auto",
                source_id=int(control["control_id"]),
                title=f"Auto remediate {control['control_code'] or 'control'}",
                description=(
                    f"Auto-created from Gap Intelligence. "
                    f"Control={control['control_code'] or 'N/A'}, "
                    f"gap_count={control['gap_count']}, "
                    f"worst_severity={round(float(control['worst_severity'] or 0.0), 2)}, "
                    f"ai_priority_score={ai_score}."
                ),
            )

            self.db.add(task)
            self.db.flush()

            created_count += 1

            created.append(
                {
                    "task_id": task.id,
                    "control_id": control["control_id"],
                    "control_code": control["control_code"],
                    "process_id": process_id,
                    "priority_score": priority_score,
                    "owner_role": owner_role,
                    "due_in_days": due_days,
                    "ai_priority_score": ai_score,
                }
            )

        self.db.commit()

        return {
            "threshold": threshold,
            "evaluated_controls": len(control_map),
            "created_tasks": created_count,
            "existing_tasks": existing_count,
            "below_threshold": below_threshold_count,
            "missing_process": missing_process_count,
            "created": created,
            "existing": existing,
            "skipped": skipped,
        }