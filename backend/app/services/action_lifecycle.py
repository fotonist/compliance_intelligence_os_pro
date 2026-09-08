from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.actions import Action
from app.models.action_lifecycle_history import ActionLifecycleHistory


STATUS_OPEN = "OPEN"
STATUS_ASSIGNED = "ASSIGNED"
STATUS_IN_PROGRESS = "IN_PROGRESS"
STATUS_SUBMITTED_FOR_REVIEW = "SUBMITTED_FOR_REVIEW"
STATUS_REVISION_REQUIRED = "REVISION_REQUIRED"
STATUS_VERIFIED = "VERIFIED"
STATUS_CLOSED = "CLOSED"


TRANSITIONS = {
    STATUS_OPEN: {
        "assign": STATUS_ASSIGNED,
    },
    STATUS_ASSIGNED: {
        "start": STATUS_IN_PROGRESS,
    },
    STATUS_IN_PROGRESS: {
        "submit_for_review": STATUS_SUBMITTED_FOR_REVIEW,
    },
    STATUS_SUBMITTED_FOR_REVIEW: {
        "request_revision": STATUS_REVISION_REQUIRED,
        "verify": STATUS_VERIFIED,
    },
    STATUS_REVISION_REQUIRED: {
        "start": STATUS_IN_PROGRESS,
    },
    STATUS_VERIFIED: {
        "close": STATUS_CLOSED,
    },
    STATUS_CLOSED: {
        "reopen": STATUS_IN_PROGRESS,
    },
}


def normalize_role(value: str) -> str:
    return (
        str(value)
        .strip()
        .lower()
        .replace("-", "_")
        .replace(" ", "_")
    )


def get_user_roles(user) -> set[str]:
    return {
        normalize_role(role.name)
        for role in (user.roles or [])
        if getattr(role, "name", None)
    }


def has_any_role(user, roles: set[str]) -> bool:
    user_roles = get_user_roles(user)

    if "superadmin" in user_roles:
        return True

    if "super_admin" in user_roles:
        return True

    return bool(user_roles.intersection(roles))


def require_transition_role(user, transition: str) -> None:
    role_map = {
        "assign": {
            "admin",
            "audit_manager",
            "lead_auditor",
            "auditor",
        },
        "start": {
            "admin",
            "audit_manager",
            "lead_auditor",
            "auditor",
        },
        "submit_for_review": {
            "admin",
            "audit_manager",
            "lead_auditor",
            "auditor",
        },
        "request_revision": {
            "admin",
            "audit_manager",
            "lead_auditor",
            "auditor",
        },
        "verify": {
            "admin",
            "audit_manager",
            "lead_auditor",
        },
        "close": {
            "admin",
            "audit_manager",
            "lead_auditor",
        },
        "reopen": {
            "admin",
            "audit_manager",
            "lead_auditor",
        },
    }

    allowed = role_map.get(transition)

    if allowed is None:
        raise HTTPException(
            status_code=403,
            detail="Transition is not authorized",
        )

    if not has_any_role(user, allowed):
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions for this transition",
        )


def get_action_or_404(
    db: Session,
    action_id: int,
) -> Action:
    action = (
        db.query(Action)
        .filter(Action.id == action_id)
        .first()
    )

    if action is None:
        raise HTTPException(
            status_code=404,
            detail="Action not found",
        )

    return action


def require_reviewer(action: Action, actor) -> None:
    reviewer_id = action.reviewer_user_id

    if reviewer_id is None:
        raise HTTPException(
            status_code=409,
            detail=(
                "A reviewer must be assigned "
                "before the action can be reviewed."
            ),
        )

    if int(reviewer_id) != int(actor.id):
        raise HTTPException(
            status_code=403,
            detail=(
                "Only the assigned reviewer "
                "can review this action."
            ),
        )


