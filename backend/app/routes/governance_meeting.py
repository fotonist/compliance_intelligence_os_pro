from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user
from app.dependencies.permission_checker import require_permission

from app.models.user import User
from app.models.governance_meeting import GovernanceMeeting
from app.models.governance_meeting_participant import GovernanceMeetingParticipant
from app.models.governance_meeting_agenda_item import GovernanceMeetingAgendaItem
from app.models.governance_meeting_decision import GovernanceMeetingDecision
from app.models.governance_meeting_action import GovernanceMeetingAction
from app.models.governance_meeting_history import GovernanceMeetingHistory
from app.models.decision_register import DecisionRegister
from app.models.actions import Action

from app.schemas.governance_meeting import (
    GovernanceMeetingCreate,
    GovernanceMeetingUpdate,
    GovernanceMeetingRead,
    GovernanceMeetingListItem,
    GovernanceMeetingParticipantCreate,
    GovernanceMeetingParticipantUpdate,
    GovernanceMeetingParticipantRead,
    GovernanceMeetingAgendaItemCreate,
    GovernanceMeetingAgendaItemUpdate,
    GovernanceMeetingAgendaItemRead,
    GovernanceMeetingDecisionLink,
    GovernanceMeetingDecisionRead,
    GovernanceMeetingActionLink,
    GovernanceMeetingActionRead,
    GovernanceMeetingHistoryRead,
)


router = APIRouter(
    prefix="/governance-meetings",
    tags=["Governance Meetings"],
)


# ==========================================================
# HELPERS
# ==========================================================

def get_meeting_or_404(
    db: Session,
    meeting_id: int,
    user: User,
) -> GovernanceMeeting:

    meeting = db.execute(
        select(GovernanceMeeting).where(
            GovernanceMeeting.id == meeting_id,
            GovernanceMeeting.tenant_id == user.tenant_id,
            GovernanceMeeting.is_deleted == False,
        )
    ).scalar_one_or_none()

    if meeting is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Governance meeting not found.",
        )

    return meeting


def validate_user_tenant(
    db: Session,
    user_id: int,
    tenant_id: int,
    label: str = "User",
):
    obj = db.execute(
        select(User).where(
            User.id == user_id,
            User.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if obj is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label} does not belong to the current tenant.",
        )

    return obj


def add_history(
    db: Session,
    meeting: GovernanceMeeting,
    action: str,
    user_id: int,
    field_name: str | None = None,
    old_value: str | None = None,
    new_value: str | None = None,
    comment: str | None = None,
):
    db.add(
        GovernanceMeetingHistory(
            meeting_id=meeting.id,
            action=action,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            comment=comment,
            performed_by=user_id,
        )
    )


# ==========================================================
# LIST
# ==========================================================

@router.get(
    "",
    response_model=list[GovernanceMeetingListItem],
    dependencies=[
        Depends(require_permission("governance_meeting.view")),
    ],
)
def list_governance_meetings(
    status_filter: str | None = Query(
        default=None,
        alias="status",
    ),
    meeting_type: str | None = None,
    keyword: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(GovernanceMeeting).where(
        GovernanceMeeting.tenant_id == user.tenant_id,
        GovernanceMeeting.is_deleted == False,
    )

    if status_filter:
        query = query.where(
            GovernanceMeeting.status == status_filter
        )

    if meeting_type:
        query = query.where(
            GovernanceMeeting.meeting_type == meeting_type
        )

    if keyword:
        search = f"%{keyword.strip()}%"
        query = query.where(
            GovernanceMeeting.title.ilike(search)
            | GovernanceMeeting.meeting_code.ilike(search)
            | GovernanceMeeting.description.ilike(search)
        )

    query = query.order_by(
        GovernanceMeeting.scheduled_at.desc(),
        GovernanceMeeting.created_at.desc(),
    )

    return db.execute(query).scalars().all()


# ==========================================================
# GET
# ==========================================================

@router.get(
    "/{meeting_id}",
    response_model=GovernanceMeetingRead,
    dependencies=[
        Depends(require_permission("governance_meeting.view")),
    ],
)
def get_governance_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return get_meeting_or_404(db, meeting_id, user)


# ==========================================================
# CREATE
# ==========================================================

@router.post(
    "",
    response_model=GovernanceMeetingRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(require_permission("governance_meeting.create")),
    ],
)
def create_governance_meeting(
    payload: GovernanceMeetingCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    duplicate = db.execute(
        select(GovernanceMeeting).where(
            GovernanceMeeting.tenant_id == user.tenant_id,
            GovernanceMeeting.meeting_code == payload.meeting_code,
            GovernanceMeeting.is_deleted == False,
        )
    ).scalar_one_or_none()

    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Meeting code already exists.",
        )

    if payload.chairperson_id:
        validate_user_tenant(
            db,
            payload.chairperson_id,
            user.tenant_id,
            "Chairperson",
        )

    meeting = GovernanceMeeting(
        tenant_id=user.tenant_id,
        meeting_code=payload.meeting_code.strip(),
        title=payload.title.strip(),
        meeting_type=payload.meeting_type.strip(),
        scheduled_at=payload.scheduled_at,
        duration_minutes=payload.duration_minutes,
        location=payload.location,
        description=payload.description,
        chairperson_id=payload.chairperson_id,
        created_by=user.id,
        updated_by=user.id,
    )

    db.add(meeting)
    db.flush()

    add_history(
        db=db,
        meeting=meeting,
        action="created",
        user_id=user.id,
        comment="Governance meeting created.",
    )

    db.commit()
    db.refresh(meeting)

    return meeting


