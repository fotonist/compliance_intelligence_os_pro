from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.maturity_capability_service import MaturityCapabilityService


class GapIntelligenceService:
    """
    Read-only framework-aware Gap Intelligence aggregation.

    CONTROL_BASED:
        Gap = canonical evidence-derived control coverage state.

    MATURITY_BASED:
        Assessment coverage gap = adoption-scope process not measured.
        Capability gap = CALCULATED process where achieved < target.

    Unassessed maturity processes are never interpreted as CL0 or
    NOT_ACHIEVED.
    """

    @staticmethod
    def _active_frameworks(
        db: Session,
        *,
        tenant_id: int,
    ) -> list[dict[str, Any]]:
        """
        Uses the same active framework selection contract as UEE.
        """

        rows = db.execute(
            text(
                """
                SELECT
                    fa.id AS adoption_id,
                    fa.standard_id,
                    fa.standard_version_id,
                    fa.status AS adoption_status,
                    fa.applicability,
                    fa.active_matrix_instance_id,
                    s.code AS standard_code,
                    s.title AS standard_title,
                    s.type AS framework_type
                FROM public.framework_adoptions fa
                JOIN public.standards s
                  ON s.id = fa.standard_id
                WHERE fa.tenant_id = :tenant_id
                  AND UPPER(fa.status) = 'ACTIVE'
                  AND UPPER(
                        COALESCE(
                            fa.applicability,
                            'APPLICABLE'
                        )
                      ) = 'APPLICABLE'
                ORDER BY fa.id
                """
            ),
            {"tenant_id": tenant_id},
        ).mappings().all()

        return [dict(row) for row in rows]

    @staticmethod
    def _control_gap(
        db: Session,
        *,
        tenant_id: int,
        standard_id: int,
        standard_version_id: int,
    ) -> dict[str, Any]:
        """
        Control coverage uses the same semantic contract as /matrix/kpi:

        - control universe = distinct control ids in the tenant matrix
        - APPROVED evidence = COVERED
        - DRAFT / WAITING_APPROVAL / UPLOADED = PARTIAL
        - remaining controls = NOT_COVERED
        """

        rows = db.execute(
            text(
                """
                SELECT DISTINCT
                    c.id AS control_id,
                    c.code AS control_code,
                    c.title AS control_title
                FROM matrix_instances mi
                JOIN matrix_rows mr
                  ON mr.instance_id = mi.id
                 AND mr.tenant_id = :tenant_id
                JOIN controls c
                  ON c.id = mr.control_id
                WHERE mi.tenant_id = :tenant_id
                  AND mi.standard_id = :standard_id
                  AND mi.standard_version_id = :standard_version_id
                  AND mr.control_id IS NOT NULL
                ORDER BY c.code, c.id
                """
            ),
            {
                "tenant_id": tenant_id,
                "standard_id": standard_id,
                "standard_version_id": standard_version_id,
            },
        ).mappings().all()

        controls = [dict(row) for row in rows]

        if not controls:
            return {
                "total_controls": 0,
                "covered": 0,
                "partial": 0,
                "not_covered": 0,
                "gap_count": 0,
                "compliance_percentage": 0.0,
                "items": [],
            }

        control_ids = [
            int(control["control_id"])
            for control in controls
        ]

        evidence_rows = db.execute(
            text(
                """
                SELECT DISTINCT
                    e.control_id,
                    lower(coalesce(e.status, '')) AS evidence_status
                FROM evidences e
                WHERE e.tenant_id = :tenant_id
                  AND e.is_deleted = false
                  AND e.standard_id = :standard_id
                  AND e.control_id = ANY(:control_ids)
                """
            ),
            {
                "tenant_id": tenant_id,
                "standard_id": standard_id,
                "control_ids": control_ids,
            },
        ).mappings().all()

        statuses_by_control: dict[int, set[str]] = {}

        for row in evidence_rows:
            control_id = row.get("control_id")
            if control_id is None:
                continue

            statuses_by_control.setdefault(
                int(control_id),
                set(),
            ).add(
                str(row.get("evidence_status") or "").lower()
            )

        active_remediation_statuses = {
            "OPEN",
            "IN_PROGRESS",
            "BLOCKED",
            "UNDER_REVIEW",
            "READY_TO_CLOSE",
        }

        remediation_rows = db.execute(
            text(
                """
                SELECT
                    id AS task_id,
                    control_id,
                    status
                FROM compliance_tasks
                WHERE tenant_id = :tenant_id
                  AND task_type = 'REMEDIATION'
                  AND source_type = 'CONTROL_GAP'
                  AND control_id = ANY(:control_ids)
                  AND status = ANY(:active_statuses)
                ORDER BY id DESC
                """
            ),
            {
                "tenant_id": tenant_id,
                "control_ids": control_ids,
                "active_statuses": list(active_remediation_statuses),
            },
        ).mappings().all()

        remediation_by_control: dict[int, dict[str, Any]] = {}

        for row in remediation_rows:
            control_id = row.get("control_id")

            if control_id is None:
                continue

            control_id = int(control_id)

            if control_id not in remediation_by_control:
                remediation_by_control[control_id] = {
                    "task_id": int(row["task_id"]),
                    "status": str(row["status"]),
                    "action": "VIEW_REMEDIATION",
                }

        items: list[dict[str, Any]] = []

        covered = 0
        partial = 0
        not_covered = 0

        partial_statuses = {
            "draft",
            "waiting_approval",
            "uploaded",
        }

        for control in controls:
            control_id = int(control["control_id"])
            statuses = statuses_by_control.get(
                control_id,
                set(),
            )

            if "approved" in statuses:
                coverage_status = "COVERED"
                covered += 1

            elif statuses.intersection(partial_statuses):
                coverage_status = "PARTIAL"
                partial += 1

            else:
                coverage_status = "NOT_COVERED"
                not_covered += 1

            if coverage_status != "COVERED":
                items.append(
                    {
                        "control_id": control_id,
                        "control_code": control["control_code"],
                        "control_title": control["control_title"],
                        "coverage_status": coverage_status,
                        "remediation": remediation_by_control.get(
                            control_id,
                            {
                                "task_id": None,
                                "status": None,
                                "action": "START_REMEDIATION",
                            },
                        ),
                    }
                )

        total = len(controls)

        compliance_percentage = (
            round(
                (
                    (
                        covered
                        + (partial * 0.5)
                    )
                    / total
                )
                * 100.0,
                1,
            )
            if total
            else 0.0
        )

        return {
            "total_controls": total,
            "covered": covered,
            "partial": partial,
            "not_covered": not_covered,
            "gap_count": partial + not_covered,
            "compliance_percentage": compliance_percentage,
            "items": items,
        }

    @staticmethod
    def _maturity_gap(
        db: Session,
        *,
        tenant_id: int,
        adoption_id: int,
        standard_version_id: int,
    ) -> dict[str, Any]:
        state = MaturityCapabilityService.get_standard_version_state(
            db=db,
            tenant_id=tenant_id,
            standard_version_id=standard_version_id,
        )

        adoption_scope = state.get("adoption_scope") or {}
        assessment_processes = state.get("processes") or []

        adoption_rows = db.execute(
            text(
                """
                SELECT DISTINCT
                    s.pam_process_id,
                    p.code AS process_code,
                    p.name AS process_name
                FROM framework_adoption_pam_process_scopes s
                JOIN pam_processes p
                  ON p.id = s.pam_process_id
                WHERE s.adoption_id = :adoption_id
                ORDER BY p.code, s.pam_process_id
                """
            ),
            {"adoption_id": adoption_id},
        ).mappings().all()

        assessment_by_process_id = {
            int(process["pam_process_id"]): process
            for process in assessment_processes
        }

        unassessed_items: list[dict[str, Any]] = []
        capability_gap_items: list[dict[str, Any]] = []
        target_met_items: list[dict[str, Any]] = []

        for row in adoption_rows:
            process_id = int(row["pam_process_id"])
            process = assessment_by_process_id.get(process_id)

            base = {
                "pam_process_id": process_id,
                "process_code": row["process_code"],
                "process_name": row["process_name"],
            }

            if not process or process.get("measured") is not True:
                unassessed_items.append(
                    {
                        **base,
                        "measurement_status": (
                            process.get("measurement_status")
                            if process
                            else "NOT_MEASURED"
                        ),
                        "capability_status": (
                            process.get("capability_status")
                            if process
                            else "NOT_CALCULATED"
                        ),
                        "target_capability_level": (
                            process.get("target_capability_level")
                            if process
                            else None
                        ),
                        "achieved_capability_level": None,
                    }
                )
                continue

            if process.get("capability_status") != "CALCULATED":
                continue

            target = process.get("target_capability_level")
            achieved = process.get("achieved_capability_level")

            calculated_item = {
                **base,
                "measurement_status": process.get(
                    "measurement_status"
                ),
                "capability_status": process.get(
                    "capability_status"
                ),
                "target_capability_level": target,
                "achieved_capability_level": achieved,
            }

            if (
                target is not None
                and achieved is not None
                and int(achieved) < int(target)
            ):
                capability_gap_items.append(calculated_item)
            elif (
                target is not None
                and achieved is not None
                and int(achieved) >= int(target)
            ):
                target_met_items.append(calculated_item)

        total = int(
            adoption_scope.get("total_processes") or 0
        )
        measured = int(
            adoption_scope.get("measured_processes") or 0
        )
        calculated = int(
            adoption_scope.get("calculated_processes") or 0
        )

        return {
            "assessment_coverage": {
                "total_processes": total,
                "measured_processes": measured,
                "unassessed_processes": int(
                    adoption_scope.get(
                        "unassessed_processes"
                    ) or 0
                ),
                "assessment_coverage_percentage": round(
                    float(
                        adoption_scope.get(
                            "assessment_coverage_percentage"
                        ) or 0.0
                    ),
                    1,
                ),
                "items": unassessed_items,
            },
            "capability": {
                "calculated_processes": calculated,
                "target_met_processes": len(target_met_items),
                "capability_gap_count": len(
                    capability_gap_items
                ),
                "target_achievement_percentage": (
                    round(
                        float(
                            adoption_scope[
                                "target_achievement_percentage"
                            ]
                        ),
                        1,
                    )
                    if adoption_scope.get(
                        "target_achievement_percentage"
                    ) is not None
                    else None
                ),
                "gap_items": capability_gap_items,
            },
        }

    @classmethod
    def get(
        cls,
        db: Session,
        *,
        tenant_id: int,
    ) -> dict[str, Any]:
        frameworks = []

        for framework in cls._active_frameworks(
            db,
            tenant_id=tenant_id,
        ):
            framework_type = str(
                framework.get("framework_type") or ""
            ).upper()

            node = {
                "adoption_id": int(framework["adoption_id"]),
                "standard_id": int(framework["standard_id"]),
                "standard_code": framework["standard_code"],
                "standard_title": framework.get("standard_title"),
                "standard_version_id": int(
                    framework["standard_version_id"]
                ),
                "framework_type": framework_type,
            }

            if framework_type == "CONTROL_BASED":
                node["control_gap"] = cls._control_gap(
                    db,
                    tenant_id=tenant_id,
                    standard_id=int(
                        framework["standard_id"]
                    ),
                    standard_version_id=int(
                        framework["standard_version_id"]
                    ),
                )

            elif framework_type == "MATURITY_BASED":
                node["maturity_gap"] = cls._maturity_gap(
                    db,
                    tenant_id=tenant_id,
                    adoption_id=int(
                        framework["adoption_id"]
                    ),
                    standard_version_id=int(
                        framework["standard_version_id"]
                    ),
                )

            frameworks.append(node)

        return {
            "framework_count": len(frameworks),
            "frameworks": frameworks,
        }
