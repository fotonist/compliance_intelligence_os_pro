from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.pam_runtime import (
    PamAssessment,
    PamAssessmentProcess,
    PamCapabilityLevel,
    PamProcess,
    PamProcessAttribute,
    PamProcessAttributeEvaluation,
)


class MaturityCapabilityService:
    """
    Canonical read service for maturity-based assessment state.

    This service intentionally does not convert PAM ratings into arbitrary
    numeric scores and does not infer an achieved capability level.

    Normal assessment evaluations and audit-scoped evaluations remain
    separate sources.
    """

    @classmethod
    def get_assessment_state(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
    ) -> dict[str, Any]:
        assessment = (
            db.query(PamAssessment)
            .filter(
                PamAssessment.id == assessment_id,
                PamAssessment.tenant_id == tenant_id,
            )
            .one_or_none()
        )

        if assessment is None:
            raise ValueError(
                "Maturity assessment not found for tenant."
            )

        capability_framework_model_id = (
            cls._resolve_capability_framework_model_id(
                db,
                tenant_id=tenant_id,
                assessment=assessment,
            )
        )

        assessment_processes = (
            db.query(PamAssessmentProcess)
            .filter(
                PamAssessmentProcess.assessment_id == assessment.id,
                PamAssessmentProcess.in_scope.is_(True),
            )
            .order_by(PamAssessmentProcess.id.asc())
            .all()
        )

        process_results: list[dict[str, Any]] = []

        measured_process_count = 0
        pa_evaluation_count = 0

        for assessment_process in assessment_processes:
            process = (
                db.query(PamProcess)
                .filter(
                    PamProcess.id == assessment_process.pam_process_id
                )
                .one_or_none()
            )

            normal_evaluations = (
                db.query(PamProcessAttributeEvaluation)
                .filter(
                    PamProcessAttributeEvaluation.assessment_process_id
                    == assessment_process.id,
                    PamProcessAttributeEvaluation.audit_maturity_target_id
                    .is_(None),
                )
                .order_by(
                    PamProcessAttributeEvaluation.process_attribute_id.asc(),
                    PamProcessAttributeEvaluation.id.asc(),
                )
                .all()
            )

            audit_evaluations = (
                db.query(PamProcessAttributeEvaluation)
                .filter(
                    PamProcessAttributeEvaluation.assessment_process_id
                    == assessment_process.id,
                    PamProcessAttributeEvaluation.audit_maturity_target_id
                    .isnot(None),
                )
                .order_by(
                    PamProcessAttributeEvaluation.process_attribute_id.asc(),
                    PamProcessAttributeEvaluation.id.asc(),
                )
                .all()
            )

            normal_by_attribute = {
                item.process_attribute_id: item
                for item in normal_evaluations
            }

            audit_by_attribute: dict[int, list[Any]] = {}

            for item in audit_evaluations:
                audit_by_attribute.setdefault(
                    item.process_attribute_id,
                    [],
                ).append(item)

            target_level = (
                assessment_process.target_capability_level
            )

            capability_query = (
                db.query(PamCapabilityLevel)
                .filter(
                    PamCapabilityLevel.framework_model_id
                    == capability_framework_model_id,
                    PamCapabilityLevel.level > 0,
                )
            )

            if target_level is not None:
                capability_query = capability_query.filter(
                    PamCapabilityLevel.level <= target_level
                )

            capability_levels = (
                capability_query
                .order_by(
                    PamCapabilityLevel.level.asc(),
                    PamCapabilityLevel.sort_order.asc(),
                    PamCapabilityLevel.id.asc(),
                )
                .all()
            )

            level_by_id = {
                item.id: item
                for item in capability_levels
            }

            capability_level_ids = list(level_by_id)

            expected_attributes = []

            if capability_level_ids:
                expected_attributes = (
                    db.query(PamProcessAttribute)
                    .filter(
                        PamProcessAttribute.capability_level_id.in_(
                            capability_level_ids
                        )
                    )
                    .order_by(
                        PamProcessAttribute.capability_level_id.asc(),
                        PamProcessAttribute.sort_order.asc(),
                        PamProcessAttribute.id.asc(),
                    )
                    .all()
                )

            pa_results: list[dict[str, Any]] = []

            for attribute in expected_attributes:
                attribute_id = attribute.id
                normal = normal_by_attribute.get(attribute_id)
                audits = audit_by_attribute.get(attribute_id, [])
                level = level_by_id.get(
                    attribute.capability_level_id
                )

                pa_results.append(
                    {
                        "process_attribute_id": attribute_id,
                        "process_attribute_code": attribute.code,
                        "process_attribute_name": attribute.name,
                        "capability_level": (
                            level.level
                            if level is not None
                            else None
                        ),
                        "expected": True,
                        "measured": (
                            (
                                normal is not None
                                and normal.rating is not None
                            )
                            or any(
                                item.rating is not None
                                for item in audits
                            )
                        ),
                        "assessment_evaluation": (
                            cls._evaluation_payload(normal)
                            if normal is not None
                            else None
                        ),
                        "audit_evaluations": [
                            cls._evaluation_payload(item)
                            for item in audits
                        ],
                    }
                )

            completed_audit_ratings = (
                cls._load_completed_audit_ratings(
                    db,
                    tenant_id=tenant_id,
                    assessment_process_id=assessment_process.id,
                )
            )

            for pa in pa_results:
                revision = completed_audit_ratings.get(
                    pa["process_attribute_id"]
                )

                normal = pa["assessment_evaluation"]

                if revision is not None:
                    pa["effective_evaluation"] = {
                        "source": "AUDIT_REVISION",
                        "rating": revision["rating"],
                        "revision_id": revision["revision_id"],
                        "revision_no": revision["revision_no"],
                        "audit_maturity_target_id":
                            revision["audit_maturity_target_id"],
                        "completed_at": revision["completed_at"],
                    }
                    pa["authoritative"] = True

                elif (
                    normal is not None
                    and normal["rating"] is not None
                ):
                    pa["effective_evaluation"] = {
                        "source": "ASSESSMENT",
                        "rating": normal["rating"],
                        "evaluation_id": normal["id"],
                        "status": normal["status"],
                    }
                    pa["authoritative"] = False

                else:
                    pa["effective_evaluation"] = None
                    pa["authoritative"] = False

            measured = any(
                pa["effective_evaluation"] is not None
                for pa in pa_results
            )

            capability = cls._calculate_capability(
                pa_results,
                target_level=target_level,
            )

            if measured:
                measured_process_count += 1

            pa_evaluation_count += sum(
                (
                    1
                    if item["assessment_evaluation"] is not None
                    else 0
                )
                + len(item["audit_evaluations"])
                for item in pa_results
            )

            process_results.append(
                {
                    "assessment_process_id": assessment_process.id,
                    "pam_process_id": assessment_process.pam_process_id,
                    "process_code": (
                        process.code
                        if process is not None
                        else None
                    ),
                    "process_name": (
                        process.name
                        if process is not None
                        else None
                    ),
                    "target_capability_level":
                        assessment_process.target_capability_level,
                    "status": assessment_process.status,
                    "measured": measured,
                    "measurement_status": (
                        "MEASURED"
                        if measured
                        else "NOT_MEASURED"
                    ),
                    "achieved_capability_level":
                        capability["achieved_level"],
                    "capability_status":
                        capability["status"],
                    "capability_reason":
                        capability["reason"],
                    "process_attributes": pa_results,
                }
            )

        in_scope_count = len(assessment_processes)

        capability_calculated_process_count = sum(
            1
            for process in process_results
            if process["capability_status"] == "CALCULATED"
        )

        return {
            "assessment_id": assessment.id,
            "tenant_id": tenant_id,
            "framework_adoption_id":
                assessment.framework_adoption_id,
            "framework_model_id":
                assessment.framework_model_id,
            "capability_framework_model_id":
                capability_framework_model_id,
            "assessment_name": assessment.name,
            "assessment_status": assessment.status,
            "in_scope_process_count": in_scope_count,
            "measured_process_count": measured_process_count,
            "unmeasured_process_count":
                in_scope_count - measured_process_count,
            "capability_calculated_process_count":
                capability_calculated_process_count,
            "pa_evaluation_count": pa_evaluation_count,
            "processes": process_results,
        }

    @classmethod
    def get_standard_version_state(
        cls,
        db: Session,
        *,
        tenant_id: int,
        standard_version_id: int,
    ) -> dict[str, Any] | None:
        row = db.execute(
            text(
                """
                SELECT
                    pa.id AS assessment_id,
                    pa.framework_adoption_id
                FROM pam_assessments pa
                JOIN framework_adoptions fa
                  ON fa.id = pa.framework_adoption_id
                JOIN framework_models fm
                  ON fm.id = pa.framework_model_id
                WHERE pa.tenant_id = :tenant_id
                  AND fa.tenant_id = :tenant_id
                  AND fa.standard_version_id =
                      :standard_version_id
                  AND upper(fa.status) = 'ACTIVE'
                  AND upper(fm.model_type) = 'PAM'
                  AND fm.standard_version_id =
                      fa.standard_version_id
                ORDER BY pa.id DESC
                LIMIT 1
                """
            ),
            {
                "tenant_id": tenant_id,
                "standard_version_id": standard_version_id,
            },
        ).mappings().one_or_none()

        if row is None:
            return None

        state = cls.get_assessment_state(
            db,
            tenant_id=tenant_id,
            assessment_id=int(row["assessment_id"]),
        )

        adoption_id = int(row["framework_adoption_id"])

        adoption_rows = db.execute(
            text(
                """
                SELECT DISTINCT pam_process_id
                FROM framework_adoption_pam_process_scopes
                WHERE adoption_id = :adoption_id
                """
            ),
            {
                "adoption_id": adoption_id,
            },
        ).mappings().all()

        adoption_process_ids = {
            int(item["pam_process_id"])
            for item in adoption_rows
        }

        assessment_processes = state.get("processes") or []

        measured_process_ids = {
            int(process["pam_process_id"])
            for process in assessment_processes
            if process.get("measured") is True
            and int(process["pam_process_id"])
            in adoption_process_ids
        }

        calculated_processes = [
            process
            for process in assessment_processes
            if process.get("capability_status") == "CALCULATED"
            and int(process["pam_process_id"])
            in adoption_process_ids
        ]

        achieved_processes = [
            process
            for process in calculated_processes
            if process.get("achieved_capability_level") is not None
            and process.get("target_capability_level") is not None
            and int(process["achieved_capability_level"])
            >= int(process["target_capability_level"])
        ]

        adoption_process_count = len(adoption_process_ids)
        measured_process_count = len(measured_process_ids)
        calculated_process_count = len(calculated_processes)
        achieved_process_count = len(achieved_processes)

        unassessed_process_count = (
            adoption_process_count - measured_process_count
        )

        assessment_scope_count = int(
            state.get("in_scope_process_count") or 0
        )
        assessment_measured_count = int(
            state.get("measured_process_count") or 0
        )

        assessment_scope_coverage = (
            assessment_measured_count
            / assessment_scope_count
            * 100.0
            if assessment_scope_count
            else 0.0
        )

        adoption_coverage = (
            measured_process_count
            / adoption_process_count
            * 100.0
            if adoption_process_count
            else 0.0
        )

        target_achievement = (
            achieved_process_count
            / calculated_process_count
            * 100.0
            if calculated_process_count
            else None
        )

        state["assessment_scope"] = {
            "total_processes": assessment_scope_count,
            "measured_processes": assessment_measured_count,
            "unassessed_processes": (
                assessment_scope_count
                - assessment_measured_count
            ),
            "assessment_coverage_percentage":
                assessment_scope_coverage,
        }

        state["adoption_scope"] = {
            "total_processes": adoption_process_count,
            "measured_processes": measured_process_count,
            "calculated_processes": calculated_process_count,
            "unassessed_processes": unassessed_process_count,
            "achieved_processes": achieved_process_count,
            "assessment_coverage_percentage":
                adoption_coverage,
            "target_achievement_percentage":
                target_achievement,
        }

        return state

    @staticmethod
    def _load_completed_audit_ratings(
        db: Session,
        *,
        tenant_id: int,
        assessment_process_id: int,
    ) -> dict[int, dict[str, Any]]:
        rows = db.execute(
            text(
                """
                SELECT DISTINCT ON (r.process_attribute_id)
                    r.id AS revision_id,
                    r.audit_maturity_target_id,
                    r.revision_no,
                    r.process_attribute_id,
                    r.rating,
                    r.completed_at
                FROM audit_maturity_target_revisions r
                JOIN audit_maturity_targets t
                  ON t.id = r.audit_maturity_target_id
                WHERE r.tenant_id = :tenant_id
                  AND r.assessment_process_id =
                      :assessment_process_id
                  AND t.status = 'COMPLETED'
                  AND r.rating IS NOT NULL
                ORDER BY
                    r.process_attribute_id,
                    r.revision_no DESC,
                    r.id DESC
                """
            ),
            {
                "tenant_id": tenant_id,
                "assessment_process_id":
                    assessment_process_id,
            },
        ).mappings().all()

        return {
            int(row["process_attribute_id"]): dict(row)
            for row in rows
        }

    @staticmethod
    def _calculate_capability(
        process_attributes: list[dict[str, Any]],
        *,
        target_level: int | None,
    ) -> dict[str, Any]:
        if target_level is None:
            return {
                "status": "NOT_CALCULATED",
                "achieved_level": None,
                "reason": "TARGET_LEVEL_NOT_DEFINED",
            }

        if target_level <= 0:
            return {
                "status": "CALCULATED",
                "achieved_level": 0,
                "reason": "TARGET_LEVEL_ZERO",
            }

        by_level: dict[int, list[dict[str, Any]]] = {}

        for pa in process_attributes:
            level = pa.get("capability_level")

            if level is None:
                continue

            by_level.setdefault(int(level), []).append(pa)

        achieved_level = 0

        for level in range(1, int(target_level) + 1):
            attributes = by_level.get(level, [])

            if not attributes:
                return {
                    "status": "NOT_CALCULATED",
                    "achieved_level": None,
                    "reason":
                        f"EXPECTED_PA_MISSING_FOR_CL{level}",
                }

            ratings: list[str] = []

            for pa in attributes:
                effective = pa.get("effective_evaluation")

                if effective is None:
                    return {
                        "status": "NOT_CALCULATED",
                        "achieved_level": None,
                        "reason":
                            f"PA_NOT_MEASURED:{pa.get('process_attribute_code')}",
                    }

                if not pa.get("authoritative"):
                    return {
                        "status": "NOT_FINAL",
                        "achieved_level": None,
                        "reason":
                            f"PA_NOT_AUTHORITATIVE:{pa.get('process_attribute_code')}",
                    }

                rating = str(
                    effective.get("rating") or ""
                ).strip().upper()

                if rating not in {"N", "P", "L", "F"}:
                    return {
                        "status": "NOT_CALCULATED",
                        "achieved_level": None,
                        "reason":
                            f"INVALID_RATING:{pa.get('process_attribute_code')}",
                    }

                ratings.append(rating)

            if level < int(target_level):
                level_passed = all(
                    rating == "F"
                    for rating in ratings
                )
            else:
                level_passed = all(
                    rating in {"L", "F"}
                    for rating in ratings
                )

            if not level_passed:
                break

            achieved_level = level

        return {
            "status": "CALCULATED",
            "achieved_level": achieved_level,
            "reason": "CAPABILITY_RULES_APPLIED",
        }

    @staticmethod
    def _resolve_capability_framework_model_id(
        db: Session,
        *,
        tenant_id: int,
        assessment: PamAssessment,
    ) -> int:
        row = db.execute(
            text(
                """
                SELECT cmf.id
                FROM framework_adoptions fa
                JOIN framework_models pam
                  ON pam.id = :pam_framework_model_id
                JOIN framework_models cmf
                  ON cmf.standard_version_id = fa.standard_version_id
                 AND upper(cmf.model_type) = 'CMF'
                 AND cmf.is_canonical IS TRUE
                WHERE fa.id = :framework_adoption_id
                  AND fa.tenant_id = :tenant_id
                  AND fa.standard_version_id = pam.standard_version_id
                ORDER BY cmf.id
                LIMIT 1
                """
            ),
            {
                "pam_framework_model_id":
                    assessment.framework_model_id,
                "framework_adoption_id":
                    assessment.framework_adoption_id,
                "tenant_id": tenant_id,
            },
        ).mappings().one_or_none()

        if row is None:
            raise ValueError(
                "Canonical capability measurement framework "
                "could not be resolved for assessment."
            )

        return int(row["id"])

    @staticmethod
    def _evaluation_payload(
        evaluation: PamProcessAttributeEvaluation,
    ) -> dict[str, Any]:
        return {
            "id": evaluation.id,
            "rating": evaluation.rating,
            "status": evaluation.status,
            "justification": evaluation.justification,
            "evaluated_by": evaluation.evaluated_by,
            "evaluated_at": evaluation.evaluated_at,
            "audit_maturity_target_id":
                evaluation.audit_maturity_target_id,
        }