# ==========================================================
# UPDATE
# ==========================================================

@router.patch(
    "/{meeting_id}",
    response_model=GovernanceMeetingRead,
    dependencies=[
        Depends(require_permission("governance_meeting.edit")),
    ],
)
def update_governance_meeting(
    meeting_id: int,
    payload: GovernanceMeetingUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    meeting = get_meeting_or_404(db, meeting_id, user)

    changes = payload.model_dump(exclude_unset=True)

    if "meeting_code" in changes:
        duplicate = db.execute(
            select(GovernanceMeeting).where(
                GovernanceMeeting.tenant_id == user.tenant_id,
                GovernanceMeeting.meeting_code == changes["meeting_code"],
                GovernanceMeeting.id != meeting.id,
                GovernanceMeeting.is_deleted == False,
            )
        ).scalar_one_or_none()

        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Meeting code already exists.",
            )

    if "chairperson_id" in changes and changes["chairperson_id"]:
        validate_user_tenant(
            db,
            changes["chairperson_id"],
            user.tenant_id,
            "Chairperson",
        )

    for field_name, new_value in changes.items():
        old_value = getattr(meeting, field_name)

        if old_value == new_value:
            continue

        if isinstance(new_value, str):
            new_value = new_value.strip()
            changes[field_name] = new_value

        add_history(
            db=db,
            meeting=meeting,
            action="updated",
            user_id=user.id,
            field_name=field_name,
            old_value=(
                old_value.isoformat()
                if isinstance(old_value, datetime)
                else str(old_value)
                if old_value is not None
                else None
            ),
            new_value=(
                new_value.isoformat()
                if isinstance(new_value, datetime)
                else str(new_value)
                if new_value is not None
                else None
            ),
        )

        setattr(meeting, field_name, new_value)

    meeting.updated_by = user.id
    meeting.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(meeting)

    return meeting


# ==========================================================
# DELETE / SOFT DELETE
# ==========================================================

