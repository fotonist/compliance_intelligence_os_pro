from datetime import date, datetime

from sqlalchemy.orm import Session

from app.models.audit_plans import AuditPlan
from app.models.audit_maturity_target import AuditMaturityTarget
from app.models.audit_maturity_finding import AuditMaturityFinding
from app.models.audit_maturity_finding_workflow_event import (
    AuditMaturityFindingWorkflowEvent,
)
from app.models.user import User


class MaturityAuditFindingError(ValueError):
    pass


class MaturityAuditFindingNotFoundError(
    MaturityAuditFindingError
):
    pass


class MaturityAuditFindingConflictError(
    MaturityAuditFindingError
):
    pass


class MaturityAuditFindingService:
    SEVERITIES = {
        "LOW",
        "MEDIUM",
        "HIGH",
        "CRITICAL",
    }

    @classmethod
    def _get_target(
        cls,
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
                AuditMaturityTarget.pam_assessment_id == assessment_id,
            )
            .first()
        )

        if target is None:
            raise MaturityAuditFindingNotFoundError(
                "Maturity audit target not found."
            )

        return target

    @classmethod
    def _get_plan(
        cls,
        db: Session,
        *,
        tenant_id: int,
        audit_plan_id: int,
    ) -> AuditPlan:
        plan = (
            db.query(AuditPlan)
            .filter(
                AuditPlan.id == audit_plan_id,
                AuditPlan.tenant_id == tenant_id,
            )
            .first()
        )

        if plan is None:
            raise MaturityAuditFindingNotFoundError(
                "Audit plan not found."
            )

        return plan

    @classmethod
    def _get_tenant_user(
        cls,
        db: Session,
        *,
        tenant_id: int,
        user_id: int | None,
    ) -> User | None:
        if user_id is None:
            return None

        user = (
            db.query(User)
            .filter(
                User.id == user_id,
                User.tenant_id == tenant_id,
            )
            .first()
        )

        if user is None:
            raise MaturityAuditFindingNotFoundError(
                "User not found in tenant."
            )

        return user

    @classmethod
    def _event(
        cls,
        db: Session,
        *,
        finding: AuditMaturityFinding,
        actor_id: int | None,
        actor_role: str | None,
        action: str,
        from_status: str | None,
        to_status: str | None,
        comment: str | None = None,
    ) -> None:
        db.add(
            AuditMaturityFindingWorkflowEvent(
                tenant_id=finding.tenant_id,
                finding_id=finding.id,
                actor_id=actor_id,
                actor_role=actor_role,
                action=action,
                from_status=from_status,
                to_status=to_status,
                comment=comment,
                created_at=datetime.utcnow(),
            )
        )

    @classmethod
    def validate_target_lineage(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        target_id: int,
    ) -> AuditMaturityTarget:
        target = cls._get_target(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            target_id=target_id,
        )

        cls._get_plan(
            db,
            tenant_id=tenant_id,
            audit_plan_id=target.audit_plan_id,
        )

        return target

    @classmethod
    def create_finding(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        target_id: int,
        created_by: int | None,
        title: str,
        description: str,
        severity: str = "MEDIUM",
        requirement: str | None = None,
        objective_evidence: str | None = None,
        assigned_owner_id: int | None = None,
        process_manager_id: int | None = None,
        due_date: date | None = None,
        root_cause: str | None = None,
        correction: str | None = None,
        corrective_action_plan: str | None = None,
        recommendation: str | None = None,
        actor_role: str | None = None,
        commit: bool = True,
    ) -> AuditMaturityFinding:
        target = cls.validate_target_lineage(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            target_id=target_id,
        )

        clean_title = (title or "").strip()
        clean_description = (description or "").strip()

        if not clean_title:
            raise MaturityAuditFindingError(
                "Finding title is required."
            )

        if not clean_description:
            raise MaturityAuditFindingError(
                "Finding description is required."
            )

        clean_severity = (
            severity or "MEDIUM"
        ).strip().upper()

        if clean_severity not in cls.SEVERITIES:
            raise MaturityAuditFindingError(
                "Invalid finding severity."
            )

        creator = cls._get_tenant_user(
            db,
            tenant_id=tenant_id,
            user_id=created_by,
        )

        owner = cls._get_tenant_user(
            db,
            tenant_id=tenant_id,
            user_id=assigned_owner_id,
        )

        manager = cls._get_tenant_user(
            db,
            tenant_id=tenant_id,
            user_id=process_manager_id,
        )

        initial_status = (
            "ASSIGNED"
            if owner is not None
            else "OPEN"
        )

        finding = AuditMaturityFinding(
            tenant_id=tenant_id,
            audit_plan_id=target.audit_plan_id,
            audit_maturity_target_id=target.id,
            created_by=creator.id if creator else None,
            assigned_owner_id=owner.id if owner else None,
            process_manager_id=manager.id if manager else None,
            title=clean_title,
            description=clean_description,
            requirement=(requirement or "").strip() or None,
            objective_evidence=(
                (objective_evidence or "").strip() or None
            ),
            severity=clean_severity,
            status=initial_status,
            owner=(
                (owner.full_name or owner.email)
                if owner
                else None
            ),
            due_date=due_date,
            root_cause=(root_cause or "").strip() or None,
            correction=(correction or "").strip() or None,
            corrective_action_plan=(
                (corrective_action_plan or "").strip() or None
            ),
            recommendation=(
                (recommendation or "").strip() or None
            ),
            manager_review_status="NOT_SUBMITTED",
            implementation_status="NOT_STARTED",
            verification_status="NOT_READY",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        db.add(finding)
        db.flush()

        cls._event(
            db,
            finding=finding,
            actor_id=created_by,
            actor_role=actor_role,
            action="FINDING_CREATED",
            from_status=None,
            to_status=initial_status,
        )

        if owner is not None:
            cls._event(
                db,
                finding=finding,
                actor_id=created_by,
                actor_role=actor_role,
                action="OWNER_ASSIGNED",
                from_status=initial_status,
                to_status=initial_status,
            )

        if manager is not None:
            cls._event(
                db,
                finding=finding,
                actor_id=created_by,
                actor_role=actor_role,
                action="PROCESS_MANAGER_ASSIGNED",
                from_status=initial_status,
                to_status=initial_status,
            )

        if commit:
            db.commit()
            db.refresh(finding)
        else:
            db.flush()

        return finding

    @classmethod
    def get_finding(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        finding_id: int,
    ) -> AuditMaturityFinding:
        finding = (
            db.query(AuditMaturityFinding)
            .join(
                AuditMaturityTarget,
                AuditMaturityTarget.id
                == AuditMaturityFinding.audit_maturity_target_id,
            )
            .filter(
                AuditMaturityFinding.id == finding_id,
                AuditMaturityFinding.tenant_id == tenant_id,
                AuditMaturityTarget.tenant_id == tenant_id,
                AuditMaturityTarget.pam_assessment_id
                == assessment_id,
            )
            .first()
        )

        if finding is None:
            raise MaturityAuditFindingNotFoundError(
                "Maturity audit finding not found."
            )

        return finding

    @classmethod
    def list_findings(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        target_id: int | None = None,
    ) -> list[AuditMaturityFinding]:
        query = (
            db.query(AuditMaturityFinding)
            .join(
                AuditMaturityTarget,
                AuditMaturityTarget.id
                == AuditMaturityFinding.audit_maturity_target_id,
            )
            .filter(
                AuditMaturityFinding.tenant_id == tenant_id,
                AuditMaturityTarget.tenant_id == tenant_id,
                AuditMaturityTarget.pam_assessment_id
                == assessment_id,
            )
        )

        if target_id is not None:
            query = query.filter(
                AuditMaturityFinding.audit_maturity_target_id
                == target_id
            )

        return (
            query
            .order_by(
                AuditMaturityFinding.updated_at.desc()
            )
            .all()
        )


    @classmethod
    def assign_owner(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        finding_id: int,
        assigned_owner_id: int,
        actor_id: int | None,
        actor_role: str | None = None,
        process_manager_id: int | None = None,
        comment: str | None = None,
        manager_comment: str | None = None,
        commit: bool = True,
    ) -> AuditMaturityFinding:
        finding = cls.get_finding(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=finding_id,
        )

        if finding.status == "CLOSED":
            raise MaturityAuditFindingConflictError(
                "Closed findings cannot be reassigned."
            )

        owner = cls._get_tenant_user(
            db,
            tenant_id=tenant_id,
            user_id=assigned_owner_id,
        )

        manager = None

        if process_manager_id is not None:
            manager = cls._get_tenant_user(
                db,
                tenant_id=tenant_id,
                user_id=process_manager_id,
            )

        old_status = finding.status

        finding.assigned_owner_id = owner.id
        finding.owner = (
            owner.full_name
            or owner.email
        )

        if manager is not None:
            finding.process_manager_id = manager.id

        finding.status = "ASSIGNED"
        finding.updated_at = datetime.utcnow()

        cls._event(
            db,
            finding=finding,
            actor_id=actor_id,
            actor_role=actor_role,
            action="OWNER_ASSIGNED",
            from_status=old_status,
            to_status=finding.status,
            comment=comment,
        )

        if manager is not None:
            cls._event(
                db,
                finding=finding,
                actor_id=actor_id,
                actor_role=actor_role,
                action="PROCESS_MANAGER_ASSIGNED",
                from_status=finding.status,
                to_status=finding.status,
                comment=manager_comment,
            )

        if commit:
            db.commit()
            db.refresh(finding)
        else:
            db.flush()

        return finding

    @classmethod
    def save_owner_response(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        finding_id: int,
        actor_id: int,
        root_cause: str | None = None,
        correction: str | None = None,
        corrective_action_plan: str | None = None,
        recommendation: str | None = None,
        implementation_evidence: str | None = None,
        due_date: date | None = None,
        comment: str | None = None,
        actor_role: str | None = None,
        enforce_actor: bool = True,
        commit: bool = True,
    ) -> AuditMaturityFinding:
        finding = cls.get_finding(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=finding_id,
        )

        cls._get_tenant_user(
            db,
            tenant_id=tenant_id,
            user_id=actor_id,
        )

        if (
            enforce_actor
            and finding.assigned_owner_id != actor_id
        ):
            raise MaturityAuditFindingConflictError(
                "Only the assigned owner can submit the finding response."
            )

        allowed = {
            "ASSIGNED",
            "OWNER_RESPONSE",
            "REVISION_REQUIRED",
            "VERIFICATION_FAILED",
        }

        if finding.status not in allowed:
            raise MaturityAuditFindingConflictError(
                "Owner response is not allowed while finding is "
                + str(finding.status)
                + "."
            )

        values = {
            "root_cause": root_cause,
            "correction": correction,
            "corrective_action_plan": corrective_action_plan,
            "recommendation": recommendation,
            "implementation_evidence": implementation_evidence,
        }

        for field, value in values.items():
            if value is not None:
                setattr(
                    finding,
                    field,
                    value.strip() or None,
                )

        if due_date is not None:
            finding.due_date = due_date

        old_status = finding.status

        finding.status = "OWNER_RESPONSE"
        finding.manager_review_status = "NOT_SUBMITTED"
        finding.updated_at = datetime.utcnow()

        cls._event(
            db,
            finding=finding,
            actor_id=actor_id,
            actor_role=actor_role,
            action="OWNER_RESPONSE_SAVED",
            from_status=old_status,
            to_status=finding.status,
            comment=comment,
        )

        if commit:
            db.commit()
            db.refresh(finding)
        else:
            db.flush()

        return finding

    @classmethod
    def owner_submit(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        finding_id: int,
        actor_id: int,
        actor_role: str | None = None,
        comment: str | None = None,
        enforce_actor: bool = True,
        commit: bool = True,
    ) -> AuditMaturityFinding:
        finding = cls.get_finding(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=finding_id,
        )

        cls._get_tenant_user(
            db,
            tenant_id=tenant_id,
            user_id=actor_id,
        )

        if (
            enforce_actor
            and finding.assigned_owner_id != actor_id
        ):
            raise MaturityAuditFindingConflictError(
                "Only the assigned owner can submit the corrective action plan."
            )

        allowed = {
            "OWNER_RESPONSE",
            "REVISION_REQUIRED",
            "VERIFICATION_FAILED",
        }

        if finding.status not in allowed:
            raise MaturityAuditFindingConflictError(
                "Submission is not allowed while finding is "
                + str(finding.status)
                + "."
            )

        if not (finding.root_cause or "").strip():
            raise MaturityAuditFindingError(
                "Root cause is required before submission."
            )

        if not (
            finding.corrective_action_plan
            or ""
        ).strip():
            raise MaturityAuditFindingError(
                "Corrective action plan is required before submission."
            )

        if not finding.due_date:
            raise MaturityAuditFindingError(
                "Target date is required before submission."
            )

        if not finding.process_manager_id:
            raise MaturityAuditFindingError(
                "A process manager must be assigned before submission."
            )

        old_status = finding.status

        finding.status = "SUBMITTED_FOR_REVIEW"
        finding.owner_submitted_at = datetime.utcnow()
        finding.owner_submitted_by = actor_id
        finding.manager_review_status = "PENDING"
        finding.manager_review_comment = None
        finding.updated_at = datetime.utcnow()

        cls._event(
            db,
            finding=finding,
            actor_id=actor_id,
            actor_role=actor_role,
            action="OWNER_SUBMITTED_FOR_REVIEW",
            from_status=old_status,
            to_status=finding.status,
            comment=comment,
        )

        if commit:
            db.commit()
            db.refresh(finding)
        else:
            db.flush()

        return finding

    @classmethod
    def manager_approve(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        finding_id: int,
        actor_id: int,
        actor_role: str | None = None,
        comment: str | None = None,
        enforce_actor: bool = True,
        commit: bool = True,
    ) -> AuditMaturityFinding:
        finding = cls.get_finding(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=finding_id,
        )

        cls._get_tenant_user(
            db,
            tenant_id=tenant_id,
            user_id=actor_id,
        )

        if (
            enforce_actor
            and finding.process_manager_id != actor_id
        ):
            raise MaturityAuditFindingConflictError(
                "Only the assigned process manager can approve the corrective action plan."
            )

        if finding.status != "SUBMITTED_FOR_REVIEW":
            raise MaturityAuditFindingConflictError(
                "Manager approval is not allowed while finding is "
                + str(finding.status)
                + "."
            )

        old_status = finding.status

        finding.status = "PLAN_APPROVED"
        finding.manager_review_status = "APPROVED"
        finding.manager_review_comment = (
            (comment or "").strip()
            or None
        )
        finding.manager_reviewed_by = actor_id
        finding.manager_reviewed_at = datetime.utcnow()
        finding.updated_at = datetime.utcnow()

        cls._event(
            db,
            finding=finding,
            actor_id=actor_id,
            actor_role=actor_role,
            action="PLAN_APPROVED",
            from_status=old_status,
            to_status=finding.status,
            comment=finding.manager_review_comment,
        )

        if commit:
            db.commit()
            db.refresh(finding)
        else:
            db.flush()

        return finding

    @classmethod
    def manager_revision(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        finding_id: int,
        actor_id: int,
        comment: str,
        actor_role: str | None = None,
        enforce_actor: bool = True,
        commit: bool = True,
    ) -> AuditMaturityFinding:
        finding = cls.get_finding(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=finding_id,
        )

        cls._get_tenant_user(
            db,
            tenant_id=tenant_id,
            user_id=actor_id,
        )

        if (
            enforce_actor
            and finding.process_manager_id != actor_id
        ):
            raise MaturityAuditFindingConflictError(
                "Only the assigned process manager can request a revision."
            )

        if finding.status != "SUBMITTED_FOR_REVIEW":
            raise MaturityAuditFindingConflictError(
                "Revision request is not allowed while finding is "
                + str(finding.status)
                + "."
            )

        clean_comment = (
            comment or ""
        ).strip()

        if not clean_comment:
            raise MaturityAuditFindingError(
                "A revision comment is required."
            )

        old_status = finding.status

        finding.status = "REVISION_REQUIRED"
        finding.manager_review_status = "REVISION_REQUIRED"
        finding.manager_review_comment = clean_comment
        finding.manager_reviewed_by = actor_id
        finding.manager_reviewed_at = datetime.utcnow()
        finding.updated_at = datetime.utcnow()

        cls._event(
            db,
            finding=finding,
            actor_id=actor_id,
            actor_role=actor_role,
            action="REVISION_REQUIRED",
            from_status=old_status,
            to_status=finding.status,
            comment=clean_comment,
        )

        if commit:
            db.commit()
            db.refresh(finding)
        else:
            db.flush()

        return finding

    @classmethod
    def implementation_complete(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        finding_id: int,
        actor_id: int,
        implementation_evidence: str,
        actor_role: str | None = None,
        comment: str | None = None,
        enforce_actor: bool = True,
        commit: bool = True,
    ) -> AuditMaturityFinding:
        finding = cls.get_finding(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=finding_id,
        )

        cls._get_tenant_user(
            db,
            tenant_id=tenant_id,
            user_id=actor_id,
        )

        if (
            enforce_actor
            and finding.assigned_owner_id != actor_id
        ):
            raise MaturityAuditFindingConflictError(
                "Only the assigned owner can mark implementation complete."
            )

        if finding.status != "PLAN_APPROVED":
            raise MaturityAuditFindingConflictError(
                "Implementation completion is not allowed while finding is "
                + str(finding.status)
                + "."
            )

        evidence = (
            implementation_evidence
            or ""
        ).strip()

        if not evidence:
            raise MaturityAuditFindingError(
                "Implementation evidence is required."
            )

        old_status = finding.status

        finding.status = "READY_FOR_VERIFICATION"
        finding.implementation_status = "COMPLETED"
        finding.implementation_completed_at = datetime.utcnow()
        finding.implementation_evidence = evidence
        finding.verification_status = "PENDING"
        finding.updated_at = datetime.utcnow()

        cls._event(
            db,
            finding=finding,
            actor_id=actor_id,
            actor_role=actor_role,
            action="IMPLEMENTATION_COMPLETED",
            from_status=old_status,
            to_status=finding.status,
            comment=comment,
        )

        if commit:
            db.commit()
            db.refresh(finding)
        else:
            db.flush()

        return finding

    @classmethod
    def verify_finding(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        finding_id: int,
        actor_id: int,
        effective: bool,
        comment: str,
        actor_role: str | None = None,
        commit: bool = True,
    ) -> AuditMaturityFinding:
        finding = cls.get_finding(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=finding_id,
        )

        cls._get_tenant_user(
            db,
            tenant_id=tenant_id,
            user_id=actor_id,
        )

        if finding.status != "READY_FOR_VERIFICATION":
            raise MaturityAuditFindingConflictError(
                "Verification is not allowed while finding is "
                + str(finding.status)
                + "."
            )

        if not isinstance(effective, bool):
            raise MaturityAuditFindingError(
                "effective must be true or false."
            )

        clean_comment = (
            comment or ""
        ).strip()

        if not clean_comment:
            raise MaturityAuditFindingError(
                "Verification comment is required."
            )

        old_status = finding.status

        finding.verification_comment = clean_comment
        finding.verified_by = actor_id
        finding.verified_at = datetime.utcnow()

        if effective:
            finding.verification_status = "EFFECTIVE"
            finding.status = "CLOSED"
            finding.closed_by = actor_id
            finding.closed_at = datetime.utcnow()
            finding.closure_comment = clean_comment
            action = "VERIFIED_AND_CLOSED"
        else:
            finding.verification_status = "INEFFECTIVE"
            finding.status = "VERIFICATION_FAILED"
            finding.closed_by = None
            finding.closed_at = None
            finding.closure_comment = None
            action = "VERIFICATION_FAILED"

        finding.updated_at = datetime.utcnow()

        cls._event(
            db,
            finding=finding,
            actor_id=actor_id,
            actor_role=actor_role,
            action=action,
            from_status=old_status,
            to_status=finding.status,
            comment=clean_comment,
        )

        if commit:
            db.commit()
            db.refresh(finding)
        else:
            db.flush()

        return finding
