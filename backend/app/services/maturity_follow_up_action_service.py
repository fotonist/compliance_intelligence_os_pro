from __future__ import annotations

from datetime import date, datetime

from sqlalchemy.orm import Session

from app.models.audit_maturity_finding import AuditMaturityFinding
from app.models.audit_maturity_follow_up_action import (
    AuditMaturityFollowUpAction,
    AuditMaturityFollowUpEvidenceLink,
)
from app.models.evidences import Evidence
from app.models.pam_runtime import PamAssessment
from app.services.maturity_context_resolver import (
    MaturityContextResolver,
)
from app.models.audit_maturity_follow_up_workflow_event import (
    AuditMaturityFollowUpWorkflowEvent,
)
from app.models.user import User
from app.services.maturity_audit_finding_service import (
    MaturityAuditFindingNotFoundError,
    MaturityAuditFindingService,
)


class MaturityFollowUpActionError(ValueError):
    pass


class MaturityFollowUpActionNotFoundError(
    MaturityFollowUpActionError
):
    pass


class MaturityFollowUpActionConflictError(
    MaturityFollowUpActionError
):
    pass


class MaturityFollowUpActionService:
    PRIORITIES = {
        "LOW",
        "MEDIUM",
        "HIGH",
        "CRITICAL",
    }

    TERMINAL_STATUSES = {
        "COMPLETED",
        "CANCELLED",
    }

    @classmethod
    def _now(cls) -> datetime:
        return datetime.utcnow()

    @classmethod
    def _save(
        cls,
        db: Session,
        action: AuditMaturityFollowUpAction,
        *,
        commit: bool,
    ) -> AuditMaturityFollowUpAction:
        if commit:
            db.commit()
            db.refresh(action)
        else:
            db.flush()

        return action

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
            raise MaturityFollowUpActionNotFoundError(
                "User not found in tenant."
            )

        return user

    @classmethod
    def _get_finding(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        finding_id: int,
    ) -> AuditMaturityFinding:
        try:
            return MaturityAuditFindingService.get_finding(
                db,
                tenant_id=tenant_id,
                assessment_id=assessment_id,
                finding_id=finding_id,
            )
        except MaturityAuditFindingNotFoundError as exc:
            raise MaturityFollowUpActionNotFoundError(
                "Maturity audit finding not found."
            ) from exc

    @classmethod
    def _event(
        cls,
        db: Session,
        *,
        action: AuditMaturityFollowUpAction,
        actor_id: int | None,
        actor_role: str | None,
        event_action: str,
        from_status: str | None,
        to_status: str | None,
        comment: str | None = None,
    ) -> None:
        db.add(
            AuditMaturityFollowUpWorkflowEvent(
                tenant_id=action.tenant_id,
                follow_up_action_id=action.id,
                actor_id=actor_id,
                actor_role=actor_role,
                action=event_action,
                from_status=from_status,
                to_status=to_status,
                comment=comment,
                created_at=cls._now(),
            )
        )

    @classmethod
    def _assert_not_terminal(
        cls,
        action: AuditMaturityFollowUpAction,
    ) -> None:
        if action.status in cls.TERMINAL_STATUSES:
            raise MaturityFollowUpActionConflictError(
                "Terminal follow-up actions cannot be modified."
            )

    @classmethod
    def _assert_owner(
        cls,
        action: AuditMaturityFollowUpAction,
        *,
        actor_id: int,
    ) -> None:
        if action.assigned_owner_id is None:
            raise MaturityFollowUpActionConflictError(
                "Follow-up action has no assigned owner."
            )

        if action.assigned_owner_id != actor_id:
            raise MaturityFollowUpActionConflictError(
                "Only the assigned owner can perform this action."
            )

    @classmethod
    def create_action(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        finding_id: int,
        title: str,
        description: str | None = None,
        assigned_owner_id: int | None = None,
        created_by: int | None = None,
        priority: str = "MEDIUM",
        due_date: date | None = None,
        actor_role: str | None = None,
        comment: str | None = None,
        commit: bool = True,
    ) -> AuditMaturityFollowUpAction:
        finding = cls._get_finding(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=finding_id,
        )

        if finding.status == "CLOSED":
            raise MaturityFollowUpActionConflictError(
                "Follow-up actions cannot be created for closed findings."
            )

        clean_title = (title or "").strip()

        if not clean_title:
            raise MaturityFollowUpActionError(
                "Follow-up action title is required."
            )

        clean_priority = (
            priority or "MEDIUM"
        ).strip().upper()

        if clean_priority not in cls.PRIORITIES:
            raise MaturityFollowUpActionError(
                "Invalid follow-up action priority."
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

        action = AuditMaturityFollowUpAction(
            tenant_id=tenant_id,
            finding_id=finding.id,
            action_code="PENDING",
            title=clean_title,
            description=(description or "").strip() or None,
            assigned_owner_id=(
                owner.id if owner is not None else None
            ),
            created_by=(
                creator.id if creator is not None else None
            ),
            verifier_id=None,
            priority=clean_priority,
            due_date=due_date,
            status="OPEN",
            created_at=cls._now(),
            updated_at=cls._now(),
        )

        db.add(action)
        db.flush()

        action.action_code = "MFU-" + str(action.id).zfill(6)

        cls._event(
            db,
            action=action,
            actor_id=created_by,
            actor_role=actor_role,
            event_action="FOLLOW_UP_CREATED",
            from_status=None,
            to_status="OPEN",
            comment=comment,
        )

        if owner is not None:
            cls._event(
                db,
                action=action,
                actor_id=created_by,
                actor_role=actor_role,
                event_action="OWNER_ASSIGNED",
                from_status="OPEN",
                to_status="OPEN",
                comment=None,
            )

        return cls._save(
            db,
            action,
            commit=commit,
        )

    @classmethod
    def get_action(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        action_id: int,
    ) -> AuditMaturityFollowUpAction:
        finding_ids = (
            db.query(AuditMaturityFinding.id)
            .filter(
                AuditMaturityFinding.tenant_id == tenant_id,
            )
            .all()
        )

        finding_ids = {
            row[0]
            for row in finding_ids
        }

        action = (
            db.query(AuditMaturityFollowUpAction)
            .filter(
                AuditMaturityFollowUpAction.id == action_id,
                AuditMaturityFollowUpAction.tenant_id
                == tenant_id,
                AuditMaturityFollowUpAction.finding_id.in_(
                    finding_ids
                ),
            )
            .first()
        )

        if action is None:
            raise MaturityFollowUpActionNotFoundError(
                "Maturity follow-up action not found."
            )

        cls._get_finding(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            finding_id=action.finding_id,
        )

        return action

    @classmethod
    def list_actions(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        finding_id: int | None = None,
    ) -> list[AuditMaturityFollowUpAction]:
        findings = MaturityAuditFindingService.list_findings(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        valid_finding_ids = {
            finding.id
            for finding in findings
        }

        if finding_id is not None:
            if finding_id not in valid_finding_ids:
                raise MaturityFollowUpActionNotFoundError(
                    "Maturity audit finding not found."
                )

            valid_finding_ids = {finding_id}

        if not valid_finding_ids:
            return []

        return (
            db.query(AuditMaturityFollowUpAction)
            .filter(
                AuditMaturityFollowUpAction.tenant_id
                == tenant_id,
                AuditMaturityFollowUpAction.finding_id.in_(
                    valid_finding_ids
                ),
            )
            .order_by(
                AuditMaturityFollowUpAction.updated_at.desc(),
                AuditMaturityFollowUpAction.id.desc(),
            )
            .all()
        )

    @classmethod
    def _get_context(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
    ):
        assessment = (
            db.query(PamAssessment)
            .filter(
                PamAssessment.id == assessment_id,
                PamAssessment.tenant_id == tenant_id,
            )
            .first()
        )

        if assessment is None:
            raise MaturityFollowUpActionNotFoundError(
                "PAM assessment not found."
            )

        return MaturityContextResolver.resolve(
            db,
            tenant_id=tenant_id,
            framework_adoption_id=(
                assessment.framework_adoption_id
            ),
        )

    @classmethod
    def _get_evidence_candidate(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        evidence_id: int,
    ) -> Evidence:
        context = cls._get_context(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
        )

        evidence = (
            db.query(Evidence)
            .filter(
                Evidence.id == evidence_id,
                Evidence.tenant_id == tenant_id,
                Evidence.standard_id
                == context.standard_id,
                Evidence.standard_version_id
                == context.standard_version_id,
                Evidence.assessment_type == "maturity",
                Evidence.is_deleted.is_(False),
            )
            .first()
        )

        if evidence is None:
            raise MaturityFollowUpActionNotFoundError(
                "Eligible maturity evidence not found "
                "in assessment context."
            )

        status = str(evidence.status or "").strip().lower()

        if status not in {"draft", "uploaded"}:
            raise MaturityFollowUpActionConflictError(
                "Evidence status is not eligible for linking."
            )

        return evidence

    @classmethod
    def list_evidence(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        action_id: int,
    ) -> list[AuditMaturityFollowUpEvidenceLink]:
        action = cls.get_action(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            action_id=action_id,
        )

        return (
            db.query(AuditMaturityFollowUpEvidenceLink)
            .join(
                Evidence,
                Evidence.id
                == AuditMaturityFollowUpEvidenceLink.evidence_id,
            )
            .filter(
                AuditMaturityFollowUpEvidenceLink.tenant_id
                == tenant_id,
                AuditMaturityFollowUpEvidenceLink
                .follow_up_action_id == action.id,
                Evidence.tenant_id == tenant_id,
                Evidence.is_deleted.is_(False),
            )
            .order_by(
                AuditMaturityFollowUpEvidenceLink.id.asc(),
            )
            .all()
        )

    @classmethod
    def link_evidence(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        action_id: int,
        evidence_id: int,
        actor_id: int,
        actor_role: str | None = None,
        note: str | None = None,
        commit: bool = True,
    ) -> AuditMaturityFollowUpEvidenceLink:
        action = cls.get_action(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            action_id=action_id,
        )

        cls._assert_not_terminal(action)

        cls._get_tenant_user(
            db,
            tenant_id=tenant_id,
            user_id=actor_id,
        )

        evidence = cls._get_evidence_candidate(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            evidence_id=evidence_id,
        )

        existing = (
            db.query(AuditMaturityFollowUpEvidenceLink)
            .filter(
                AuditMaturityFollowUpEvidenceLink.tenant_id
                == tenant_id,
                AuditMaturityFollowUpEvidenceLink
                .follow_up_action_id == action.id,
                AuditMaturityFollowUpEvidenceLink.evidence_id
                == evidence.id,
            )
            .first()
        )

        if existing is not None:
            raise MaturityFollowUpActionConflictError(
                "Evidence is already linked to this action."
            )

        link = AuditMaturityFollowUpEvidenceLink(
            tenant_id=tenant_id,
            follow_up_action_id=action.id,
            evidence_id=evidence.id,
            linked_by=actor_id,
            note=(note or "").strip() or None,
        )

        db.add(link)
        db.flush()

        cls._event(
            db,
            action=action,
            actor_id=actor_id,
            actor_role=actor_role,
            event_action="EVIDENCE_LINKED",
            from_status=action.status,
            to_status=action.status,
            comment=(
                "Evidence #" + str(evidence.id)
                + " linked."
            ),
        )

        if commit:
            db.commit()
            db.refresh(link)
        else:
            db.flush()

        return link

    @classmethod
    def unlink_evidence(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        action_id: int,
        evidence_id: int,
        actor_id: int,
        actor_role: str | None = None,
        comment: str | None = None,
        commit: bool = True,
    ) -> None:
        action = cls.get_action(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            action_id=action_id,
        )

        cls._assert_not_terminal(action)

        cls._get_tenant_user(
            db,
            tenant_id=tenant_id,
            user_id=actor_id,
        )

        link = (
            db.query(AuditMaturityFollowUpEvidenceLink)
            .filter(
                AuditMaturityFollowUpEvidenceLink.tenant_id
                == tenant_id,
                AuditMaturityFollowUpEvidenceLink
                .follow_up_action_id == action.id,
                AuditMaturityFollowUpEvidenceLink.evidence_id
                == evidence_id,
            )
            .first()
        )

        if link is None:
            raise MaturityFollowUpActionNotFoundError(
                "Follow-up evidence link not found."
            )

        db.delete(link)

        cls._event(
            db,
            action=action,
            actor_id=actor_id,
            actor_role=actor_role,
            event_action="EVIDENCE_UNLINKED",
            from_status=action.status,
            to_status=action.status,
            comment=(
                comment
                or (
                    "Evidence #"
                    + str(evidence_id)
                    + " unlinked."
                )
            ),
        )

        if commit:
            db.commit()
        else:
            db.flush()

    @classmethod
    def _require_verification_evidence(
        cls,
        db: Session,
        *,
        action: AuditMaturityFollowUpAction,
    ) -> None:
        count = (
            db.query(AuditMaturityFollowUpEvidenceLink.id)
            .join(
                Evidence,
                Evidence.id
                == AuditMaturityFollowUpEvidenceLink.evidence_id,
            )
            .filter(
                AuditMaturityFollowUpEvidenceLink.tenant_id
                == action.tenant_id,
                AuditMaturityFollowUpEvidenceLink
                .follow_up_action_id == action.id,
                Evidence.tenant_id == action.tenant_id,
                Evidence.assessment_type == "maturity",
                Evidence.is_deleted.is_(False),
                Evidence.status == "uploaded",
            )
            .count()
        )

        if count < 1:
            raise MaturityFollowUpActionConflictError(
                "At least one uploaded maturity evidence "
                "is required before verification."
            )

    @classmethod
    def assign_owner(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        action_id: int,
        assigned_owner_id: int,
        actor_id: int,
        actor_role: str | None = None,
        comment: str | None = None,
        commit: bool = True,
    ) -> AuditMaturityFollowUpAction:
        action = cls.get_action(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            action_id=action_id,
        )

        cls._assert_not_terminal(action)

        owner = cls._get_tenant_user(
            db,
            tenant_id=tenant_id,
            user_id=assigned_owner_id,
        )

        cls._get_tenant_user(
            db,
            tenant_id=tenant_id,
            user_id=actor_id,
        )

        old_owner = action.assigned_owner_id
        action.assigned_owner_id = owner.id
        action.updated_at = cls._now()

        cls._event(
            db,
            action=action,
            actor_id=actor_id,
            actor_role=actor_role,
            event_action="OWNER_ASSIGNED",
            from_status=action.status,
            to_status=action.status,
            comment=comment,
        )

        if old_owner == owner.id:
            action.updated_at = cls._now()

        return cls._save(db, action, commit=commit)

    @classmethod
    def start_action(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        action_id: int,
        actor_id: int,
        actor_role: str | None = None,
        comment: str | None = None,
        commit: bool = True,
    ) -> AuditMaturityFollowUpAction:
        action = cls.get_action(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            action_id=action_id,
        )

        cls._get_tenant_user(
            db,
            tenant_id=tenant_id,
            user_id=actor_id,
        )
        cls._assert_owner(action, actor_id=actor_id)

        if action.status != "OPEN":
            raise MaturityFollowUpActionConflictError(
                "Follow-up action can only start from OPEN."
            )

        old_status = action.status
        action.status = "IN_PROGRESS"
        action.started_at = cls._now()
        action.updated_at = cls._now()

        cls._event(
            db,
            action=action,
            actor_id=actor_id,
            actor_role=actor_role,
            event_action="WORK_STARTED",
            from_status=old_status,
            to_status=action.status,
            comment=comment,
        )

        return cls._save(db, action, commit=commit)

    @classmethod
    def block_action(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        action_id: int,
        actor_id: int,
        actor_role: str | None = None,
        comment: str | None = None,
        commit: bool = True,
    ) -> AuditMaturityFollowUpAction:
        action = cls.get_action(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            action_id=action_id,
        )

        cls._get_tenant_user(
            db,
            tenant_id=tenant_id,
            user_id=actor_id,
        )
        cls._assert_owner(action, actor_id=actor_id)

        if action.status != "IN_PROGRESS":
            raise MaturityFollowUpActionConflictError(
                "Only IN_PROGRESS actions can be blocked."
            )

        old_status = action.status
        action.status = "BLOCKED"
        action.updated_at = cls._now()

        cls._event(
            db,
            action=action,
            actor_id=actor_id,
            actor_role=actor_role,
            event_action="WORK_BLOCKED",
            from_status=old_status,
            to_status=action.status,
            comment=comment,
        )

        return cls._save(db, action, commit=commit)

    @classmethod
    def resume_action(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        action_id: int,
        actor_id: int,
        actor_role: str | None = None,
        comment: str | None = None,
        commit: bool = True,
    ) -> AuditMaturityFollowUpAction:
        action = cls.get_action(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            action_id=action_id,
        )

        cls._get_tenant_user(
            db,
            tenant_id=tenant_id,
            user_id=actor_id,
        )
        cls._assert_owner(action, actor_id=actor_id)

        if action.status not in {
            "BLOCKED",
            "VERIFICATION_FAILED",
        }:
            raise MaturityFollowUpActionConflictError(
                "Follow-up action cannot be resumed from "
                + str(action.status)
                + "."
            )

        old_status = action.status
        action.status = "IN_PROGRESS"
        action.verifier_id = None
        action.verified_at = None
        action.verification_comment = None
        action.submitted_for_verification_at = None
        action.completed_at = None
        action.updated_at = cls._now()

        cls._event(
            db,
            action=action,
            actor_id=actor_id,
            actor_role=actor_role,
            event_action="WORK_RESUMED",
            from_status=old_status,
            to_status=action.status,
            comment=comment,
        )

        return cls._save(db, action, commit=commit)

    @classmethod
    def submit_for_verification(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        action_id: int,
        actor_id: int,
        completion_note: str,
        actor_role: str | None = None,
        comment: str | None = None,
        commit: bool = True,
    ) -> AuditMaturityFollowUpAction:
        action = cls.get_action(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            action_id=action_id,
        )

        cls._get_tenant_user(
            db,
            tenant_id=tenant_id,
            user_id=actor_id,
        )
        cls._assert_owner(action, actor_id=actor_id)

        if action.status != "IN_PROGRESS":
            raise MaturityFollowUpActionConflictError(
                "Only IN_PROGRESS actions can be submitted."
            )

        clean_note = (completion_note or "").strip()

        if not clean_note:
            raise MaturityFollowUpActionError(
                "Completion note is required."
            )

        cls._require_verification_evidence(
            db,
            action=action,
        )

        old_status = action.status
        action.status = "READY_FOR_VERIFICATION"
        action.completion_note = clean_note
        action.submitted_for_verification_at = cls._now()
        action.verifier_id = None
        action.verified_at = None
        action.verification_comment = None
        action.completed_at = None
        action.updated_at = cls._now()

        cls._event(
            db,
            action=action,
            actor_id=actor_id,
            actor_role=actor_role,
            event_action="SUBMITTED_FOR_VERIFICATION",
            from_status=old_status,
            to_status=action.status,
            comment=comment,
        )

        return cls._save(db, action, commit=commit)

    @classmethod
    def verify_action(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        action_id: int,
        actor_id: int,
        effective: bool,
        comment: str,
        actor_role: str | None = None,
        commit: bool = True,
    ) -> AuditMaturityFollowUpAction:
        action = cls.get_action(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            action_id=action_id,
        )

        cls._get_tenant_user(
            db,
            tenant_id=tenant_id,
            user_id=actor_id,
        )

        if action.status != "READY_FOR_VERIFICATION":
            raise MaturityFollowUpActionConflictError(
                "Verification is not allowed while action is "
                + str(action.status)
                + "."
            )

        if action.assigned_owner_id == actor_id:
            raise MaturityFollowUpActionConflictError(
                "Assigned owner cannot verify own follow-up action."
            )

        if not isinstance(effective, bool):
            raise MaturityFollowUpActionError(
                "effective must be true or false."
            )

        clean_comment = (comment or "").strip()

        if not clean_comment:
            raise MaturityFollowUpActionError(
                "Verification comment is required."
            )

        old_status = action.status

        action.verifier_id = actor_id
        action.verified_at = cls._now()
        action.verification_comment = clean_comment

        if effective:
            action.status = "COMPLETED"
            action.completed_at = cls._now()
            event_action = "VERIFIED_AND_COMPLETED"
        else:
            action.status = "VERIFICATION_FAILED"
            action.completed_at = None
            event_action = "VERIFICATION_FAILED"

        action.updated_at = cls._now()

        cls._event(
            db,
            action=action,
            actor_id=actor_id,
            actor_role=actor_role,
            event_action=event_action,
            from_status=old_status,
            to_status=action.status,
            comment=clean_comment,
        )

        return cls._save(db, action, commit=commit)

    @classmethod
    def cancel_action(
        cls,
        db: Session,
        *,
        tenant_id: int,
        assessment_id: int,
        action_id: int,
        actor_id: int,
        actor_role: str | None = None,
        comment: str | None = None,
        commit: bool = True,
    ) -> AuditMaturityFollowUpAction:
        action = cls.get_action(
            db,
            tenant_id=tenant_id,
            assessment_id=assessment_id,
            action_id=action_id,
        )

        cls._get_tenant_user(
            db,
            tenant_id=tenant_id,
            user_id=actor_id,
        )

        if action.status not in {
            "OPEN",
            "IN_PROGRESS",
            "BLOCKED",
        }:
            raise MaturityFollowUpActionConflictError(
                "Follow-up action cannot be cancelled from "
                + str(action.status)
                + "."
            )

        old_status = action.status
        action.status = "CANCELLED"
        action.updated_at = cls._now()

        cls._event(
            db,
            action=action,
            actor_id=actor_id,
            actor_role=actor_role,
            event_action="ACTION_CANCELLED",
            from_status=old_status,
            to_status=action.status,
            comment=comment,
        )

        return cls._save(db, action, commit=commit)