@router.delete(
    "/{meeting_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[
        Depends(require_permission("governance_meeting.delete")),
    ],
)
def delete_governance_meeting(
    meeting_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    meeting = get_meeting_or_404(db, meeting_id, user)

    meeting.is_deleted = True
    meeting.updated_by = user.id
    meeting.updated_at = datetime.utcnow()

    add_history(
        db=db,
        meeting=meeting,
        action="deleted",
        user_id=user.id,
        field_name="is_deleted",
        old_value="False",
        new_value="True",
        comment="Governance meeting soft deleted.",
    )

    db.commit()

    return None


# ==========================================================
# PARTICIPANTS - LIST
# ==========================================================

@router.get(
    "/{meeting_id}/participants",
    response_model=list[GovernanceMeetingParticipantRead],
    dependencies=[
        Depends(require_permission("governance_meeting.manage_participants")),
    ],
)
def list_participants(
    meeting_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    meeting = get_meeting_or_404(db, meeting_id, user)

    return db.execute(
        select(GovernanceMeetingParticipant)
        .where(
            GovernanceMeetingParticipant.meeting_id == meeting.id
        )
        .order_by(
            GovernanceMeetingParticipant.created_at.asc()
        )
    ).scalars().all()


# ==========================================================
# PARTICIPANTS - CREATE
# ==========================================================

@router.post(
    "/{meeting_id}/participants",
    response_model=GovernanceMeetingParticipantRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(require_permission("governance_meeting.manage_participants")),
    ],
)
def add_participant(
    meeting_id: int,
    payload: GovernanceMeetingParticipantCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    meeting = get_meeting_or_404(db, meeting_id, user)

    validate_user_tenant(
        db,
        payload.user_id,
        user.tenant_id,
        "Participant",
    )

    duplicate = db.execute(
        select(GovernanceMeetingParticipant).where(
            GovernanceMeetingParticipant.meeting_id == meeting.id,
            GovernanceMeetingParticipant.user_id == payload.user_id,
        )
    ).scalar_one_or_none()

    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a participant.",
        )

    participant = GovernanceMeetingParticipant(
        meeting_id=meeting.id,
        user_id=payload.user_id,
        role=payload.role,
        attendance_status=payload.attendance_status,
    )

    db.add(participant)

    add_history(
        db=db,
        meeting=meeting,
        action="participant_added",
        user_id=user.id,
        new_value=str(payload.user_id),
    )

    db.commit()
    db.refresh(participant)

    return participant


# ==========================================================
# PARTICIPANTS - UPDATE
# ==========================================================

@router.patch(
    "/{meeting_id}/participants/{participant_id}",
    response_model=GovernanceMeetingParticipantRead,
    dependencies=[
        Depends(require_permission("governance_meeting.manage_participants")),
    ],
)
def update_participant(
    meeting_id: int,
    participant_id: int,
    payload: GovernanceMeetingParticipantUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    meeting = get_meeting_or_404(db, meeting_id, user)

    participant = db.execute(
        select(GovernanceMeetingParticipant).where(
            GovernanceMeetingParticipant.id == participant_id,
            GovernanceMeetingParticipant.meeting_id == meeting.id,
        )
    ).scalar_one_or_none()

    if participant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting participant not found.",
        )

    changes = payload.model_dump(exclude_unset=True)

    for field_name, new_value in changes.items():
        old_value = getattr(participant, field_name)

        if old_value == new_value:
            continue

        setattr(participant, field_name, new_value)

        add_history(
            db=db,
            meeting=meeting,
            action="participant_updated",
            user_id=user.id,
            field_name=field_name,
            old_value=str(old_value) if old_value is not None else None,
            new_value=str(new_value) if new_value is not None else None,
        )

    db.commit()
    db.refresh(participant)

    return participant


# ==========================================================
# PARTICIPANTS - DELETE
# ==========================================================

@router.delete(
    "/{meeting_id}/participants/{participant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[
        Depends(require_permission("governance_meeting.manage_participants")),
    ],
)
def delete_participant(
    meeting_id: int,
    participant_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    meeting = get_meeting_or_404(db, meeting_id, user)

    participant = db.execute(
        select(GovernanceMeetingParticipant).where(
            GovernanceMeetingParticipant.id == participant_id,
            GovernanceMeetingParticipant.meeting_id == meeting.id,
        )
    ).scalar_one_or_none()

    if participant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting participant not found.",
        )

    participant_user_id = participant.user_id

    db.delete(participant)

    add_history(
        db=db,
        meeting=meeting,
        action="participant_removed",
        user_id=user.id,
        old_value=str(participant_user_id),
    )

    db.commit()

    return None


# ==========================================================
# AGENDA - LIST
# ==========================================================

