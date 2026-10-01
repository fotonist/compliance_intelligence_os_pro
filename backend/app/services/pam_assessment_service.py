from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.framework_adoption import FrameworkAdoptionScope
from app.models.process import Process
from app.models.user import User
from app.models.audit_plans import AuditPlan
from app.models.pam_runtime import (
    PamAssessment,
    PamAssessmentProcess,
    PamCapabilityLevel,
    PamProcess,
    PamProcessCategory,
    PamProcessGroup,
    ProcessPamMapping,
    PamProcessOutcome,
    PamBasePractice,
    PamWorkProduct,
    PamProcessWorkProduct,
    PamProcessAttribute,
    PamProcessAttributeEvaluation,
    PamRatingOption,
    PamIndicatorEvaluation,
    PamIndicatorEvidenceLink,
)
from app.models.evidences import Evidence
from app.services.maturity_context_resolver import (
    MaturityContext,
    MaturityContextConflictError,
    MaturityContextNotFoundError,
    MaturityContextResolver,
)
from app.services.pam_content_resolver import PamContentResolver


class PamAssessmentError(ValueError):
    pass


class PamAssessmentNotFoundError(PamAssessmentError):
    pass


class PamAssessmentConflictError(PamAssessmentError):
    pass


class PamAssessmentService:

    @classmethod
    def _resolve_work_product_evaluation(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
        work_product_id: int,
        evaluator_user_id: int | None = None,
        create_if_missing: bool = False,
    ):
        workspace = cls.get_process_workspace(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
        )

        work_product_ids = {
            int(item["id"])
            for item in workspace["work_products"]
        }

        if int(work_product_id) not in work_product_ids:
            raise NotFound(
                "Work product is not part of this assessment process."
            )

        evaluation = (
            db.query(PamIndicatorEvaluation)
            .filter(
                PamIndicatorEvaluation.assessment_process_id
                == assessment_process_id,
                PamIndicatorEvaluation.indicator_type
                == "WORK_PRODUCT",
                PamIndicatorEvaluation.work_product_id
                == work_product_id,
            )
            .one_or_none()
        )

        if evaluation is None and create_if_missing:
            if evaluator_user_id is not None:
                cls._validate_tenant_user(
                    db,
                    tenant_id=tenant_id,
                    user_id=evaluator_user_id,
                    field_name="evaluator_user_id",
                )

            evaluation = PamIndicatorEvaluation(
                assessment_process_id=assessment_process_id,
                indicator_type="WORK_PRODUCT",
                work_product_id=work_product_id,
                rating=None,
                observation=None,
                justification=None,
                status="not_assessed",
                evaluator_user_id=evaluator_user_id,
            )

            db.add(evaluation)
            db.flush()

        return evaluation

    @classmethod
    def list_work_product_evidences(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
        work_product_id: int,
    ):
        evaluation = cls._resolve_work_product_evaluation(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
            work_product_id=work_product_id,
            create_if_missing=False,
        )

        if evaluation is None:
            return []

        rows = (
            db.query(
                PamIndicatorEvidenceLink,
                Evidence,
            )
            .join(
                Evidence,
                Evidence.id
                == PamIndicatorEvidenceLink.evidence_id,
            )
            .filter(
                PamIndicatorEvidenceLink.evaluation_id
                == evaluation.id,
                Evidence.tenant_id == tenant_id,
                Evidence.is_deleted.is_(False),
            )
            .order_by(
                PamIndicatorEvidenceLink.id.asc()
            )
            .all()
        )

        return [
            {
                "evidence_id": evidence.id,
                "title": evidence.title,
                "description": evidence.description,
                "status": evidence.status,
                "assessment_type": evidence.assessment_type,
                "standard_id": evidence.standard_id,
                "standard_version_id":
                    evidence.standard_version_id,
                "relevance": link.relevance,
                "note": link.note,
            }
            for link, evidence in rows
        ]

    @classmethod
    def link_work_product_evidence(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
        work_product_id: int,
        evidence_id: int,
        evaluator_user_id: int | None = None,
        relevance: str | None = None,
        note: str | None = None,
        commit: bool = True,
    ):
        context = cls.resolve_assessment_context(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        evidence = (
            db.query(Evidence)
            .filter(
                Evidence.id == evidence_id,
                Evidence.tenant_id == tenant_id,
                Evidence.is_deleted.is_(False),
            )
            .one_or_none()
        )

        if evidence is None:
            raise NotFound("Evidence not found.")

        if evidence.assessment_type != "maturity":
            raise ValidationError(
                "Evidence assessment type must be maturity."
            )

        if evidence.standard_id != context.standard_id:
            raise ValidationError(
                "Evidence standard does not match assessment standard."
            )

        if (
            evidence.standard_version_id
            != context.standard_version_id
        ):
            raise ValidationError(
                "Evidence standard version does not match assessment version."
            )

        evaluation = cls._resolve_work_product_evaluation(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
            work_product_id=work_product_id,
            evaluator_user_id=evaluator_user_id,
            create_if_missing=True,
        )

        link = (
            db.query(PamIndicatorEvidenceLink)
            .filter(
                PamIndicatorEvidenceLink.evaluation_id
                == evaluation.id,
                PamIndicatorEvidenceLink.evidence_id
                == evidence.id,
            )
            .one_or_none()
        )

        if link is None:
            link = PamIndicatorEvidenceLink(
                evaluation_id=evaluation.id,
                evidence_id=evidence.id,
                relevance=relevance,
                note=note,
            )
            db.add(link)
        else:
            link.relevance = relevance
            link.note = note

        if commit:
            db.commit()
            db.refresh(link)
        else:
            db.flush()

        return {
            "evidence_id": evidence.id,
            "title": evidence.title,
            "description": evidence.description,
            "status": evidence.status,
            "assessment_type": evidence.assessment_type,
            "standard_id": evidence.standard_id,
            "standard_version_id":
                evidence.standard_version_id,
            "relevance": link.relevance,
            "note": link.note,
        }

    @classmethod
    def unlink_work_product_evidence(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
        work_product_id: int,
        evidence_id: int,
        commit: bool = True,
    ):
        evaluation = cls._resolve_work_product_evaluation(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
            work_product_id=work_product_id,
            create_if_missing=False,
        )

        if evaluation is None:
            raise NotFound("Work product evidence link not found.")

        link = (
            db.query(PamIndicatorEvidenceLink)
            .join(
                Evidence,
                Evidence.id
                == PamIndicatorEvidenceLink.evidence_id,
            )
            .filter(
                PamIndicatorEvidenceLink.evaluation_id
                == evaluation.id,
                PamIndicatorEvidenceLink.evidence_id
                == evidence_id,
                Evidence.tenant_id == tenant_id,
                Evidence.is_deleted.is_(False),
            )
            .one_or_none()
        )

        if link is None:
            raise NotFound("Work product evidence link not found.")

        db.delete(link)

        if commit:
            db.commit()
        else:
            db.flush()

        return True

    @classmethod
    def _resolve_base_practice_evaluation(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
        base_practice_id: int,
        evaluator_user_id: Optional[int] = None,
        create_if_missing: bool = False,
    ):
        workspace = cls.get_process_workspace(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
        )

        base_practice_ids = {
            int(item["id"])
            for item in workspace.get("base_practices", [])
        }

        if int(base_practice_id) not in base_practice_ids:
            raise PamAssessmentNotFoundError(
                "Base practice does not belong to the assessment process."
            )

        evaluation = (
            db.query(PamIndicatorEvaluation)
            .filter(
                PamIndicatorEvaluation.assessment_process_id
                == assessment_process_id,
                PamIndicatorEvaluation.indicator_type
                == "BASE_PRACTICE",
                PamIndicatorEvaluation.base_practice_id
                == base_practice_id,
            )
            .one_or_none()
        )

        if evaluation is None and create_if_missing:
            cls._validate_tenant_user(
                db,
                tenant_id=tenant_id,
                user_id=evaluator_user_id,
                field_name="evaluator_user_id",
            )

            evaluation = PamIndicatorEvaluation(
                assessment_process_id=assessment_process_id,
                indicator_type="BASE_PRACTICE",
                base_practice_id=base_practice_id,
                rating=None,
                observation=None,
                justification=None,
                status="not_assessed",
                evaluator_user_id=evaluator_user_id,
            )
            db.add(evaluation)
            db.flush()

        return evaluation

    @classmethod
    def list_base_practice_evidences(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
        base_practice_id: int,
    ):
        evaluation = cls._resolve_base_practice_evaluation(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
            base_practice_id=base_practice_id,
            create_if_missing=False,
        )

        if evaluation is None:
            return []

        rows = (
            db.query(PamIndicatorEvidenceLink, Evidence)
            .join(
                Evidence,
                Evidence.id == PamIndicatorEvidenceLink.evidence_id,
            )
            .filter(
                PamIndicatorEvidenceLink.evaluation_id == evaluation.id,
                Evidence.tenant_id == tenant_id,
                Evidence.is_deleted.is_(False),
            )
            .order_by(Evidence.id.desc())
            .all()
        )

        return [
            {
                "evidence_id": evidence.id,
                "title": evidence.title,
                "description": evidence.description,
                "status": evidence.status,
                "assessment_type": evidence.assessment_type,
                "standard_id": evidence.standard_id,
                "standard_version_id": evidence.standard_version_id,
                "relevance": link.relevance,
                "note": link.note,
            }
            for link, evidence in rows
        ]

    @classmethod
    def link_base_practice_evidence(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
        base_practice_id: int,
        evidence_id: int,
        evaluator_user_id: Optional[int] = None,
        relevance: Optional[str] = None,
        note: Optional[str] = None,
        commit: bool = True,
    ):
        context = cls.resolve_assessment_context(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        evidence = (
            db.query(Evidence)
            .filter(
                Evidence.id == evidence_id,
                Evidence.tenant_id == tenant_id,
                Evidence.is_deleted.is_(False),
            )
            .one_or_none()
        )

        if evidence is None:
            raise PamAssessmentNotFoundError(
                "Evidence was not found in the assessment tenant."
            )

        if evidence.assessment_type != "maturity":
            raise PamAssessmentConflictError(
                "Only maturity evidence can be linked to a PAM assessment."
            )

        if evidence.standard_id != context.standard_id:
            raise PamAssessmentConflictError(
                "Evidence standard does not match the assessment standard."
            )

        if evidence.standard_version_id != context.standard_version_id:
            raise PamAssessmentConflictError(
                "Evidence standard version does not match the assessment version."
            )

        evaluation = cls._resolve_base_practice_evaluation(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
            base_practice_id=base_practice_id,
            evaluator_user_id=evaluator_user_id,
            create_if_missing=True,
        )

        existing = (
            db.query(PamIndicatorEvidenceLink)
            .filter(
                PamIndicatorEvidenceLink.evaluation_id == evaluation.id,
                PamIndicatorEvidenceLink.evidence_id == evidence.id,
            )
            .one_or_none()
        )

        if existing is not None:
            existing.relevance = relevance
            existing.note = note
            link = existing
        else:
            link = PamIndicatorEvidenceLink(
                evaluation_id=evaluation.id,
                evidence_id=evidence.id,
                relevance=relevance,
                note=note,
            )
            db.add(link)

        if commit:
            db.commit()
            db.refresh(link)
        else:
            db.flush()

        return {
            "evidence_id": evidence.id,
            "title": evidence.title,
            "description": evidence.description,
            "status": evidence.status,
            "assessment_type": evidence.assessment_type,
            "standard_id": evidence.standard_id,
            "standard_version_id": evidence.standard_version_id,
            "relevance": link.relevance,
            "note": link.note,
        }

    @classmethod
    def unlink_base_practice_evidence(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
        base_practice_id: int,
        evidence_id: int,
        commit: bool = True,
    ) -> None:
        evaluation = cls._resolve_base_practice_evaluation(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
            base_practice_id=base_practice_id,
            create_if_missing=False,
        )

        if evaluation is None:
            raise PamAssessmentNotFoundError(
                "Base practice evidence link was not found."
            )

        link = (
            db.query(PamIndicatorEvidenceLink)
            .join(
                Evidence,
                Evidence.id == PamIndicatorEvidenceLink.evidence_id,
            )
            .filter(
                PamIndicatorEvidenceLink.evaluation_id == evaluation.id,
                PamIndicatorEvidenceLink.evidence_id == evidence_id,
                Evidence.tenant_id == tenant_id,
                Evidence.is_deleted.is_(False),
            )
            .one_or_none()
        )

        if link is None:
            raise PamAssessmentNotFoundError(
                "Base practice evidence link was not found."
            )

        db.delete(link)

        if commit:
            db.commit()
        else:
            db.flush()
    DEFAULT_STATUS = "draft"
    DEFAULT_PROCESS_STATUS = "not_started"

    @classmethod
    def _validate_tenant_user(
        cls,
        db: Session,
        *,
        tenant_id: int,
        user_id: Optional[int],
        field_name: str,
    ) -> None:
        if user_id is None:
            return

        user_exists = (
            db.query(User.id)
            .filter(
                User.id == user_id,
                User.tenant_id == tenant_id,
            )
            .first()
        )

        if user_exists is None:
            raise PamAssessmentConflictError(
                f"{field_name} does not belong to the assessment tenant."
            )

    @classmethod
    def _validate_audit_plan(
        cls,
        db: Session,
        *,
        tenant_id: int,
        audit_plan_id: Optional[int],
        context: MaturityContext,
    ) -> None:
        if audit_plan_id is None:
            return

        audit_plan = (
            db.query(AuditPlan)
            .filter(
                AuditPlan.id == audit_plan_id,
                AuditPlan.tenant_id == tenant_id,
            )
            .one_or_none()
        )

        if audit_plan is None:
            raise PamAssessmentConflictError(
                "Audit plan does not belong to the assessment tenant."
            )

        if (
            audit_plan.standard_id is not None
            and audit_plan.standard_id
            != context.standard_id
        ):
            raise PamAssessmentConflictError(
                "Audit plan standard does not match the assessment standard."
            )

        if (
            audit_plan.standard_version_id is not None
            and audit_plan.standard_version_id
            != context.standard_version_id
        ):
            raise PamAssessmentConflictError(
                "Audit plan standard version does not match the assessment version."
            )

    @classmethod
    def create_assessment(
        cls,
        db: Session,
        *,
        tenant_id: int,
        framework_adoption_id: int,
        name: str,
        scope: Optional[str] = None,
        assessor_user_id: Optional[int] = None,
        sponsor_user_id: Optional[int] = None,
        audit_plan_id: Optional[int] = None,
        commit: bool = True,
    ) -> PamAssessment:
        clean_name = str(name or "").strip()

        if not clean_name:
            raise PamAssessmentConflictError(
                "Assessment name is required."
            )

        try:
            context = MaturityContextResolver.resolve(
                db,
                tenant_id=tenant_id,
                framework_adoption_id=framework_adoption_id,
            )
        except MaturityContextNotFoundError as exc:
            raise PamAssessmentNotFoundError(str(exc)) from exc
        except MaturityContextConflictError as exc:
            raise PamAssessmentConflictError(str(exc)) from exc

        cls._validate_tenant_user(
            db,
            tenant_id=context.tenant_id,
            user_id=assessor_user_id,
            field_name="Assessor user",
        )

        cls._validate_tenant_user(
            db,
            tenant_id=context.tenant_id,
            user_id=sponsor_user_id,
            field_name="Sponsor user",
        )

        cls._validate_audit_plan(
            db,
            tenant_id=context.tenant_id,
            audit_plan_id=audit_plan_id,
            context=context,
        )

        assessment = PamAssessment(
            tenant_id=context.tenant_id,
            framework_adoption_id=context.framework_adoption_id,
            framework_model_id=context.framework_model_id,
            name=clean_name,
            scope=scope,
            status=cls.DEFAULT_STATUS,
            assessor_user_id=assessor_user_id,
            sponsor_user_id=sponsor_user_id,
            audit_plan_id=audit_plan_id,
        )

        db.add(assessment)

        if commit:
            db.commit()
            db.refresh(assessment)
        else:
            db.flush()

        return assessment

    @classmethod
    def get_assessment(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
    ) -> PamAssessment:
        assessment = (
            db.query(PamAssessment)
            .filter(
                PamAssessment.id == assessment_id,
                PamAssessment.tenant_id == tenant_id,
            )
            .one_or_none()
        )

        if assessment is None:
            raise PamAssessmentNotFoundError(
                "PAM assessment was not found for the tenant."
            )

        return assessment

    @classmethod
    def resolve_assessment_context(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
    ) -> MaturityContext:
        assessment = cls.get_assessment(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        try:
            context = MaturityContextResolver.resolve(
                db,
                tenant_id=tenant_id,
                framework_adoption_id=assessment.framework_adoption_id,
            )
        except MaturityContextNotFoundError as exc:
            raise PamAssessmentNotFoundError(str(exc)) from exc
        except MaturityContextConflictError as exc:
            raise PamAssessmentConflictError(str(exc)) from exc

        if context.framework_model_id != assessment.framework_model_id:
            raise PamAssessmentConflictError(
                "Assessment framework model does not match the canonical maturity context."
            )

        return context

    @classmethod
    def list_assessments(
        cls,
        db: Session,
        *,
        tenant_id: int,
        framework_adoption_id: Optional[int] = None,
    ):
        query = (
            db.query(PamAssessment)
            .filter(PamAssessment.tenant_id == tenant_id)
        )

        if framework_adoption_id is not None:
            query = query.filter(
                PamAssessment.framework_adoption_id
                == framework_adoption_id
            )

        return query.order_by(
            PamAssessment.created_at.desc(),
            PamAssessment.id.desc(),
        ).all()

    @classmethod
    def list_processes(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
    ):
        assessment = cls.get_assessment(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        context = cls.resolve_assessment_context(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        rows = (
            db.query(
                PamAssessmentProcess,
                PamProcess,
                PamProcessGroup,
                PamProcessCategory,
                Process,
            )
            .join(
                PamProcess,
                PamProcess.id
                == PamAssessmentProcess.pam_process_id,
            )
            .join(
                PamProcessGroup,
                PamProcessGroup.id
                == PamProcess.process_group_id,
            )
            .join(
                PamProcessCategory,
                PamProcessCategory.id
                == PamProcessGroup.category_id,
            )
            .outerjoin(
                Process,
                Process.id
                == PamAssessmentProcess.tenant_process_id,
            )
            .filter(
                PamAssessmentProcess.assessment_id
                == assessment.id,
                PamProcess.framework_model_id
                == context.pam_framework_model_id,
                PamProcessCategory.framework_model_id
                == context.pam_framework_model_id,
            )
            .order_by(
                PamProcessCategory.sort_order.asc(),
                PamProcessGroup.sort_order.asc(),
                PamProcess.sort_order.asc(),
                PamAssessmentProcess.id.asc(),
            )
            .all()
        )

        return [
            {
                "id": assessment_process.id,
                "assessment_id": assessment_process.assessment_id,
                "tenant_process_id": (
                    assessment_process.tenant_process_id
                ),
                "pam_process_id": assessment_process.pam_process_id,
                "in_scope": assessment_process.in_scope,
                "target_capability_level": (
                    assessment_process.target_capability_level
                ),
                "status": assessment_process.status,
                "created_at": assessment_process.created_at,
                "pam_process": {
                    "id": pam_process.id,
                    "code": pam_process.code,
                    "name": pam_process.name,
                    "purpose": pam_process.purpose,
                    "description": pam_process.description,
                },
                "process_group": {
                    "id": process_group.id,
                    "code": process_group.code,
                    "name": process_group.name,
                },
                "process_category": {
                    "id": process_category.id,
                    "code": process_category.code,
                    "name": process_category.name,
                },
                "tenant_process": (
                    {
                        "id": tenant_process.id,
                        "code": tenant_process.code,
                        "name": tenant_process.name,
                    }
                    if tenant_process is not None
                    else None
                ),
            }
            for (
                assessment_process,
                pam_process,
                process_group,
                process_category,
                tenant_process,
            ) in rows
        ]

    @classmethod
    def list_available_processes(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
    ):
        assessment = cls.get_assessment(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        context = cls.resolve_assessment_context(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        added_process_ids = {
            row[0]
            for row in (
                db.query(
                    PamAssessmentProcess.pam_process_id
                )
                .filter(
                    PamAssessmentProcess.assessment_id
                    == assessment.id
                )
                .all()
            )
        }

        catalog_rows = (
            db.query(
                PamProcess,
                PamProcessGroup,
                PamProcessCategory,
            )
            .join(
                PamProcessGroup,
                PamProcessGroup.id
                == PamProcess.process_group_id,
            )
            .join(
                PamProcessCategory,
                PamProcessCategory.id
                == PamProcessGroup.category_id,
            )
            .filter(
                PamProcess.framework_model_id
                == context.pam_framework_model_id,
                PamProcessCategory.framework_model_id
                == context.pam_framework_model_id,
            )
            .order_by(
                PamProcessCategory.sort_order.asc(),
                PamProcessGroup.sort_order.asc(),
                PamProcess.sort_order.asc(),
                PamProcess.id.asc(),
            )
            .all()
        )

        mapping_rows = (
            db.query(
                ProcessPamMapping,
                Process,
            )
            .join(
                Process,
                Process.id
                == ProcessPamMapping.process_id,
            )
            .filter(
                ProcessPamMapping.framework_adoption_id
                == context.framework_adoption_id,
                Process.tenant_id == tenant_id,
            )
            .all()
        )

        mappings_by_pam_process = {}

        for mapping, tenant_process in mapping_rows:
            mappings_by_pam_process.setdefault(
                mapping.pam_process_id,
                [],
            ).append(
                {
                    "mapping_id": mapping.id,
                    "mapping_type": mapping.mapping_type,
                    "confidence": mapping.confidence,
                    "rationale": mapping.rationale,
                    "tenant_process": {
                        "id": tenant_process.id,
                        "code": tenant_process.code,
                        "name": tenant_process.name,
                    },
                }
            )

        return [
            {
                "pam_process": {
                    "id": pam_process.id,
                    "code": pam_process.code,
                    "name": pam_process.name,
                    "purpose": pam_process.purpose,
                    "description": pam_process.description,
                },
                "process_group": {
                    "id": process_group.id,
                    "code": process_group.code,
                    "name": process_group.name,
                },
                "process_category": {
                    "id": process_category.id,
                    "code": process_category.code,
                    "name": process_category.name,
                },
                "is_added": (
                    pam_process.id in added_process_ids
                ),
                "tenant_mappings": (
                    mappings_by_pam_process.get(
                        pam_process.id,
                        [],
                    )
                ),
            }
            for (
                pam_process,
                process_group,
                process_category,
            ) in catalog_rows
        ]

    @classmethod
    def list_capability_levels(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
    ):
        assessment = cls.get_assessment(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        context = cls.resolve_assessment_context(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        if (
            assessment.framework_model_id
            != context.pam_framework_model_id
        ):
            raise PamAssessmentConflictError(
                "Assessment PAM model does not match the resolved maturity context."
            )

        levels = (
            db.query(PamCapabilityLevel)
            .filter(
                PamCapabilityLevel.framework_model_id
                == context.capability_framework_model_id
            )
            .order_by(
                PamCapabilityLevel.sort_order.asc(),
                PamCapabilityLevel.level.asc(),
                PamCapabilityLevel.id.asc(),
            )
            .all()
        )

        return [
            {
                "id": item.id,
                "framework_model_id": item.framework_model_id,
                "level": item.level,
                "code": item.code,
                "name": item.name,
                "description": item.description,
                "sort_order": item.sort_order,
            }
            for item in levels
        ]


    @classmethod
    def list_rating_options(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
    ):
        assessment = cls.get_assessment(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        context = cls.resolve_assessment_context(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        if (
            assessment.framework_model_id
            != context.pam_framework_model_id
        ):
            raise PamAssessmentConflictError(
                "Assessment PAM model does not match the resolved maturity context."
            )

        options = (
            db.query(PamRatingOption)
            .filter(
                PamRatingOption.framework_model_id
                == context.capability_framework_model_id
            )
            .order_by(
                PamRatingOption.sort_order.asc(),
                PamRatingOption.id.asc(),
            )
            .all()
        )

        return [
            {
                "id": item.id,
                "framework_model_id": item.framework_model_id,
                "code": item.code,
                "name": item.name,
                "description": item.description,
                "numeric_value": item.numeric_value,
                "lower_bound": item.lower_bound,
                "upper_bound": item.upper_bound,
                "sort_order": item.sort_order,
            }
            for item in options
        ]


    @classmethod
    def _get_assessment_process_for_capability(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
    ):
        assessment = cls.get_assessment(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        context = cls.resolve_assessment_context(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        assessment_process = (
            db.query(PamAssessmentProcess)
            .filter(
                PamAssessmentProcess.id
                == assessment_process_id,
                PamAssessmentProcess.assessment_id
                == assessment.id,
            )
            .one_or_none()
        )

        if assessment_process is None:
            raise PamAssessmentNotFoundError(
                "PAM assessment process was not found for the assessment."
            )

        process = (
            db.query(PamProcess)
            .filter(
                PamProcess.id
                == assessment_process.pam_process_id,
                PamProcess.framework_model_id
                == context.pam_framework_model_id,
            )
            .one_or_none()
        )

        if process is None:
            raise PamAssessmentConflictError(
                "Assessment process is not part of the resolved PAM model."
            )

        return (
            assessment,
            context,
            assessment_process,
            process,
        )

    @classmethod
    def get_process_capability(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
    ):
        (
            assessment,
            context,
            assessment_process,
            process,
        ) = cls._get_assessment_process_for_capability(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
        )

        levels = (
            db.query(PamCapabilityLevel)
            .filter(
                PamCapabilityLevel.framework_model_id
                == context.capability_framework_model_id,
            )
            .order_by(
                PamCapabilityLevel.sort_order,
                PamCapabilityLevel.level,
                PamCapabilityLevel.id,
            )
            .all()
        )

        level_ids = [item.id for item in levels]

        attributes = []

        if level_ids:
            attributes = (
                db.query(PamProcessAttribute)
                .filter(
                    PamProcessAttribute.capability_level_id.in_(
                        level_ids
                    )
                )
                .order_by(
                    PamProcessAttribute.capability_level_id,
                    PamProcessAttribute.sort_order,
                    PamProcessAttribute.id,
                )
                .all()
            )

        evaluations = (
            db.query(PamProcessAttributeEvaluation)
            .filter(
                PamProcessAttributeEvaluation.assessment_process_id
                == assessment_process.id
            )
            .all()
        )

        evaluation_by_attribute = {
            item.process_attribute_id: item
            for item in evaluations
        }

        standard_attribute_rows = db.execute(
            text(
                """
                SELECT
                    spa.id,
                    spa.code
                FROM standard_process_attributes spa
                WHERE spa.standard_version_id = :standard_version_id
                """
            ),
            {
                "standard_version_id":
                    context.standard_version_id,
            },
        ).mappings().all()

        standard_attribute_by_code = {
            str(row["code"]): int(row["id"])
            for row in standard_attribute_rows
        }

        indicator_rows = db.execute(
            text(
                """
                SELECT
                    si.id,
                    si.process_attribute_id,
                    si.code,
                    si.name,
                    si.description,
                    si.indicator_type,
                    si.sort_order
                FROM standard_indicators si
                WHERE si.standard_version_id = :standard_version_id
                ORDER BY
                    si.process_attribute_id,
                    si.sort_order,
                    si.id
                """
            ),
            {
                "standard_version_id":
                    context.standard_version_id,
            },
        ).mappings().all()

        indicators_by_standard_attribute = {}

        for row in indicator_rows:
            standard_attribute_id = int(
                row["process_attribute_id"]
            )

            indicators_by_standard_attribute.setdefault(
                standard_attribute_id,
                [],
            ).append(
                {
                    "id": int(row["id"]),
                    "code": row["code"],
                    "name": row["name"],
                    "description": row["description"],
                    "indicator_type": row["indicator_type"],
                    "sort_order": row["sort_order"],
                }
            )

        attributes_by_level = {}

        for attribute in attributes:
            evaluation = evaluation_by_attribute.get(
                attribute.id
            )

            standard_attribute_id = (
                standard_attribute_by_code.get(
                    attribute.code
                )
            )

            attribute_payload = {
                "id": attribute.id,
                "capability_level_id":
                    attribute.capability_level_id,
                "code": attribute.code,
                "name": attribute.name,
                "description": attribute.description,
                "sort_order": attribute.sort_order,
                "standard_process_attribute_id":
                    standard_attribute_id,
                "achievement_indicators":
                    indicators_by_standard_attribute.get(
                        standard_attribute_id,
                        [],
                    )
                    if standard_attribute_id is not None
                    else [],
                "evaluation": (
                    {
                        "id": evaluation.id,
                        "rating": evaluation.rating,
                        "justification":
                            evaluation.justification,
                        "status": evaluation.status,
                        "evaluated_by":
                            evaluation.evaluated_by,
                        "evaluated_at":
                            evaluation.evaluated_at,
                        "created_at":
                            evaluation.created_at,
                        "updated_at":
                            evaluation.updated_at,
                    }
                    if evaluation is not None
                    else None
                ),
            }

            attributes_by_level.setdefault(
                attribute.capability_level_id,
                [],
            ).append(attribute_payload)

        capability_levels = []

        for level in levels:
            capability_levels.append(
                {
                    "id": level.id,
                    "framework_model_id":
                        level.framework_model_id,
                    "level": level.level,
                    "code": level.code,
                    "name": level.name,
                    "description": level.description,
                    "sort_order": level.sort_order,
                    "is_target": (
                        assessment_process.target_capability_level
                        is not None
                        and level.level
                        == assessment_process.target_capability_level
                    ),
                    "process_attributes":
                        attributes_by_level.get(
                            level.id,
                            [],
                        ),
                }
            )

        return {
            "assessment_id": assessment.id,
            "assessment_process_id":
                assessment_process.id,
            "pam_process_id": process.id,
            "process_code": process.code,
            "process_name": process.name,
            "target_capability_level":
                assessment_process.target_capability_level,
            "standard_id": context.standard_id,
            "standard_version_id":
                context.standard_version_id,
            "capability_framework_model_id":
                context.capability_framework_model_id,
            "capability_levels": capability_levels,
        }

    @classmethod
    def list_process_attribute_evaluations(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
    ):
        (
            _assessment,
            context,
            assessment_process,
            _process,
        ) = cls._get_assessment_process_for_capability(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
        )

        level_ids = [
            item.id
            for item in (
                db.query(PamCapabilityLevel)
                .filter(
                    PamCapabilityLevel.framework_model_id
                    == context.capability_framework_model_id
                )
                .all()
            )
        ]

        valid_attribute_ids = set()

        if level_ids:
            valid_attribute_ids = {
                item.id
                for item in (
                    db.query(PamProcessAttribute)
                    .filter(
                        PamProcessAttribute.capability_level_id.in_(
                            level_ids
                        )
                    )
                    .all()
                )
            }

        rows = (
            db.query(PamProcessAttributeEvaluation)
            .filter(
                PamProcessAttributeEvaluation.assessment_process_id
                == assessment_process.id,
                PamProcessAttributeEvaluation.audit_maturity_target_id
                .is_(None),
            )
            .order_by(
                PamProcessAttributeEvaluation.process_attribute_id,
                PamProcessAttributeEvaluation.id,
            )
            .all()
        )

        return [
            {
                "id": item.id,
                "assessment_process_id":
                    item.assessment_process_id,
                "process_attribute_id":
                    item.process_attribute_id,
                "rating": item.rating,
                "justification": item.justification,
                "status": item.status,
                "evaluated_by": item.evaluated_by,
                "evaluated_at": item.evaluated_at,
                "created_at": item.created_at,
                "updated_at": item.updated_at,
            }
            for item in rows
            if item.process_attribute_id
            in valid_attribute_ids
        ]

    @classmethod
    def upsert_process_attribute_evaluation(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
        process_attribute_id: int,
        evaluator_user_id: int,
        rating: str | None,
        justification: str | None,
        status: str,
    ):
        from datetime import datetime, timezone

        (
            _assessment,
            context,
            assessment_process,
            _process,
        ) = cls._get_assessment_process_for_capability(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
        )

        cls._validate_tenant_user(
            db,
            tenant_id=tenant_id,
            user_id=evaluator_user_id,
            field_name="evaluator_user_id",
        )

        attribute = (
            db.query(PamProcessAttribute)
            .join(
                PamCapabilityLevel,
                PamCapabilityLevel.id
                == PamProcessAttribute.capability_level_id,
            )
            .filter(
                PamProcessAttribute.id
                == process_attribute_id,
                PamCapabilityLevel.framework_model_id
                == context.capability_framework_model_id,
            )
            .one_or_none()
        )

        if attribute is None:
            raise PamAssessmentNotFoundError(
                "Process attribute is not part of the resolved capability model."
            )

        clean_rating = (
            rating.strip()
            if isinstance(rating, str)
            and rating.strip()
            else None
        )

        clean_status = (
            status.strip()
            if isinstance(status, str)
            else ""
        )

        if not clean_status:
            raise PamAssessmentError(
                "Process attribute evaluation status is required."
            )

        if clean_rating is not None and len(clean_rating) > 32:
            raise PamAssessmentError(
                "Process attribute evaluation rating exceeds 32 characters."
            )

        if clean_rating is not None:
            rating_option = (
                db.query(PamRatingOption)
                .filter(
                    PamRatingOption.framework_model_id
                    == context.capability_framework_model_id,
                    PamRatingOption.code
                    == clean_rating,
                )
                .one_or_none()
            )

            if rating_option is None:
                raise PamAssessmentConflictError(
                    "Process attribute evaluation rating is not defined "
                    "for the resolved capability model."
                )

        if len(clean_status) > 32:
            raise PamAssessmentError(
                "Process attribute evaluation status exceeds 32 characters."
            )

        evaluation = (
            db.query(PamProcessAttributeEvaluation)
            .filter(
                PamProcessAttributeEvaluation.assessment_process_id
                == assessment_process.id,
                PamProcessAttributeEvaluation.process_attribute_id
                == attribute.id,
                PamProcessAttributeEvaluation.audit_maturity_target_id
                .is_(None),
            )
            .one_or_none()
        )

        now = datetime.now(timezone.utc)

        if evaluation is None:
            evaluation = PamProcessAttributeEvaluation(
                assessment_process_id=
                    assessment_process.id,
                process_attribute_id=attribute.id,
                rating=clean_rating,
                justification=justification,
                status=clean_status,
                evaluated_by=evaluator_user_id,
                evaluated_at=now,
            )
            db.add(evaluation)
        else:
            evaluation.rating = clean_rating
            evaluation.justification = justification
            evaluation.status = clean_status
            evaluation.evaluated_by = evaluator_user_id
            evaluation.evaluated_at = now

        db.flush()
        db.refresh(evaluation)

        return {
            "id": evaluation.id,
            "assessment_process_id":
                evaluation.assessment_process_id,
            "process_attribute_id":
                evaluation.process_attribute_id,
            "rating": evaluation.rating,
            "justification": evaluation.justification,
            "status": evaluation.status,
            "evaluated_by": evaluation.evaluated_by,
            "evaluated_at": evaluation.evaluated_at,
            "created_at": evaluation.created_at,
            "updated_at": evaluation.updated_at,
        }

    @classmethod
    def get_process_workspace(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
    ):
        assessment = cls.get_assessment(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        context = cls.resolve_assessment_context(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        assessment_process = (
            db.query(PamAssessmentProcess)
            .filter(
                PamAssessmentProcess.id
                == assessment_process_id,
                PamAssessmentProcess.assessment_id
                == assessment.id,
            )
            .one_or_none()
        )

        if assessment_process is None:
            raise PamAssessmentNotFoundError(
                "PAM assessment process was not found for the assessment."
            )

        process = (
            db.query(PamProcess)
            .filter(
                PamProcess.id
                == assessment_process.pam_process_id,
                PamProcess.framework_model_id
                == context.pam_framework_model_id,
            )
            .one_or_none()
        )

        if process is None:
            raise PamAssessmentConflictError(
                "Assessment process does not belong to the resolved PAM model."
            )

        outcomes = (
            db.query(PamProcessOutcome)
            .filter(
                PamProcessOutcome.process_id
                == process.id
            )
            .order_by(
                PamProcessOutcome.sort_order.asc(),
                PamProcessOutcome.id.asc(),
            )
            .all()
        )

        base_practices = (
            db.query(PamBasePractice)
            .filter(
                PamBasePractice.process_id
                == process.id
            )
            .order_by(
                PamBasePractice.sort_order.asc(),
                PamBasePractice.id.asc(),
            )
            .all()
        )

        work_product_rows = (
            db.query(
                PamProcessWorkProduct,
                PamWorkProduct,
            )
            .join(
                PamWorkProduct,
                PamWorkProduct.id
                == PamProcessWorkProduct.work_product_id,
            )
            .filter(
                PamProcessWorkProduct.process_id
                == process.id,
                PamWorkProduct.framework_model_id
                == context.pam_framework_model_id,
            )
            .order_by(
                PamProcessWorkProduct.sort_order.asc(),
                PamProcessWorkProduct.id.asc(),
            )
            .all()
        )

        capability_query = (
            db.query(PamCapabilityLevel)
            .filter(
                PamCapabilityLevel.framework_model_id
                == context.capability_framework_model_id
            )
        )

        if assessment_process.target_capability_level is not None:
            capability_query = capability_query.filter(
                PamCapabilityLevel.level
                <= assessment_process.target_capability_level
            )

        capability_levels = (
            capability_query
            .order_by(
                PamCapabilityLevel.sort_order.asc(),
                PamCapabilityLevel.level.asc(),
                PamCapabilityLevel.id.asc(),
            )
            .all()
        )

        capability_level_ids = [
            item.id
            for item in capability_levels
        ]

        if capability_level_ids:
            attributes = (
                db.query(PamProcessAttribute)
                .filter(
                    PamProcessAttribute.capability_level_id.in_(
                        capability_level_ids
                    )
                )
                .order_by(
                    PamProcessAttribute.sort_order.asc(),
                    PamProcessAttribute.id.asc(),
                )
                .all()
            )
        else:
            attributes = []

        standard_code = context.standard_code
        version_code = context.version_code

        localized_outcomes = {}

        for item in outcomes:
            localized = PamContentResolver.process_outcome(
                standard_code=standard_code,
                version_code=version_code,
                language="en",
                process_code=process.code,
                outcome_code=item.code,
            )

            if localized is not None:
                localized_outcomes[item.id] = localized

        localized_base_practices = {}

        for item in base_practices:
            localized = PamContentResolver.base_practice(
                standard_code=standard_code,
                version_code=version_code,
                language="en",
                process_code=process.code,
                practice_code=item.code,
            )

            if localized is not None:
                localized_base_practices[item.id] = localized

        localized_work_products = {}

        for link, product in work_product_rows:
            localized = PamContentResolver.work_product(
                standard_code=standard_code,
                version_code=version_code,
                language="en",
                process_code=process.code,
                work_product_code=product.code,
            )

            if localized is not None:
                localized_work_products[product.id] = localized

        attributes_by_level = {}

        for attribute in attributes:
            attributes_by_level.setdefault(
                attribute.capability_level_id,
                [],
            ).append(
                {
                    "id": attribute.id,
                    "code": attribute.code,
                    "name": attribute.name,
                    "description": attribute.description,
                    "sort_order": attribute.sort_order,
                }
            )

        return {
            "assessment_process": {
                "id": assessment_process.id,
                "assessment_id": assessment_process.assessment_id,
                "pam_process_id": assessment_process.pam_process_id,
                "tenant_process_id": assessment_process.tenant_process_id,
                "in_scope": assessment_process.in_scope,
                "target_capability_level": (
                    assessment_process.target_capability_level
                ),
                "status": assessment_process.status,
            },
            "process": {
                "id": process.id,
                "code": process.code,
                "name": process.name,
                "purpose": process.purpose,
                "description": process.description,
            },
            "outcomes": [
                {
                    "id": item.id,
                    "code": item.code,
                    "text": item.text,
                    "localized_text": (
                        localized_outcomes.get(item.id, {}).get("text")
                    ),
                    "content_language": (
                        "en"
                        if localized_outcomes.get(item.id, {}).get("text")
                        else None
                    ),
                    "content_origin": (
                        "localized"
                        if localized_outcomes.get(item.id, {}).get("text")
                        else None
                    ),
                    "source_language": (
                        "tr"
                        if localized_outcomes.get(item.id, {}).get("text")
                        else None
                    ),
                    "sort_order": item.sort_order,
                }
                for item in outcomes
            ],
            "base_practices": [
                {
                    "id": item.id,
                    "code": item.code,
                    "text": item.text,
                    "guidance": item.guidance,
                    "localized_title": (
                        localized_base_practices.get(item.id, {}).get("title")
                    ),
                    "localized_description": (
                        localized_base_practices.get(item.id, {}).get(
                            "description"
                        )
                    ),
                    "content_language": (
                        "en"
                        if localized_base_practices.get(item.id, {}).get(
                            "title"
                        )
                        else None
                    ),
                    "content_origin": (
                        "localized"
                        if localized_base_practices.get(item.id, {}).get(
                            "title"
                        )
                        else None
                    ),
                    "source_language": (
                        "tr"
                        if localized_base_practices.get(item.id, {}).get(
                            "title"
                        )
                        else None
                    ),
                    "sort_order": item.sort_order,
                }
                for item in base_practices
            ],
            "work_products": [
                {
                    "link_id": link.id,
                    "id": product.id,
                    "code": product.code,
                    "name": product.name,
                    "description": product.description,
                    "localized_title": (
                        localized_work_products.get(product.id, {}).get(
                            "title"
                        )
                    ),
                    "localized_description": (
                        localized_work_products.get(product.id, {}).get(
                            "description"
                        )
                    ),
                    "content_language": (
                        "en"
                        if localized_work_products.get(product.id, {}).get(
                            "title"
                        )
                        else None
                    ),
                    "content_origin": (
                        "localized"
                        if localized_work_products.get(product.id, {}).get(
                            "title"
                        )
                        else None
                    ),
                    "source_language": (
                        "tr"
                        if localized_work_products.get(product.id, {}).get(
                            "title"
                        )
                        else None
                    ),
                    "characteristics": product.characteristics,
                    "direction": link.direction,
                    "sort_order": link.sort_order,
                }
                for link, product in work_product_rows
            ],
            "capability_levels": [
                {
                    "id": level.id,
                    "level": level.level,
                    "code": level.code,
                    "name": level.name,
                    "description": level.description,
                    "sort_order": level.sort_order,
                    "process_attributes": (
                        attributes_by_level.get(
                            level.id,
                            [],
                        )
                    ),
                }
                for level in capability_levels
            ],
        }

    @classmethod
    def list_base_practice_evaluations(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
    ):
        workspace = cls.get_process_workspace(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
        )

        practice_ids = [
            item["id"]
            for item in workspace["base_practices"]
        ]

        if not practice_ids:
            return []

        rows = (
            db.query(PamIndicatorEvaluation)
            .filter(
                PamIndicatorEvaluation.assessment_process_id
                == assessment_process_id,
                PamIndicatorEvaluation.indicator_type
                == "BASE_PRACTICE",
                PamIndicatorEvaluation.base_practice_id.in_(
                    practice_ids
                ),
            )
            .all()
        )

        by_practice = {
            row.base_practice_id: row
            for row in rows
        }

        result = []

        for practice in workspace["base_practices"]:
            evaluation = by_practice.get(
                practice["id"]
            )

            result.append(
                {
                    "base_practice_id": practice["id"],
                    "code": practice["code"],
                    "text": practice["text"],
                    "guidance": practice["guidance"],
                    "sort_order": practice["sort_order"],
                    "evaluation_id": (
                        evaluation.id
                        if evaluation
                        else None
                    ),
                    "rating": (
                        evaluation.rating
                        if evaluation
                        else None
                    ),
                    "observation": (
                        evaluation.observation
                        if evaluation
                        else None
                    ),
                    "justification": (
                        evaluation.justification
                        if evaluation
                        else None
                    ),
                    "status": (
                        evaluation.status
                        if evaluation
                        else "not_assessed"
                    ),
                    "evaluator_user_id": (
                        evaluation.evaluator_user_id
                        if evaluation
                        else None
                    ),
                    "evaluated_at": (
                        evaluation.evaluated_at
                        if evaluation
                        else None
                    ),
                }
            )

        return result

    @classmethod
    def upsert_base_practice_evaluation(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
        base_practice_id: int,
        rating: str | None = None,
        observation: str | None = None,
        justification: str | None = None,
        status: str = "not_assessed",
        evaluator_user_id: int | None = None,
        commit: bool = True,
    ):
        workspace = cls.get_process_workspace(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
        )

        valid_practice_ids = {
            item["id"]
            for item in workspace["base_practices"]
        }

        if base_practice_id not in valid_practice_ids:
            raise PamAssessmentConflictError(
                "Base practice does not belong to the assessment process."
            )

        if evaluator_user_id is not None:
            cls._validate_tenant_user(
                db,
                tenant_id=tenant_id,
                user_id=evaluator_user_id,
                field_name="Evaluator user",
            )

        evaluation = (
            db.query(PamIndicatorEvaluation)
            .filter(
                PamIndicatorEvaluation.assessment_process_id
                == assessment_process_id,
                PamIndicatorEvaluation.indicator_type
                == "BASE_PRACTICE",
                PamIndicatorEvaluation.base_practice_id
                == base_practice_id,
            )
            .one_or_none()
        )

        if evaluation is None:
            evaluation = PamIndicatorEvaluation(
                assessment_process_id=assessment_process_id,
                indicator_type="BASE_PRACTICE",
                base_practice_id=base_practice_id,
                work_product_id=None,
                generic_practice_id=None,
                generic_resource_id=None,
                generic_work_product_id=None,
                rating=rating,
                observation=observation,
                justification=justification,
                status=status,
                evaluator_user_id=evaluator_user_id,
            )

            db.add(evaluation)

        else:
            evaluation.rating = rating
            evaluation.observation = observation
            evaluation.justification = justification
            evaluation.status = status
            evaluation.evaluator_user_id = (
                evaluator_user_id
            )

        db.flush()

        if commit:
            db.commit()
            db.refresh(evaluation)

        return evaluation


    @classmethod
    def update_process_target_capability(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
        target_capability_level: Optional[int],
        commit: bool = True,
    ) -> PamAssessmentProcess:
        assessment = cls.get_assessment(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        context = cls.resolve_assessment_context(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment.id,
        )

        assessment_process = (
            db.query(PamAssessmentProcess)
            .filter(
                PamAssessmentProcess.id
                == assessment_process_id,
                PamAssessmentProcess.assessment_id
                == assessment.id,
            )
            .one_or_none()
        )

        if assessment_process is None:
            raise PamAssessmentNotFoundError(
                "Assessment process not found."
            )

        if target_capability_level is not None:
            capability_level = (
                db.query(PamCapabilityLevel)
                .filter(
                    PamCapabilityLevel.framework_model_id
                    == context.capability_framework_model_id,
                    PamCapabilityLevel.level
                    == target_capability_level,
                )
                .one_or_none()
            )

            if capability_level is None:
                raise PamAssessmentConflictError(
                    "Target capability level is not defined "
                    "by the canonical capability model."
                )

        assessment_process.target_capability_level = (
            target_capability_level
        )

        if commit:
            db.commit()
            db.refresh(assessment_process)

        return assessment_process


    @classmethod
    def add_process(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        pam_process_id: int,
        tenant_process_id: Optional[int] = None,
        in_scope: bool = True,
        target_capability_level: Optional[int] = None,
        commit: bool = True,
    ) -> PamAssessmentProcess:
        assessment = cls.get_assessment(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        context = cls.resolve_assessment_context(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        pam_process = (
            db.query(PamProcess)
            .filter(
                PamProcess.id == pam_process_id,
                PamProcess.framework_model_id
                == context.framework_model_id,
            )
            .one_or_none()
        )

        if pam_process is None:
            raise PamAssessmentNotFoundError(
                "PAM process was not found in the assessment framework model."
            )

        existing = (
            db.query(PamAssessmentProcess)
            .filter(
                PamAssessmentProcess.assessment_id
                == assessment.id,
                PamAssessmentProcess.pam_process_id
                == pam_process.id,
            )
            .one_or_none()
        )

        if existing is not None:
            raise PamAssessmentConflictError(
                "PAM process is already included in the assessment."
            )

        if tenant_process_id is not None:
            tenant_process = (
                db.query(Process)
                .filter(
                    Process.id == tenant_process_id,
                    Process.tenant_id == tenant_id,
                )
                .one_or_none()
            )

            if tenant_process is None:
                raise PamAssessmentNotFoundError(
                    "Tenant process was not found for the tenant."
                )

            adoption_scope = (
                db.query(FrameworkAdoptionScope)
                .filter(
                    FrameworkAdoptionScope.adoption_id
                    == context.framework_adoption_id,
                    FrameworkAdoptionScope.process_id
                    == tenant_process_id,
                )
                .one_or_none()
            )

            if adoption_scope is None:
                raise PamAssessmentConflictError(
                    "Tenant process is not included in the framework adoption scope."
                )

            mapping = (
                db.query(ProcessPamMapping)
                .filter(
                    ProcessPamMapping.framework_adoption_id
                    == context.framework_adoption_id,
                    ProcessPamMapping.process_id
                    == tenant_process_id,
                    ProcessPamMapping.pam_process_id
                    == pam_process.id,
                )
                .one_or_none()
            )

            if mapping is None:
                raise PamAssessmentConflictError(
                    "Tenant process is not mapped to the PAM process for this framework adoption."
                )

        if target_capability_level is not None:
            capability_level = (
                db.query(PamCapabilityLevel)
                .filter(
                    PamCapabilityLevel.framework_model_id
                    == context.capability_framework_model_id,
                    PamCapabilityLevel.level
                    == target_capability_level,
                )
                .one_or_none()
            )

            if capability_level is None:
                raise PamAssessmentConflictError(
                    "Target capability level is not defined by the canonical capability model."
                )

        item = PamAssessmentProcess(
            assessment_id=assessment.id,
            tenant_process_id=tenant_process_id,
            pam_process_id=pam_process.id,
            in_scope=bool(in_scope),
            target_capability_level=target_capability_level,
            status=cls.DEFAULT_PROCESS_STATUS,
        )

        db.add(item)

        if commit:
            db.commit()
            db.refresh(item)
        else:
            db.flush()

        return item


    @classmethod
    def _resolve_performance_runtime_context(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
        process_attribute_id: int,
    ):
        from sqlalchemy import text
        from app.models.pam_runtime import (
            PamCapabilityLevel,
            PamProcessAttribute,
        )

        (
            assessment,
            context,
            assessment_process,
            process,
        ) = cls._get_assessment_process_for_capability(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
        )

        attribute = (
            db.query(PamProcessAttribute)
            .join(
                PamCapabilityLevel,
                PamCapabilityLevel.id
                == PamProcessAttribute.capability_level_id,
            )
            .filter(
                PamProcessAttribute.id
                == process_attribute_id,
                PamCapabilityLevel.framework_model_id
                == context.capability_framework_model_id,
            )
            .one_or_none()
        )

        if attribute is None:
            raise PamAssessmentNotFoundError(
                "Process attribute is not part of the resolved capability model."
            )

        standard_attribute = db.execute(
            text(
                """
                SELECT
                    spa.id,
                    spa.code
                FROM standard_process_attributes spa
                WHERE spa.standard_version_id = :standard_version_id
                  AND spa.code = :attribute_code
                """
            ),
            {
                "standard_version_id":
                    context.standard_version_id,
                "attribute_code": attribute.code,
            },
        ).mappings().one_or_none()

        if standard_attribute is None:
            raise PamAssessmentConflictError(
                "Standard process attribute mapping was not found."
            )

        return (
            assessment,
            context,
            assessment_process,
            process,
            attribute,
            standard_attribute,
        )

    @classmethod
    def _validate_performance_indicator(
        cls,
        db: Session,
        *,
        context,
        standard_attribute,
        standard_indicator_id: int | None,
    ):
        from sqlalchemy import text

        if standard_indicator_id is None:
            return None

        indicator = db.execute(
            text(
                """
                SELECT
                    si.id,
                    si.standard_version_id,
                    si.process_attribute_id,
                    si.code,
                    si.name,
                    si.description,
                    si.indicator_type,
                    si.sort_order
                FROM standard_indicators si
                WHERE si.id = :indicator_id
                  AND si.standard_version_id = :standard_version_id
                  AND si.process_attribute_id = :process_attribute_id
                """
            ),
            {
                "indicator_id": standard_indicator_id,
                "standard_version_id":
                    context.standard_version_id,
                "process_attribute_id":
                    standard_attribute["id"],
            },
        ).mappings().one_or_none()

        if indicator is None:
            raise PamAssessmentConflictError(
                "Standard indicator does not belong to the selected process attribute and standard version."
            )

        return dict(indicator)

    @classmethod
    def _serialize_performance_objective(
        cls,
        objective,
        *,
        indicator=None,
        measurements=None,
    ):
        measurement_rows = measurements or []

        latest = (
            measurement_rows[0]
            if measurement_rows
            else None
        )

        return {
            "id": objective.id,
            "tenant_id": objective.tenant_id,
            "assessment_process_id":
                objective.assessment_process_id,
            "process_attribute_id":
                objective.process_attribute_id,
            "standard_indicator_id":
                objective.standard_indicator_id,
            "standard_indicator": indicator,
            "code": objective.code,
            "title": objective.title,
            "description": objective.description,
            "measurement_method":
                objective.measurement_method,
            "unit": objective.unit,
            "target_value": (
                float(objective.target_value)
                if objective.target_value is not None
                else None
            ),
            "direction": objective.direction,
            "owner_user_id": objective.owner_user_id,
            "status": objective.status,
            "created_by": objective.created_by,
            "created_at": objective.created_at,
            "updated_at": objective.updated_at,
            "measurement_count":
                len(measurement_rows),
            "latest_measurement": latest,
        }

    @classmethod
    def _serialize_performance_measurement(
        cls,
        measurement,
    ):
        return {
            "id": measurement.id,
            "objective_id": measurement.objective_id,
            "period_start": measurement.period_start,
            "period_end": measurement.period_end,
            "measured_value": (
                float(measurement.measured_value)
                if measurement.measured_value is not None
                else None
            ),
            "target_value_snapshot": (
                float(measurement.target_value_snapshot)
                if measurement.target_value_snapshot
                is not None
                else None
            ),
            "variance": (
                float(measurement.variance)
                if measurement.variance is not None
                else None
            ),
            "achievement_result":
                measurement.achievement_result,
            "measurement_source":
                measurement.measurement_source,
            "evidence_id": measurement.evidence_id,
            "measured_by": measurement.measured_by,
            "measured_at": measurement.measured_at,
            "note": measurement.note,
            "created_at": measurement.created_at,
        }

    @classmethod
    def list_performance_objectives(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
        process_attribute_id: int | None = None,
    ):
        from sqlalchemy import text
        from app.models.pam_runtime import (
            PamProcessPerformanceMeasurement,
            PamProcessPerformanceObjective,
        )

        (
            _assessment,
            context,
            assessment_process,
            _process,
        ) = cls._get_assessment_process_for_capability(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
        )

        query = (
            db.query(PamProcessPerformanceObjective)
            .filter(
                PamProcessPerformanceObjective.tenant_id
                == tenant_id,
                PamProcessPerformanceObjective.assessment_process_id
                == assessment_process.id,
            )
        )

        if process_attribute_id is not None:
            cls._resolve_performance_runtime_context(
                db,
                tenant_id=tenant_id,
                assessment_id=assessment_id,
                assessment_process_id=
                    assessment_process_id,
                process_attribute_id=
                    process_attribute_id,
            )

            query = query.filter(
                PamProcessPerformanceObjective.process_attribute_id
                == process_attribute_id
            )

        rows = (
            query
            .order_by(
                PamProcessPerformanceObjective.id
            )
            .all()
        )

        result = []

        for objective in rows:
            indicator = None

            if objective.standard_indicator_id is not None:
                indicator_row = db.execute(
                    text(
                        """
                        SELECT
                            id,
                            code,
                            name,
                            description,
                            indicator_type,
                            sort_order
                        FROM standard_indicators
                        WHERE id = :indicator_id
                          AND standard_version_id =
                              :standard_version_id
                        """
                    ),
                    {
                        "indicator_id":
                            objective.standard_indicator_id,
                        "standard_version_id":
                            context.standard_version_id,
                    },
                ).mappings().one_or_none()

                if indicator_row is not None:
                    indicator = dict(indicator_row)

            measurement_models = (
                db.query(
                    PamProcessPerformanceMeasurement
                )
                .filter(
                    PamProcessPerformanceMeasurement.objective_id
                    == objective.id
                )
                .order_by(
                    PamProcessPerformanceMeasurement.measured_at.desc(),
                    PamProcessPerformanceMeasurement.id.desc(),
                )
                .all()
            )

            measurements = [
                cls._serialize_performance_measurement(
                    item
                )
                for item in measurement_models
            ]

            result.append(
                cls._serialize_performance_objective(
                    objective,
                    indicator=indicator,
                    measurements=measurements,
                )
            )

        return result

    @classmethod
    def create_performance_objective(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
        process_attribute_id: int,
        standard_indicator_id: int | None,
        title: str,
        description: str | None,
        measurement_method: str | None,
        unit: str | None,
        target_value,
        direction: str | None,
        owner_user_id: int | None,
        status: str,
        created_by: int,
        commit: bool = True,
    ):
        from decimal import Decimal
        from app.models.pam_runtime import (
            PamProcessPerformanceObjective,
        )

        (
            _assessment,
            context,
            assessment_process,
            _process,
            _attribute,
            standard_attribute,
        ) = cls._resolve_performance_runtime_context(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
            process_attribute_id=process_attribute_id,
        )

        indicator = cls._validate_performance_indicator(
            db,
            context=context,
            standard_attribute=standard_attribute,
            standard_indicator_id=standard_indicator_id,
        )

        cls._validate_tenant_user(
            db,
            tenant_id=tenant_id,
            user_id=owner_user_id,
            field_name="owner_user_id",
        )

        cls._validate_tenant_user(
            db,
            tenant_id=tenant_id,
            user_id=created_by,
            field_name="created_by",
        )

        clean_title = title.strip()

        if not clean_title:
            raise PamAssessmentConflictError(
                "Objective title is required."
            )

        clean_direction = (
            direction.strip().upper()
            if isinstance(direction, str)
            and direction.strip()
            else None
        )

        valid_directions = {
            "AT_LEAST",
            "AT_MOST",
            "EXACT",
        }

        if (
            clean_direction is not None
            and clean_direction not in valid_directions
        ):
            raise PamAssessmentConflictError(
                "Direction must be AT_LEAST, AT_MOST, or EXACT."
            )

        if (
            target_value is not None
            and clean_direction is None
        ):
            raise PamAssessmentConflictError(
                "Direction is required when target_value is defined."
            )

        sequence_name = db.execute(
            text(
                """
                SELECT pg_get_serial_sequence(
                    'pam_process_performance_objectives',
                    'id'
                )
                """
            )
        ).scalar_one()

        if not sequence_name:
            raise PamAssessmentConflictError(
                "Performance objective sequence is unavailable."
            )

        objective_id = db.execute(
            text(
                "SELECT nextval("
                "CAST(:sequence_name AS regclass)"
                ")"
            ),
            {
                "sequence_name": sequence_name,
            },
        ).scalar_one()

        system_code = (
            f"PPO-{int(objective_id):06d}"
        )

        objective = PamProcessPerformanceObjective(
            id=int(objective_id),
            tenant_id=tenant_id,
            assessment_process_id=
                assessment_process.id,
            process_attribute_id=
                process_attribute_id,
            standard_indicator_id=
                standard_indicator_id,
            code=system_code,
            title=clean_title,
            description=description,
            measurement_method=measurement_method,
            unit=unit,
            target_value=(
                Decimal(str(target_value))
                if target_value is not None
                else None
            ),
            direction=clean_direction,
            owner_user_id=owner_user_id,
            status=status.strip(),
            created_by=created_by,
        )

        db.add(objective)
        db.flush()

        result = cls._serialize_performance_objective(
            objective,
            indicator=indicator,
            measurements=[],
        )

        if commit:
            db.commit()

        return result

    @classmethod
    def update_performance_objective(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
        objective_id: int,
        payload: dict,
        commit: bool = True,
    ):
        from decimal import Decimal
        from app.models.pam_runtime import (
            PamProcessPerformanceObjective,
        )

        (
            _assessment,
            context,
            assessment_process,
            _process,
        ) = cls._get_assessment_process_for_capability(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
        )

        objective = (
            db.query(PamProcessPerformanceObjective)
            .filter(
                PamProcessPerformanceObjective.id
                == objective_id,
                PamProcessPerformanceObjective.tenant_id
                == tenant_id,
                PamProcessPerformanceObjective.assessment_process_id
                == assessment_process.id,
            )
            .one_or_none()
        )

        if objective is None:
            raise PamAssessmentNotFoundError(
                "Performance objective was not found."
            )

        (
            _a,
            _c,
            _ap,
            _p,
            _attribute,
            standard_attribute,
        ) = cls._resolve_performance_runtime_context(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
            process_attribute_id=
                objective.process_attribute_id,
        )

        if "standard_indicator_id" in payload:
            indicator = cls._validate_performance_indicator(
                db,
                context=context,
                standard_attribute=standard_attribute,
                standard_indicator_id=
                    payload["standard_indicator_id"],
            )
            objective.standard_indicator_id = (
                payload["standard_indicator_id"]
            )
        else:
            indicator = cls._validate_performance_indicator(
                db,
                context=context,
                standard_attribute=standard_attribute,
                standard_indicator_id=
                    objective.standard_indicator_id,
            )

        if "owner_user_id" in payload:
            cls._validate_tenant_user(
                db,
                tenant_id=tenant_id,
                user_id=payload["owner_user_id"],
                field_name="owner_user_id",
            )
            objective.owner_user_id = (
                payload["owner_user_id"]
            )

        if "title" in payload:
            clean_title = payload["title"].strip()

            if not clean_title:
                raise PamAssessmentConflictError(
                    "Objective title is required."
                )

            objective.title = clean_title

        for field_name in (
            "description",
            "measurement_method",
            "unit",
            "status",
        ):
            if field_name in payload:
                setattr(
                    objective,
                    field_name,
                    payload[field_name],
                )

        if "target_value" in payload:
            objective.target_value = (
                Decimal(str(payload["target_value"]))
                if payload["target_value"] is not None
                else None
            )

        if "direction" in payload:
            raw_direction = payload["direction"]

            objective.direction = (
                raw_direction.strip().upper()
                if isinstance(raw_direction, str)
                and raw_direction.strip()
                else None
            )

        if objective.direction not in {
            None,
            "AT_LEAST",
            "AT_MOST",
            "EXACT",
        }:
            raise PamAssessmentConflictError(
                "Direction must be AT_LEAST, AT_MOST, or EXACT."
            )

        if (
            objective.target_value is not None
            and objective.direction is None
        ):
            raise PamAssessmentConflictError(
                "Direction is required when target_value is defined."
            )

        db.flush()

        result = cls._serialize_performance_objective(
            objective,
            indicator=indicator,
            measurements=[],
        )

        if commit:
            db.commit()

        return result

    @classmethod
    def list_performance_measurements(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
        objective_id: int,
    ):
        from app.models.pam_runtime import (
            PamProcessPerformanceMeasurement,
            PamProcessPerformanceObjective,
        )

        (
            _assessment,
            _context,
            assessment_process,
            _process,
        ) = cls._get_assessment_process_for_capability(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
        )

        objective = (
            db.query(PamProcessPerformanceObjective)
            .filter(
                PamProcessPerformanceObjective.id
                == objective_id,
                PamProcessPerformanceObjective.tenant_id
                == tenant_id,
                PamProcessPerformanceObjective.assessment_process_id
                == assessment_process.id,
            )
            .one_or_none()
        )

        if objective is None:
            raise PamAssessmentNotFoundError(
                "Performance objective was not found."
            )

        rows = (
            db.query(PamProcessPerformanceMeasurement)
            .filter(
                PamProcessPerformanceMeasurement.objective_id
                == objective.id
            )
            .order_by(
                PamProcessPerformanceMeasurement.measured_at.desc(),
                PamProcessPerformanceMeasurement.id.desc(),
            )
            .all()
        )

        return [
            cls._serialize_performance_measurement(row)
            for row in rows
        ]

    @classmethod
    def add_performance_measurement(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
        objective_id: int,
        period_start,
        period_end,
        measured_value,
        measurement_source: str | None,
        evidence_id: int | None,
        measured_by: int,
        note: str | None,
        commit: bool = True,
    ):
        from datetime import date, datetime, timezone
        from decimal import Decimal
        from sqlalchemy import text
        from app.models.pam_runtime import (
            PamProcessPerformanceMeasurement,
            PamProcessPerformanceObjective,
        )

        (
            _assessment,
            context,
            assessment_process,
            _process,
        ) = cls._get_assessment_process_for_capability(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
        )

        objective = (
            db.query(PamProcessPerformanceObjective)
            .filter(
                PamProcessPerformanceObjective.id
                == objective_id,
                PamProcessPerformanceObjective.tenant_id
                == tenant_id,
                PamProcessPerformanceObjective.assessment_process_id
                == assessment_process.id,
            )
            .one_or_none()
        )

        if objective is None:
            raise PamAssessmentNotFoundError(
                "Performance objective was not found."
            )

        cls._validate_tenant_user(
            db,
            tenant_id=tenant_id,
            user_id=measured_by,
            field_name="measured_by",
        )

        def parse_date(value, field_name):
            if value is None:
                return None

            if isinstance(value, date):
                return value

            try:
                return date.fromisoformat(
                    str(value)
                )
            except ValueError as exc:
                raise PamAssessmentConflictError(
                    field_name
                    + " must use YYYY-MM-DD."
                ) from exc

        start_date = parse_date(
            period_start,
            "period_start",
        )

        end_date = parse_date(
            period_end,
            "period_end",
        )

        if (
            start_date is not None
            and end_date is not None
            and end_date < start_date
        ):
            raise PamAssessmentConflictError(
                "period_end cannot be earlier than period_start."
            )

        if evidence_id is not None:
            evidence = db.execute(
                text(
                    """
                    SELECT
                        id,
                        tenant_id,
                        standard_id,
                        standard_version_id,
                        assessment_type,
                        is_deleted
                    FROM evidences
                    WHERE id = :evidence_id
                      AND tenant_id = :tenant_id
                    """
                ),
                {
                    "evidence_id": evidence_id,
                    "tenant_id": tenant_id,
                },
            ).mappings().one_or_none()

            if evidence is None:
                raise PamAssessmentNotFoundError(
                    "Evidence was not found for the assessment tenant."
                )

            if bool(evidence["is_deleted"]):
                raise PamAssessmentConflictError(
                    "Deleted evidence cannot be linked to a performance measurement."
                )

            if (
                int(evidence["standard_id"])
                != int(context.standard_id)
                or int(evidence["standard_version_id"])
                != int(context.standard_version_id)
            ):
                raise PamAssessmentConflictError(
                    "Evidence standard context does not match the maturity assessment."
                )

            if (
                str(evidence["assessment_type"]).lower()
                != "maturity"
            ):
                raise PamAssessmentConflictError(
                    "Performance measurement evidence must be maturity evidence."
                )

        actual = Decimal(str(measured_value))

        target = (
            Decimal(str(objective.target_value))
            if objective.target_value is not None
            else None
        )

        variance = (
            actual - target
            if target is not None
            else None
        )

        achievement_result = None

        if target is not None:
            if objective.direction == "AT_LEAST":
                achieved = actual >= target
            elif objective.direction == "AT_MOST":
                achieved = actual <= target
            elif objective.direction == "EXACT":
                achieved = actual == target
            else:
                raise PamAssessmentConflictError(
                    "Objective direction is required before measurement evaluation."
                )

            achievement_result = (
                "MET"
                if achieved
                else "NOT_MET"
            )

        measurement = PamProcessPerformanceMeasurement(
            objective_id=objective.id,
            period_start=start_date,
            period_end=end_date,
            measured_value=actual,
            target_value_snapshot=target,
            variance=variance,
            achievement_result=achievement_result,
            measurement_source=measurement_source,
            evidence_id=evidence_id,
            measured_by=measured_by,
            measured_at=datetime.now(timezone.utc),
            note=note,
        )

        db.add(measurement)
        db.flush()

        result = cls._serialize_performance_measurement(
            measurement
        )

        if commit:
            db.commit()

        return result

    @classmethod
    def get_evidence_coverage(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
    ):
        assessment = cls.get_assessment(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        context = cls.resolve_assessment_context(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        process_rows = (
            db.query(PamAssessmentProcess, PamProcess)
            .join(
                PamProcess,
                PamProcess.id == PamAssessmentProcess.pam_process_id,
            )
            .filter(
                PamAssessmentProcess.assessment_id == assessment.id,
                PamProcess.framework_model_id
                == context.pam_framework_model_id,
            )
            .order_by(
                PamProcess.code.asc(),
                PamAssessmentProcess.id.asc(),
            )
            .all()
        )

        if not process_rows:
            return {
                "assessment_id": assessment.id,
                "processes": [],
                "evidence_references": [],
            }

        assessment_process_ids = [
            assessment_process.id
            for assessment_process, _ in process_rows
        ]

        process_ids = [
            process.id
            for _, process in process_rows
        ]

        base_practices = (
            db.query(PamBasePractice)
            .filter(PamBasePractice.process_id.in_(process_ids))
            .order_by(
                PamBasePractice.process_id.asc(),
                PamBasePractice.sort_order.asc(),
                PamBasePractice.id.asc(),
            )
            .all()
        )

        work_product_rows = (
            db.query(
                PamProcessWorkProduct,
                PamWorkProduct,
            )
            .join(
                PamWorkProduct,
                PamWorkProduct.id
                == PamProcessWorkProduct.work_product_id,
            )
            .filter(
                PamProcessWorkProduct.process_id.in_(process_ids),
                PamWorkProduct.framework_model_id
                == context.pam_framework_model_id,
            )
            .order_by(
                PamProcessWorkProduct.process_id.asc(),
                PamProcessWorkProduct.sort_order.asc(),
                PamProcessWorkProduct.id.asc(),
            )
            .all()
        )

        evaluations = (
            db.query(PamIndicatorEvaluation)
            .filter(
                PamIndicatorEvaluation.assessment_process_id.in_(
                    assessment_process_ids
                ),
                PamIndicatorEvaluation.indicator_type.in_(
                    ["BASE_PRACTICE", "WORK_PRODUCT"]
                ),
            )
            .all()
        )

        evaluation_ids = [
            evaluation.id
            for evaluation in evaluations
        ]

        evidence_rows = []

        if evaluation_ids:
            evidence_rows = (
                db.query(
                    PamIndicatorEvidenceLink,
                    Evidence,
                )
                .join(
                    Evidence,
                    Evidence.id
                    == PamIndicatorEvidenceLink.evidence_id,
                )
                .filter(
                    PamIndicatorEvidenceLink.evaluation_id.in_(
                        evaluation_ids
                    ),
                    Evidence.tenant_id == tenant_id,
                    Evidence.is_deleted.is_(False),
                )
                .order_by(
                    PamIndicatorEvidenceLink.id.asc(),
                )
                .all()
            )

        process_by_id = {
            process.id: process
            for _, process in process_rows
        }

        assessment_process_by_id = {
            assessment_process.id: assessment_process
            for assessment_process, _ in process_rows
        }

        base_practices_by_process = {}

        for item in base_practices:
            base_practices_by_process.setdefault(
                item.process_id,
                [],
            ).append(item)

        work_products_by_process = {}

        for link, item in work_product_rows:
            work_products_by_process.setdefault(
                link.process_id,
                [],
            ).append((link, item))

        evaluation_by_id = {
            evaluation.id: evaluation
            for evaluation in evaluations
        }

        evidence_by_evaluation = {}

        for link, evidence in evidence_rows:
            evidence_by_evaluation.setdefault(
                link.evaluation_id,
                [],
            ).append((link, evidence))

        bp_evaluation = {}
        wp_evaluation = {}

        for evaluation in evaluations:
            if (
                evaluation.indicator_type == "BASE_PRACTICE"
                and evaluation.base_practice_id is not None
            ):
                bp_evaluation[
                    (
                        evaluation.assessment_process_id,
                        evaluation.base_practice_id,
                    )
                ] = evaluation

            elif (
                evaluation.indicator_type == "WORK_PRODUCT"
                and evaluation.work_product_id is not None
            ):
                wp_evaluation[
                    (
                        evaluation.assessment_process_id,
                        evaluation.work_product_id,
                    )
                ] = evaluation

        result_processes = []
        evidence_references = []

        for assessment_process, process in process_rows:
            process_base_practices = base_practices_by_process.get(
                process.id,
                [],
            )

            process_work_products = work_products_by_process.get(
                process.id,
                [],
            )

            covered_base_practices = 0
            covered_work_products = 0
            evidence_links = 0

            for item in process_base_practices:
                evaluation = bp_evaluation.get(
                    (
                        assessment_process.id,
                        item.id,
                    )
                )

                linked_evidence = (
                    evidence_by_evaluation.get(
                        evaluation.id,
                        [],
                    )
                    if evaluation is not None
                    else []
                )

                if linked_evidence:
                    covered_base_practices += 1

                evidence_links += len(linked_evidence)

                for evidence_link, evidence in linked_evidence:
                    evidence_references.append(
                        {
                            "evidence_id": evidence.id,
                            "title": evidence.title,
                            "description": evidence.description,
                            "status": evidence.status,
                            "assessment_type":
                                evidence.assessment_type,
                            "standard_id": evidence.standard_id,
                            "standard_version_id":
                                evidence.standard_version_id,
                            "relevance":
                                evidence_link.relevance,
                            "note": evidence_link.note,
                            "process_id":
                                assessment_process.id,
                            "process_code": process.code,
                            "process_name": process.name,
                            "source_type": "Base Practice",
                            "source_id": item.id,
                            "source_code": item.code,
                            "source_name": (
                                item.localized_title
                                or item.text
                                or item.code
                            ),
                        }
                    )

            for _, item in process_work_products:
                evaluation = wp_evaluation.get(
                    (
                        assessment_process.id,
                        item.id,
                    )
                )

                linked_evidence = (
                    evidence_by_evaluation.get(
                        evaluation.id,
                        [],
                    )
                    if evaluation is not None
                    else []
                )

                if linked_evidence:
                    covered_work_products += 1

                evidence_links += len(linked_evidence)

                for evidence_link, evidence in linked_evidence:
                    evidence_references.append(
                        {
                            "evidence_id": evidence.id,
                            "title": evidence.title,
                            "description": evidence.description,
                            "status": evidence.status,
                            "assessment_type":
                                evidence.assessment_type,
                            "standard_id": evidence.standard_id,
                            "standard_version_id":
                                evidence.standard_version_id,
                            "relevance":
                                evidence_link.relevance,
                            "note": evidence_link.note,
                            "process_id":
                                assessment_process.id,
                            "process_code": process.code,
                            "process_name": process.name,
                            "source_type": "Work Product",
                            "source_id": item.id,
                            "source_code": item.code,
                            "source_name": (
                                item.name
                                or item.code
                            ),
                        }
                    )

            result_processes.append(
                {
                    "process": {
                        "id": assessment_process.id,
                        "assessment_id":
                            assessment_process.assessment_id,
                        "pam_process_id":
                            assessment_process.pam_process_id,
                        "pam_process": {
                            "id": process.id,
                            "code": process.code,
                            "name": process.name,
                        },
                        "target_capability_level":
                            assessment_process.target_capability_level,
                        "status": assessment_process.status,
                    },
                    "base_practice_count":
                        len(process_base_practices),
                    "work_product_count":
                        len(process_work_products),
                    "covered_base_practices":
                        covered_base_practices,
                    "covered_work_products":
                        covered_work_products,
                    "evidence_links":
                        evidence_links,
                }
            )

        return {
            "assessment_id": assessment.id,
            "processes": result_processes,
            "evidence_references": evidence_references,
        }