def require_assignment_separation(
    assigned_to_user_id: int,
    reviewer_user_id: int | None,
) -> None:
    if reviewer_user_id is None:
        return

    if int(assigned_to_user_id) == int(reviewer_user_id):
        raise HTTPException(
            status_code=422,
            detail=(
                "The assigned action owner and reviewer "
                "must be different users."
            ),
        )


def transition_action(
    db: Session,
    action: Action,
    transition: str,
    actor,
    comment: str | None = None,
    assigned_to_user_id: int | None = None,
    reviewer_user_id: int | None = None,
) -> Action:
    require_transition_role(actor, transition)

    current_status = (
        str(action.status).upper()
        if action.status
        else STATUS_OPEN
    )

    transition_map = TRANSITIONS.get(current_status, {})
    next_status = transition_map.get(transition)

    if next_status is None:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Invalid transition: {current_status} -> {transition}"
            ),
        )

    if transition == "assign":
        if assigned_to_user_id is None:
            raise HTTPException(
                status_code=422,
                detail="assigned_to_user_id is required",
            )

        require_assignment_separation(
            assigned_to_user_id,
            reviewer_user_id,
        )

    assigned_owner_id = (
        action.assigned_to_user_id
        or action.owner_id
    )

    if transition == "submit_for_review":
        if assigned_owner_id is None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "An action must have an assigned owner "
                    "before it can be submitted for review."
                ),
            )

        if int(assigned_owner_id) != int(actor.id):
            raise HTTPException(
                status_code=403,
                detail=(
                    "Only the assigned action owner "
                    "can submit the action for review."
                ),
            )

    if transition == "start":
        if action.assigned_to_user_id is None:
            raise HTTPException(
                status_code=409,
                detail="Action must be assigned before it can start.",
            )

        if int(action.assigned_to_user_id) != int(actor.id):
            raise HTTPException(
                status_code=403,
                detail=(
                    "Only the assigned action owner "
                    "can start the action."
                ),
            )

    if transition in {"request_revision", "verify"}:
        require_reviewer(action, actor)

    if transition in {"verify", "close"}:
        if assigned_owner_id is not None and int(assigned_owner_id) == int(actor.id):
            raise HTTPException(
                status_code=403,
                detail=(
                    "Segregation of duties violation: "
                    "the assigned action owner cannot verify or close the action."
                ),
            )

    if transition == "close":
        if action.reviewer_user_id is not None and int(action.reviewer_user_id) == int(actor.id):
            raise HTTPException(
                status_code=403,
                detail=(
                    "The reviewer cannot close the action. "
                    "Closure requires a separate authorized actor."
                ),
            )

    if transition == "reopen":
        if action.closed_by_user_id is not None and int(action.closed_by_user_id) == int(actor.id):
            raise HTTPException(
                status_code=403,
                detail=(
                    "The user who closed the action "
                    "cannot reopen the same action."
                ),
            )

    now = datetime.utcnow()

    if transition == "assign":
        action.assigned_to_user_id = assigned_to_user_id
        action.owner_id = assigned_to_user_id
        action.assigned_at = now
        action.reviewer_user_id = reviewer_user_id

    if transition == "start":
        action.started_at = now

    if transition == "submit_for_review":
        action.submitted_for_review_at = now

    if transition == "request_revision":
        action.reviewed_at = now
        action.review_comment = comment

    if transition == "verify":
        action.reviewed_at = now
        action.verified_at = now
        action.verification_comment = comment

    if transition == "close":
        action.closed_at = now
        action.closed_by_user_id = actor.id
        action.closure_comment = comment

    if transition == "reopen":
        action.closed_at = None
        action.closed_by_user_id = None
        action.verified_at = None
        action.verification_comment = None

    history = ActionLifecycleHistory(
        action_id=action.id,
        from_status=current_status,
        to_status=next_status,
        performed_by_user_id=actor.id,
        comment=comment,
        created_at=now,
    )

    action.status = next_status

    db.add(action)
    db.add(history)
    db.commit()
    db.refresh(action)

    return action