@router.get(
    "/{meeting_id}/agenda",
    response_model=list[GovernanceMeetingAgendaItemRead],
    dependencies=[
        Depends(require_permission("governance_meeting.manage_agenda")),
    ],
)
def list_agenda(
    meeting_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    meeting = get_meeting_or_404(db, meeting_id, user)

    return db.execute(
        select(GovernanceMeetingAgendaItem)
        .where(
            GovernanceMeetingAgendaItem.meeting_id == meeting.id
        )
        .order_by(
            GovernanceMeetingAgendaItem.item_order.asc()
        )
    ).scalars().all()


# ==========================================================
# AGENDA - CREATE
# ==========================================================

@router.post(
    "/{meeting_id}/agenda",
    response_model=GovernanceMeetingAgendaItemRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(require_permission("governance_meeting.manage_agenda")),
    ],
)
def create_agenda_item(
    meeting_id: int,
    payload: GovernanceMeetingAgendaItemCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    meeting = get_meeting_or_404(db, meeting_id, user)

    if payload.presenter_id:
        validate_user_tenant(
            db,
            payload.presenter_id,
            user.tenant_id,
            "Presenter",
        )

    item = GovernanceMeetingAgendaItem(
        meeting_id=meeting.id,
        item_order=payload.item_order,
        title=payload.title.strip(),
        description=payload.description,
        presenter_id=payload.presenter_id,
        status=payload.status,
    )

    db.add(item)

    add_history(
        db=db,
        meeting=meeting,
        action="agenda_item_added",
        user_id=user.id,
        new_value=payload.title.strip(),
    )

    db.commit()
    db.refresh(item)

    return item


# ==========================================================
# AGENDA - UPDATE
# ==========================================================

@router.patch(
    "/{meeting_id}/agenda/{item_id}",
    response_model=GovernanceMeetingAgendaItemRead,
    dependencies=[
        Depends(require_permission("governance_meeting.manage_agenda")),
    ],
)
def update_agenda_item(
    meeting_id: int,
    item_id: int,
    payload: GovernanceMeetingAgendaItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    meeting = get_meeting_or_404(db, meeting_id, user)

    item = db.execute(
        select(GovernanceMeetingAgendaItem).where(
            GovernanceMeetingAgendaItem.id == item_id,
            GovernanceMeetingAgendaItem.meeting_id == meeting.id,
        )
    ).scalar_one_or_none()

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agenda item not found.",
        )

    changes = payload.model_dump(exclude_unset=True)

    if "presenter_id" in changes and changes["presenter_id"]:
        validate_user_tenant(
            db,
            changes["presenter_id"],
            user.tenant_id,
            "Presenter",
        )

    for field_name, new_value in changes.items():
        old_value = getattr(item, field_name)

        if isinstance(new_value, str):
            new_value = new_value.strip()

        if old_value == new_value:
            continue

        setattr(item, field_name, new_value)

        add_history(
            db=db,
            meeting=meeting,
            action="agenda_item_updated",
            user_id=user.id,
            field_name=field_name,
            old_value=str(old_value) if old_value is not None else None,
            new_value=str(new_value) if new_value is not None else None,
        )

    item.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(item)

    return item


# ==========================================================
# AGENDA - DELETE
# ==========================================================

@router.delete(
    "/{meeting_id}/agenda/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[
        Depends(require_permission("governance_meeting.manage_agenda")),
    ],
)
def delete_agenda_item(
    meeting_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    meeting = get_meeting_or_404(db, meeting_id, user)

    item = db.execute(
        select(GovernanceMeetingAgendaItem).where(
            GovernanceMeetingAgendaItem.id == item_id,
            GovernanceMeetingAgendaItem.meeting_id == meeting.id,
        )
    ).scalar_one_or_none()

    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agenda item not found.",
        )

    title = item.title

    db.delete(item)

    add_history(
        db=db,
        meeting=meeting,
        action="agenda_item_removed",
        user_id=user.id,
        old_value=title,
    )

    db.commit()

    return None


# ==========================================================
# DECISIONS - LIST
# ==========================================================

@router.get(
    "/{meeting_id}/decisions",
    response_model=list[GovernanceMeetingDecisionRead],
    dependencies=[
        Depends(require_permission("governance_meeting.manage_decisions")),
    ],
)
def list_decisions(
    meeting_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    meeting = get_meeting_or_404(db, meeting_id, user)

    return db.execute(
        select(GovernanceMeetingDecision)
        .join(
            DecisionRegister,
            DecisionRegister.id
            == GovernanceMeetingDecision.decision_register_id,
        )
        .where(
            GovernanceMeetingDecision.meeting_id == meeting.id,
            DecisionRegister.tenant_id == user.tenant_id,
            DecisionRegister.is_deleted == False,
        )
        .order_by(GovernanceMeetingDecision.created_at.asc())
    ).scalars().all()


# ==========================================================
# DECISIONS - LINK
# ==========================================================

@router.post(
    "/{meeting_id}/decisions",
    response_model=GovernanceMeetingDecisionRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(require_permission("governance_meeting.manage_decisions")),
    ],
)
def link_decision(
    meeting_id: int,
    payload: GovernanceMeetingDecisionLink,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    meeting = get_meeting_or_404(db, meeting_id, user)

    decision = db.execute(
        select(DecisionRegister).where(
            DecisionRegister.id == payload.decision_register_id,
            DecisionRegister.tenant_id == user.tenant_id,
            DecisionRegister.is_deleted == False,
        )
    ).scalar_one_or_none()

    if decision is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Decision register entry does not belong to the current tenant.",
        )

    duplicate = db.execute(
        select(GovernanceMeetingDecision).where(
            GovernanceMeetingDecision.meeting_id == meeting.id,
            GovernanceMeetingDecision.decision_register_id
            == decision.id,
        )
    ).scalar_one_or_none()

    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Decision is already linked to this meeting.",
        )

    link = GovernanceMeetingDecision(
        meeting_id=meeting.id,
        decision_register_id=decision.id,
    )

    db.add(link)

    add_history(
        db=db,
        meeting=meeting,
        action="decision_linked",
        user_id=user.id,
        new_value=str(decision.id),
    )

    db.commit()
    db.refresh(link)

    return link


