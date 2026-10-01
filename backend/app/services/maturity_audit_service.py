from datetime import datetime
from typing import Optional

from sqlalchemy import func, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.audit_maturity_target import AuditMaturityTarget
from app.models.audit_maturity_target_revision import AuditMaturityTargetRevision
from app.models.audit_plans import AuditPlan
from app.models.pam_runtime import (
    PamProcessAttributeEvaluation,
    PamRatingOption,
)
from app.services.maturity_context_resolver import (
    MaturityContext,
    MaturityContextConflictError,
    MaturityContextNotFoundError,
    MaturityContextResolver,
)


class MaturityAuditError(ValueError):
    pass


class MaturityAuditNotFoundError(MaturityAuditError):
    pass


class MaturityAuditConflictError(MaturityAuditError):
    pass


class MaturityAuditService:

    @staticmethod
    def _get_assessment(
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
    ):
        row = db.execute(
            text("""
                SELECT
                    id,
                    tenant_id,
                    framework_adoption_id,
                    framework_model_id,
                    audit_plan_id,
                    status
                FROM pam_assessments
                WHERE id = :assessment_id
                  AND tenant_id = :tenant_id
            """),
            {
                "assessment_id": assessment_id,
                "tenant_id": tenant_id,
            },
        ).mappings().first()

        if row is None:
            raise MaturityAuditNotFoundError(
                "Assessment not found for tenant."
            )

        return row

    @classmethod
    def _resolve_context(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment,
    ) -> MaturityContext:
        try:
            context = MaturityContextResolver.resolve(
                db,
                tenant_id=tenant_id,
                framework_adoption_id=assessment[
                    "framework_adoption_id"
                ],
            )
        except MaturityContextNotFoundError as exc:
            raise MaturityAuditNotFoundError(
                str(exc)
            ) from exc
        except MaturityContextConflictError as exc:
            raise MaturityAuditConflictError(
                str(exc)
            ) from exc

        if (
            assessment["framework_model_id"]
            != context.pam_framework_model_id
        ):
            raise MaturityAuditConflictError(
                "Assessment PAM model does not match canonical maturity context."
            )

        return context

    @staticmethod
    def _validate_audit_plan(
        db: Session,
        *,
        tenant_id: int,
        audit_plan_id: int,
        assessment,
        context: MaturityContext,
    ):
        plan = db.execute(
            text("""
                SELECT
                    id,
                    tenant_id,
                    standard_id,
                    standard_version_id,
                    status
                FROM audit_plans
                WHERE id = :audit_plan_id
                  AND tenant_id = :tenant_id
            """),
            {
                "audit_plan_id": audit_plan_id,
                "tenant_id": tenant_id,
            },
        ).mappings().first()

        if plan is None:
            raise MaturityAuditNotFoundError(
                "Audit plan not found for tenant."
            )

        if plan["standard_id"] is None:
            raise MaturityAuditConflictError(
                "Maturity audit plan must define a standard."
            )

        if plan["standard_version_id"] is None:
            raise MaturityAuditConflictError(
                "Maturity audit plan must define a standard version."
            )

        if plan["standard_id"] != context.standard_id:
            raise MaturityAuditConflictError(
                "Audit plan standard does not match assessment standard."
            )

        if (
            plan["standard_version_id"]
            != context.standard_version_id
        ):
            raise MaturityAuditConflictError(
                "Audit plan standard version does not match assessment version."
            )

        linked_plan_id = assessment["audit_plan_id"]

        if (
            linked_plan_id is not None
            and linked_plan_id != audit_plan_id
        ):
            raise MaturityAuditConflictError(
                "Assessment is linked to a different audit plan."
            )

        return plan

    @staticmethod
    def _validate_assessment_process(
        db: Session,
        *,
        assessment_id: int,
        assessment_process_id: int,
    ):
        row = db.execute(
            text("""
                SELECT
                    id,
                    assessment_id,
                    pam_process_id,
                    in_scope,
                    target_capability_level,
                    status
                FROM pam_assessment_processes
                WHERE id = :assessment_process_id
                  AND assessment_id = :assessment_id
            """),
            {
                "assessment_id": assessment_id,
                "assessment_process_id": assessment_process_id,
            },
        ).mappings().first()

        if row is None:
            raise MaturityAuditConflictError(
                "Assessment process does not belong to assessment."
            )

        if not row["in_scope"]:
            raise MaturityAuditConflictError(
                "Assessment process is not in scope."
            )

        return row

    @staticmethod
    def _validate_process_attribute(
        db: Session,
        *,
        process_attribute_id: int,
        context: MaturityContext,
    ):
        row = db.execute(
            text("""
                SELECT
                    ppa.id AS runtime_attribute_id,
                    ppa.code AS runtime_attribute_code,
                    ppa.name AS runtime_attribute_name,
                    pcl.id AS runtime_level_id,
                    pcl.level AS runtime_level,
                    pcl.framework_model_id,
                    spa.id AS standard_attribute_id,
                    spa.standard_version_id,
                    spa.code AS standard_attribute_code
                FROM pam_process_attributes ppa
                JOIN pam_capability_levels pcl
                  ON pcl.id = ppa.capability_level_id
                JOIN standard_process_attributes spa
                  ON spa.standard_version_id = :standard_version_id
                 AND spa.code = ppa.code
                WHERE ppa.id = :process_attribute_id
            """),
            {
                "process_attribute_id": process_attribute_id,
                "standard_version_id": context.standard_version_id,
            },
        ).mappings().first()

        if row is None:
            raise MaturityAuditConflictError(
                "Process attribute does not resolve to the assessment standard version."
            )

        if (
            row["framework_model_id"]
            != context.capability_framework_model_id
        ):
            raise MaturityAuditConflictError(
                "Process attribute does not belong to the assessment capability model."
            )

        return row

    @staticmethod
    def _validate_indicator(
        db: Session,
        *,
        standard_indicator_id: Optional[int],
        context: MaturityContext,
        standard_attribute_id: int,
    ):
        if standard_indicator_id is None:
            return None

        row = db.execute(
            text("""
                SELECT
                    id,
                    standard_version_id,
                    process_attribute_id,
                    code,
                    name,
                    indicator_type,
                    sort_order
                FROM standard_indicators
                WHERE id = :standard_indicator_id
                  AND standard_version_id = :standard_version_id
                  AND process_attribute_id = :process_attribute_id
            """),
            {
                "standard_indicator_id": standard_indicator_id,
                "standard_version_id": context.standard_version_id,
                "process_attribute_id": standard_attribute_id,
            },
        ).mappings().first()

        if row is None:
            raise MaturityAuditConflictError(
                "Standard indicator does not belong to the selected process attribute and standard version."
            )

        return row

    @staticmethod
    def list_eligible_auditors(
        db: Session,
        *,
        tenant_id: int,
    ) -> list[dict]:
        rows = db.execute(
            text("""
                SELECT DISTINCT
                    u.id,
                    u.email,
                    u.full_name
                FROM users u
                JOIN user_roles ur
                  ON ur.user_id = u.id
                JOIN roles r
                  ON r.id = ur.role_id
                WHERE u.tenant_id = :tenant_id
                  AND COALESCE(u.is_active, TRUE) = TRUE
                  AND u.is_locked = FALSE
                  AND r.is_active = TRUE
                  AND lower(r.name) IN (
                      'internal auditor',
                      'internal_auditor',
                      'internal audit',
                      'auditor'
                  )
                ORDER BY
                    u.full_name NULLS LAST,
                    u.email,
                    u.id
            """),
            {
                "tenant_id": tenant_id,
            },
        ).mappings().all()

        return [
            {
                "id": row["id"],
                "email": row["email"],
                "full_name": row["full_name"],
            }
            for row in rows
        ]

    @staticmethod
    def _validate_auditor(
        db: Session,
        *,
        tenant_id: int,
        auditor_id: Optional[int],
    ) -> None:
        if auditor_id is None:
            return

        row = db.execute(
            text("""
                SELECT u.id
                FROM users u
                JOIN user_roles ur
                  ON ur.user_id = u.id
                JOIN roles r
                  ON r.id = ur.role_id
                WHERE u.id = :auditor_id
                  AND u.tenant_id = :tenant_id
                  AND COALESCE(u.is_active, TRUE) = TRUE
                  AND u.is_locked = FALSE
                  AND r.is_active = TRUE
                  AND lower(r.name) IN (
                      'internal auditor',
                      'internal_auditor',
                      'internal audit',
                      'auditor'
                  )
                LIMIT 1
            """),
            {
                "auditor_id": auditor_id,
                "tenant_id": tenant_id,
            },
        ).first()

        if row is None:
            raise MaturityAuditConflictError(
                "Assigned auditor must be an active, unlocked "
                "user in the tenant with an active Internal "
                "Auditor role."
            )

    @classmethod
    def validate_target_context(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
        audit_plan_id: int,
        process_attribute_id: int,
        standard_indicator_id: Optional[int] = None,
        auditor_id: Optional[int] = None,
    ):
        assessment = cls._get_assessment(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        context = cls._resolve_context(
            db,
            tenant_id=tenant_id,
            assessment=assessment,
        )

        plan = cls._validate_audit_plan(
            db,
            tenant_id=tenant_id,
            audit_plan_id=audit_plan_id,
            assessment=assessment,
            context=context,
        )

        assessment_process = cls._validate_assessment_process(
            db,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
        )

        attribute = cls._validate_process_attribute(
            db,
            process_attribute_id=process_attribute_id,
            context=context,
        )

        indicator = cls._validate_indicator(
            db,
            standard_indicator_id=standard_indicator_id,
            context=context,
            standard_attribute_id=attribute["standard_attribute_id"],
        )

        cls._validate_auditor(
            db,
            tenant_id=tenant_id,
            auditor_id=auditor_id,
        )

        return {
            "assessment": assessment,
            "context": context,
            "audit_plan": plan,
            "assessment_process": assessment_process,
            "process_attribute": attribute,
            "indicator": indicator,
        }

    @classmethod
    def create_target(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: int,
        audit_plan_id: int,
        process_attribute_id: int,
        standard_indicator_id: Optional[int] = None,
        auditor_id: Optional[int] = None,
        commit: bool = True,
    ) -> AuditMaturityTarget:
        plan = (
            db.query(AuditPlan)
            .filter(
                AuditPlan.id == audit_plan_id,
                AuditPlan.tenant_id == tenant_id,
            )
            .first()
        )

        if plan is None:
            raise MaturityAuditNotFoundError(
                "Audit plan not found for tenant."
            )

        effective_auditor_id = (
            auditor_id
            if auditor_id is not None
            else plan.lead_auditor_id
        )

        cls.validate_target_context(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
            audit_plan_id=audit_plan_id,
            process_attribute_id=process_attribute_id,
            standard_indicator_id=standard_indicator_id,
            auditor_id=effective_auditor_id,
        )

        query = db.query(AuditMaturityTarget).filter(
            AuditMaturityTarget.tenant_id == tenant_id,
            AuditMaturityTarget.audit_plan_id == audit_plan_id,
            AuditMaturityTarget.pam_assessment_id == assessment_id,
            AuditMaturityTarget.assessment_process_id
            == assessment_process_id,
            AuditMaturityTarget.process_attribute_id
            == process_attribute_id,
        )

        if standard_indicator_id is None:
            query = query.filter(
                AuditMaturityTarget.standard_indicator_id.is_(None)
            )
        else:
            query = query.filter(
                AuditMaturityTarget.standard_indicator_id
                == standard_indicator_id
            )

        if query.first() is not None:
            raise MaturityAuditConflictError(
                "Audit maturity target already exists."
            )

        target = AuditMaturityTarget(
            tenant_id=tenant_id,
            audit_plan_id=audit_plan_id,
            pam_assessment_id=assessment_id,
            assessment_process_id=assessment_process_id,
            process_attribute_id=process_attribute_id,
            standard_indicator_id=standard_indicator_id,
            auditor_id=effective_auditor_id,
            status="READY",
        )

        db.add(target)

        try:
            if commit:
                db.commit()
                db.refresh(target)
            else:
                db.flush()
        except IntegrityError as exc:
            if commit:
                db.rollback()

            raise MaturityAuditConflictError(
                "Audit maturity target conflicts with an existing target."
            ) from exc

        return target

    @classmethod
    def _sync_audit_plan_status(
        cls,
        db: Session,
        *,
        tenant_id: int,
        audit_plan_id: int,
    ) -> None:
        plan = (
            db.query(AuditPlan)
            .filter(
                AuditPlan.id == audit_plan_id,
                AuditPlan.tenant_id == tenant_id,
            )
            .first()
        )

        if plan is None:
            raise MaturityAuditNotFoundError(
                "Audit plan not found for tenant."
            )

        targets = (
            db.query(AuditMaturityTarget)
            .filter(
                AuditMaturityTarget.audit_plan_id
                == audit_plan_id,
                AuditMaturityTarget.tenant_id
                == tenant_id,
            )
            .all()
        )

        if not targets:
            plan.status = "DRAFT"
            return

        statuses = {
            str(target.status or "").strip().upper()
            for target in targets
        }

        if statuses == {"COMPLETED"}:
            plan.status = "COMPLETED"
            return

        plan.status = "IN_PROGRESS"

    @classmethod
    def assign_target_auditor(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        target_id: int,
        auditor_id: int,
        commit: bool = True,
    ) -> AuditMaturityTarget:
        target = cls._get_target(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            target_id=target_id,
        )

        current_status = str(
            target.status or ""
        ).strip().upper()

        if current_status == "EXCEPTION":
            raise MaturityAuditConflictError(
                "Auditor cannot be assigned to an "
                "exception audit target."
            )

        cls._validate_auditor(
            db,
            tenant_id=tenant_id,
            auditor_id=auditor_id,
        )

        # Idempotent assignment.
        if target.auditor_id == auditor_id:
            return target

        target.auditor_id = auditor_id
        target.updated_at = datetime.utcnow()

        if commit:
            db.commit()
            db.refresh(target)
        else:
            db.flush()

        return target

    @classmethod
    def update_target_execution(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        target_id: int,
        status: str,
        result: Optional[str] = None,
        observation: Optional[str] = None,
        conclusion: Optional[str] = None,
        commit: bool = True,
    ) -> AuditMaturityTarget:
        normalized_status = str(
            status or ""
        ).strip().upper()

        allowed_statuses = {
            "READY",
            "IN_PROGRESS",
            "COMPLETED",
            "EXCEPTION",
        }

        if normalized_status not in allowed_statuses:
            raise MaturityAuditConflictError(
                "Invalid maturity audit execution status."
            )

        target = (
            db.query(AuditMaturityTarget)
            .filter(
                AuditMaturityTarget.id == target_id,
                AuditMaturityTarget.tenant_id == tenant_id,
                AuditMaturityTarget.pam_assessment_id
                == assessment_id,
            )
            .first()
        )

        if target is None:
            raise MaturityAuditNotFoundError(
                "Maturity audit target not found for assessment and tenant."
            )

        current_status = str(
            target.status or ""
        ).strip().upper()

        allowed_transitions = {
            "READY": {
                "IN_PROGRESS",
            },
            "IN_PROGRESS": {
                "IN_PROGRESS",
                "COMPLETED",
                "EXCEPTION",
            },
            "COMPLETED": {
                "IN_PROGRESS",
            },
            "EXCEPTION": set(),
        }

        if current_status not in allowed_transitions:
            raise MaturityAuditConflictError(
                "Invalid current maturity audit execution status."
            )

        if (
            normalized_status
            not in allowed_transitions[current_status]
        ):
            raise MaturityAuditConflictError(
                "Invalid maturity audit execution transition: "
                + current_status
                + " -> "
                + normalized_status
                + "."
            )

        cls.validate_target_context(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=target.assessment_process_id,
            audit_plan_id=target.audit_plan_id,
            process_attribute_id=target.process_attribute_id,
            standard_indicator_id=target.standard_indicator_id,
            auditor_id=target.auditor_id,
        )

        if normalized_status == "COMPLETED":
            official_pa_evaluation = (
                db.query(PamProcessAttributeEvaluation)
                .filter(
                    PamProcessAttributeEvaluation.audit_maturity_target_id
                    == target.id,
                    PamProcessAttributeEvaluation.process_attribute_id
                    == target.process_attribute_id,
                )
                .one_or_none()
            )

            official_rating = (
                official_pa_evaluation.rating.strip()
                if official_pa_evaluation is not None
                and isinstance(official_pa_evaluation.rating, str)
                and official_pa_evaluation.rating.strip()
                else None
            )

            if official_rating is None:
                raise MaturityAuditConflictError(
                    "Official audit PA rating is required "
                    "before completing the audit target."
                )

        now = datetime.utcnow()

        target.status = normalized_status
        target.result = (
            result.strip()
            if isinstance(result, str)
            and result.strip()
            else None
        )
        target.observation = (
            observation.strip()
            if isinstance(observation, str)
            and observation.strip()
            else None
        )
        target.conclusion = (
            conclusion.strip()
            if isinstance(conclusion, str)
            and conclusion.strip()
            else None
        )


        if (
            normalized_status == "IN_PROGRESS"
            and target.started_at is None
        ):
            target.started_at = now

        if normalized_status == "COMPLETED":
            if target.started_at is None:
                target.started_at = now

            target.completed_at = now

            cls._create_completion_revision(
                db,
                target=target,
                evaluation=official_pa_evaluation,
                completed_at=now,
            )

        elif normalized_status != "COMPLETED":
            target.completed_at = None

        target.updated_at = now

        cls._sync_audit_plan_status(
            db,
            tenant_id=tenant_id,
            audit_plan_id=target.audit_plan_id,
        )

        if commit:
            db.commit()
            db.refresh(target)
        else:
            db.flush()

        return target

    @classmethod
    def _create_completion_revision(
        cls,
        db: Session,
        *,
        target: AuditMaturityTarget,
        evaluation: PamProcessAttributeEvaluation,
        completed_at: datetime,
    ) -> AuditMaturityTargetRevision:
        latest_revision_no = (
            db.query(
                func.max(
                    AuditMaturityTargetRevision.revision_no
                )
            )
            .filter(
                AuditMaturityTargetRevision.audit_maturity_target_id
                == target.id
            )
            .scalar()
        )

        revision_no = int(
            latest_revision_no or 0
        ) + 1

        clean_rating = (
            evaluation.rating.strip()
            if isinstance(
                evaluation.rating,
                str,
            )
            else evaluation.rating
        )

        if not clean_rating:
            raise MaturityAuditConflictError(
                "Official audit PA rating is required "
                "before creating completion revision."
            )

        revision = AuditMaturityTargetRevision(
            audit_maturity_target_id=target.id,
            revision_no=revision_no,
            tenant_id=target.tenant_id,
            pam_assessment_id=target.pam_assessment_id,
            assessment_process_id=target.assessment_process_id,
            process_attribute_id=target.process_attribute_id,
            standard_indicator_id=target.standard_indicator_id,
            auditor_id=target.auditor_id,
            pa_evaluation_id=evaluation.id,
            rating=clean_rating,
            rating_justification=evaluation.justification,
            observation=target.observation,
            conclusion=target.conclusion,
            result=target.result,
            started_at=target.started_at,
            completed_at=completed_at,
        )

        db.add(revision)
        db.flush()

        return revision

    @staticmethod
    def _get_target(
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        target_id: int,
    ) -> AuditMaturityTarget:
        target = (
            db.query(AuditMaturityTarget)
            .filter(
                AuditMaturityTarget.id == target_id,
                AuditMaturityTarget.tenant_id == tenant_id,
                AuditMaturityTarget.pam_assessment_id
                == assessment_id,
            )
            .one_or_none()
        )

        if target is None:
            raise MaturityAuditNotFoundError(
                "Maturity audit target not found for assessment and tenant."
            )

        return target

    @classmethod
    def list_target_revisions(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        target_id: int,
    ):
        target = cls._get_target(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            target_id=target_id,
        )

        revisions = (
            db.query(AuditMaturityTargetRevision)
            .filter(
                AuditMaturityTargetRevision.audit_maturity_target_id
                == target.id,
                AuditMaturityTargetRevision.tenant_id
                == tenant_id,
                AuditMaturityTargetRevision.pam_assessment_id
                == assessment_id,
            )
            .order_by(
                AuditMaturityTargetRevision.revision_no.desc()
            )
            .all()
        )

        return revisions

    @classmethod
    def get_target_process_attribute_evaluation(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        target_id: int,
    ):
        target = cls._get_target(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            target_id=target_id,
        )

        evaluation = (
            db.query(PamProcessAttributeEvaluation)
            .filter(
                PamProcessAttributeEvaluation.audit_maturity_target_id
                == target.id,
                PamProcessAttributeEvaluation.process_attribute_id
                == target.process_attribute_id,
            )
            .one_or_none()
        )

        if evaluation is None:
            return None

        return {
            "id": evaluation.id,
            "assessment_process_id":
                evaluation.assessment_process_id,
            "process_attribute_id":
                evaluation.process_attribute_id,
            "audit_maturity_target_id":
                evaluation.audit_maturity_target_id,
            "rating": evaluation.rating,
            "justification": evaluation.justification,
            "status": evaluation.status,
            "evaluated_by": evaluation.evaluated_by,
            "evaluated_at": evaluation.evaluated_at,
            "created_at": evaluation.created_at,
            "updated_at": evaluation.updated_at,
        }

    @classmethod
    def upsert_target_process_attribute_evaluation(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        target_id: int,
        evaluator_user_id: int,
        rating: Optional[str],
        justification: Optional[str],
        status: str,
        commit: bool = True,
    ):
        target = cls._get_target(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            target_id=target_id,
        )

        cls.validate_target_context(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            assessment_process_id=target.assessment_process_id,
            audit_plan_id=target.audit_plan_id,
            process_attribute_id=target.process_attribute_id,
            standard_indicator_id=target.standard_indicator_id,
            auditor_id=evaluator_user_id,
        )

        clean_rating = (
            rating.strip()
            if isinstance(rating, str)
            and rating.strip()
            else None
        )

        clean_status = (
            status.strip().upper()
            if isinstance(status, str)
            else ""
        )

        if not clean_status:
            raise MaturityAuditConflictError(
                "Process attribute evaluation status is required."
            )

        if clean_rating is not None and len(clean_rating) > 32:
            raise MaturityAuditConflictError(
                "Process attribute evaluation rating exceeds 32 characters."
            )

        assessment = cls._get_assessment(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        context = cls._resolve_context(
            db,
            tenant_id=tenant_id,
            assessment=assessment,
        )

        if clean_rating is not None:
            rating_option = (
                db.query(PamRatingOption)
                .filter(
                    PamRatingOption.framework_model_id
                    == context.capability_framework_model_id,
                    PamRatingOption.code == clean_rating,
                )
                .one_or_none()
            )

            if rating_option is None:
                raise MaturityAuditConflictError(
                    "Process attribute evaluation rating is not valid "
                    "for the resolved capability model."
                )

        evaluation = (
            db.query(PamProcessAttributeEvaluation)
            .filter(
                PamProcessAttributeEvaluation.audit_maturity_target_id
                == target.id,
                PamProcessAttributeEvaluation.process_attribute_id
                == target.process_attribute_id,
            )
            .one_or_none()
        )

        now = datetime.utcnow()

        if evaluation is None:
            evaluation = PamProcessAttributeEvaluation(
                assessment_process_id=target.assessment_process_id,
                process_attribute_id=target.process_attribute_id,
                audit_maturity_target_id=target.id,
                rating=clean_rating,
                justification=justification,
                status=clean_status,
                evaluated_by=evaluator_user_id,
                evaluated_at=now,
            )
            db.add(evaluation)
        else:
            if (
                evaluation.assessment_process_id
                != target.assessment_process_id
            ):
                raise MaturityAuditConflictError(
                    "Audit PA evaluation assessment process "
                    "does not match target."
                )

            evaluation.rating = clean_rating
            evaluation.justification = justification
            evaluation.status = clean_status
            evaluation.evaluated_by = evaluator_user_id
            evaluation.evaluated_at = now

        db.flush()
        db.refresh(evaluation)

        if commit:
            db.commit()
            db.refresh(evaluation)

        return {
            "id": evaluation.id,
            "assessment_process_id":
                evaluation.assessment_process_id,
            "process_attribute_id":
                evaluation.process_attribute_id,
            "audit_maturity_target_id":
                evaluation.audit_maturity_target_id,
            "rating": evaluation.rating,
            "justification": evaluation.justification,
            "status": evaluation.status,
            "evaluated_by": evaluation.evaluated_by,
            "evaluated_at": evaluation.evaluated_at,
            "created_at": evaluation.created_at,
            "updated_at": evaluation.updated_at,
        }

    @staticmethod
    def list_targets(
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        assessment_process_id: Optional[int] = None,
    ):
        sql = """
            SELECT
                amt.id,
                amt.tenant_id,
                amt.audit_plan_id,
                ap.reference AS audit_plan_reference,
                ap.name AS audit_plan_name,
                amt.pam_assessment_id,
                amt.assessment_process_id,
                pap.pam_process_id,
                pp.code AS process_code,
                pp.name AS process_name,
                amt.process_attribute_id,
                ppa.code AS process_attribute_code,
                ppa.name AS process_attribute_name,
                amt.standard_indicator_id,
                si.code AS indicator_code,
                si.name AS indicator_name,
                si.indicator_type,
                amt.auditor_id,
                amt.status,
                amt.result,
                amt.observation,
                amt.conclusion,
                amt.started_at,
                amt.completed_at,
                amt.created_at,
                amt.updated_at
            FROM audit_maturity_targets amt
            JOIN audit_plans ap
              ON ap.id = amt.audit_plan_id
             AND ap.tenant_id = amt.tenant_id
            JOIN pam_assessment_processes pap
              ON pap.id = amt.assessment_process_id
             AND pap.assessment_id = amt.pam_assessment_id
            JOIN pam_processes pp
              ON pp.id = pap.pam_process_id
            JOIN pam_process_attributes ppa
              ON ppa.id = amt.process_attribute_id
            LEFT JOIN standard_indicators si
              ON si.id = amt.standard_indicator_id
            WHERE amt.tenant_id = :tenant_id
              AND amt.pam_assessment_id = :assessment_id
        """

        params = {
            "tenant_id": tenant_id,
            "assessment_id": assessment_id,
        }

        if assessment_process_id is not None:
            sql += """
              AND amt.assessment_process_id = :assessment_process_id
            """
            params["assessment_process_id"] = assessment_process_id

        sql += """
            ORDER BY
                amt.assessment_process_id,
                ppa.sort_order,
                si.sort_order NULLS FIRST,
                amt.id
        """

        return [
            dict(row)
            for row in db.execute(
                text(sql),
                params,
            ).mappings().all()
        ]