# ==========================================================
# DECISIONS - UNLINK
# ==========================================================

@router.delete(
    "/{meeting_id}/decisions/{decision_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[
        Depends(require_permission("governance_meeting.manage_decisions")),
    ],
)
def unlink_decision(
    meeting_id: int,
    decision_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    meeting = get_meeting_or_404(db, meeting_id, user)

    link = db.execute(
        select(GovernanceMeetingDecision)
        .join(
            DecisionRegister,
            DecisionRegister.id
            == GovernanceMeetingDecision.decision_register_id,
        )
        .where(
            GovernanceMeetingDecision.id == decision_id,
            GovernanceMeetingDecision.meeting_id == meeting.id,
            DecisionRegister.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()

    if link is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting decision link not found.",
        )

    linked_decision_id = link.decision_register_id

    db.delete(link)

    add_history(
        db=db,
        meeting=meeting,
        action="decision_unlinked",
        user_id=user.id,
        old_value=str(linked_decision_id),
    )

    db.commit()

    return None


# ==========================================================
# ACTIONS - LIST
# ==========================================================

@router.get(
    "/{meeting_id}/actions",
    response_model=list[GovernanceMeetingActionRead],
    dependencies=[
        Depends(require_permission("governance_meeting.manage_actions")),
    ],
)
def list_actions(
    meeting_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    meeting = get_meeting_or_404(db, meeting_id, user)

    return db.execute(
        select(GovernanceMeetingAction)
        .join(
            Action,
            Action.id == GovernanceMeetingAction.action_id,
        )
        .where(
            GovernanceMeetingAction.meeting_id == meeting.id,
        )
    ).scalars().all()


# ==========================================================
# ACTIONS - LINK
# ==========================================================

@router.post(
    "/{meeting_id}/actions",
    response_model=GovernanceMeetingActionRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(require_permission("governance_meeting.manage_actions")),
    ],
)
def link_action(
    meeting_id: int,
    payload: GovernanceMeetingActionLink,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    meeting = get_meeting_or_404(db, meeting_id, user)

    action = db.execute(
        select(Action).where(
            Action.id == payload.action_id,
            Action.owner_id.is_not(None),
        )
    ).scalar_one_or_none()

    if action is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Action not found.",
        )

    owner = validate_user_tenant(
        db,
        action.owner_id,
        user.tenant_id,
        "Action owner",
    )

    duplicate = db.execute(
        select(GovernanceMeetingAction).where(
            GovernanceMeetingAction.meeting_id == meeting.id,
            GovernanceMeetingAction.action_id == action.id,
        )
    ).scalar_one_or_none()

    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Action is already linked to this meeting.",
        )

    link = GovernanceMeetingAction(
        meeting_id=meeting.id,
        action_id=action.id,
    )

    db.add(link)

    add_history(
        db=db,
        meeting=meeting,
        action="action_linked",
        user_id=user.id,
        new_value=str(action.id),
    )

    db.commit()
    db.refresh(link)

    return link


# ==========================================================
# ACTIONS - UNLINK
# ==========================================================

@router.delete(
    "/{meeting_id}/actions/{action_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[
        Depends(require_permission("governance_meeting.manage_actions")),
    ],
)
def unlink_action(
    meeting_id: int,
    action_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    meeting = get_meeting_or_404(db, meeting_id, user)

    link = db.execute(
        select(GovernanceMeetingAction)
        .where(
            GovernanceMeetingAction.id == action_id,
            GovernanceMeetingAction.meeting_id == meeting.id,
        )
    ).scalar_one_or_none()

    if link is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting action link not found.",
        )

    linked_action_id = link.action_id

    db.delete(link)

    add_history(
        db=db,
        meeting=meeting,
        action="action_unlinked",
        user_id=user.id,
        old_value=str(linked_action_id),
    )

    db.commit()

    return None


# ==========================================================
# HISTORY
# ==========================================================

@router.get(
    "/{meeting_id}/history",
    response_model=list[GovernanceMeetingHistoryRead],
    dependencies=[
        Depends(require_permission("governance_meeting.history")),
    ],
)
def list_meeting_history(
    meeting_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    meeting = get_meeting_or_404(db, meeting_id, user)

    return db.execute(
        select(GovernanceMeetingHistory)
        .where(
            GovernanceMeetingHistory.meeting_id == meeting.id
        )
        .order_by(
            GovernanceMeetingHistory.created_at.desc()
        )
    ).scalars().all()
