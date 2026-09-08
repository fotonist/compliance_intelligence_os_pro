from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.governance_committee import (
    GovernanceCommittee,
    GovernanceCommitteeMember,
)
from app.models.governance_committee_history import GovernanceCommitteeHistory
from app.models.governance_meeting import GovernanceMeeting
from app.models.user import User
from app.schemas.governance_committee import (
    GovernanceCommitteeCreate,
    GovernanceCommitteeDetailRead,
    GovernanceCommitteeHistoryRead,
    GovernanceCommitteeListItem,
    GovernanceCommitteeMemberCreate,
    GovernanceCommitteeMemberRead,
    GovernanceCommitteeMemberUpdate,
    GovernanceCommitteeRead,
    GovernanceCommitteeUpdate,
    GovernanceCommitteeMeetingSummary,
)
from app.core.security import get_current_user
from app.dependencies.permission_checker import require_permission


router = APIRouter(
    prefix="/governance-committees",
    tags=["Governance Committees"],
)


def get_committee_or_404(
    db: Session,
    committee_id: int,
    tenant_id: int,
) -> GovernanceCommittee:
    committee = db.execute(
        select(GovernanceCommittee).where(
            GovernanceCommittee.id == committee_id,
            GovernanceCommittee.tenant_id == tenant_id,
            GovernanceCommittee.is_deleted.is_(False),
        )
    ).scalar_one_or_none()

    if committee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Committee not found.",
        )

    return committee


def validate_user_tenant(
    db: Session,
    user_id: Optional[int],
    tenant_id: int,
    label: str = "User",
) -> None:
    if user_id is None:
        return

    user = db.execute(
        select(User).where(
            User.id == user_id,
            User.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{label} does not belong to the current tenant.",
        )


def add_history(
    db: Session,
    committee: GovernanceCommittee,
    *,
    action: str,
    performed_by: Optional[int],
    field_name: Optional[str] = None,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    comment: Optional[str] = None,
) -> GovernanceCommitteeHistory:
    history = GovernanceCommitteeHistory(
        tenant_id=committee.tenant_id,
        committee_id=committee.id,
        action=action,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        comment=comment,
        performed_by=performed_by,
    )

    db.add(history)
    return history


def build_meeting_summary(
    db: Session,
    committee_id: int,
    tenant_id: int,
) -> GovernanceCommitteeMeetingSummary:
    base_filter = (
        GovernanceMeeting.committee_id == committee_id,
        GovernanceMeeting.tenant_id == tenant_id,
        GovernanceMeeting.is_deleted.is_(False),
    )

    total = db.scalar(
        select(func.count(GovernanceMeeting.id)).where(*base_filter)
    ) or 0

    scheduled = db.scalar(
        select(func.count(GovernanceMeeting.id)).where(
            *base_filter,
            GovernanceMeeting.status == "SCHEDULED",
        )
    ) or 0

    completed = db.scalar(
        select(func.count(GovernanceMeeting.id)).where(
            *base_filter,
            GovernanceMeeting.status == "COMPLETED",
        )
    ) or 0

    cancelled = db.scalar(
        select(func.count(GovernanceMeeting.id)).where(
            *base_filter,
            GovernanceMeeting.status == "CANCELLED",
        )
    ) or 0

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    next_meeting = db.execute(
        select(GovernanceMeeting)
        .where(
            *base_filter,
            GovernanceMeeting.status == "SCHEDULED",
            GovernanceMeeting.scheduled_at >= now,
        )
        .order_by(GovernanceMeeting.scheduled_at.asc())
        .limit(1)
    ).scalar_one_or_none()

    return GovernanceCommitteeMeetingSummary(
        total=total,
        scheduled=scheduled,
        completed=completed,
        cancelled=cancelled,
        next_meeting_id=next_meeting.id if next_meeting else None,
        next_meeting_code=next_meeting.meeting_code if next_meeting else None,
        next_meeting_title=next_meeting.title if next_meeting else None,
        next_meeting_at=next_meeting.scheduled_at if next_meeting else None,
    )


@router.get(
    "",
    response_model=list[GovernanceCommitteeListItem],
)
def list_committees(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    committee_type: Optional[str] = Query(default=None),
    keyword: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("governance_committee.view")
    ),
):
    conditions = [
        GovernanceCommittee.tenant_id == current_user.tenant_id,
        GovernanceCommittee.is_deleted.is_(False),
    ]

    if status_filter:
        conditions.append(
            GovernanceCommittee.status == status_filter
        )

    if committee_type:
        conditions.append(
            GovernanceCommittee.committee_type == committee_type
        )

    if keyword:
        pattern = f"%{keyword.strip()}%"
        conditions.append(
            or_(
                GovernanceCommittee.committee_code.ilike(pattern),
                GovernanceCommittee.name.ilike(pattern),
                GovernanceCommittee.description.ilike(pattern),
            )
        )

    return db.execute(
        select(GovernanceCommittee)
        .where(and_(*conditions))
        .order_by(
            GovernanceCommittee.status.asc(),
            GovernanceCommittee.name.asc(),
        )
        .offset(skip)
        .limit(limit)
    ).scalars().all()


@router.get(
    "/{committee_id}",
    response_model=GovernanceCommitteeDetailRead,
)
def get_committee(
    committee_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("governance_committee.view")
    ),
):
    committee = get_committee_or_404(
        db,
        committee_id,
        current_user.tenant_id,
    )

    members = db.execute(
        select(GovernanceCommitteeMember)
        .where(
            GovernanceCommitteeMember.committee_id == committee.id,
            GovernanceCommitteeMember.tenant_id == current_user.tenant_id,
        )
        .order_by(
            GovernanceCommitteeMember.status.asc(),
            GovernanceCommitteeMember.member_role.asc(),
            GovernanceCommitteeMember.id.asc(),
        )
    ).scalars().all()

    member_count = len(members)
    voting_member_count = sum(
        1 for member in members if member.is_voting_member
    )

    meeting_summary = build_meeting_summary(
        db,
        committee.id,
        current_user.tenant_id,
    )

    return GovernanceCommitteeDetailRead(
        **GovernanceCommitteeRead.model_validate(committee).model_dump(),
        members=[
            GovernanceCommitteeMemberRead.model_validate(member)
            for member in members
        ],
        meeting_summary=meeting_summary,
        member_count=member_count,
        voting_member_count=voting_member_count,
    )


@router.post(
    "",
    response_model=GovernanceCommitteeRead,
    status_code=status.HTTP_201_CREATED,
)
def create_committee(
    payload: GovernanceCommitteeCreate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("governance_committee.create")
    ),
):
    validate_user_tenant(
        db,
        payload.chairperson_id,
        current_user.tenant_id,
        "Chairperson",
    )

    validate_user_tenant(
        db,
        payload.secretary_id,
        current_user.tenant_id,
        "Secretary",
    )

    duplicate = db.execute(
        select(GovernanceCommittee.id).where(
            GovernanceCommittee.tenant_id == current_user.tenant_id,
            GovernanceCommittee.committee_code == payload.committee_code,
        )
    ).scalar_one_or_none()

    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Committee code already exists.",
        )

    committee = GovernanceCommittee(
        tenant_id=current_user.tenant_id,
        committee_code=payload.committee_code,
        name=payload.name,
        committee_type=payload.committee_type,
        description=payload.description,
        chairperson_id=payload.chairperson_id,
        secretary_id=payload.secretary_id,
        status=payload.status,
        meeting_cadence=payload.meeting_cadence,
        effective_date=payload.effective_date,
        review_date=payload.review_date,
        created_by=current_user.id,
        updated_by=current_user.id,
    )

    db.add(committee)
    db.flush()

    add_history(
        db,
        committee,
        action="CREATED",
        performed_by=current_user.id,
        comment="Committee created.",
    )

    db.commit()
    db.refresh(committee)

    return committee


@router.patch(
    "/{committee_id}",
    response_model=GovernanceCommitteeRead,
)
def update_committee(
    committee_id: int,
    payload: GovernanceCommitteeUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("governance_committee.edit")
    ),
):
    committee = get_committee_or_404(
        db,
        committee_id,
        current_user.tenant_id,
    )

    data = payload.model_dump(exclude_unset=True)

    if "chairperson_id" in data:
        validate_user_tenant(
            db,
            data["chairperson_id"],
            current_user.tenant_id,
            "Chairperson",
        )

    if "secretary_id" in data:
        validate_user_tenant(
            db,
            data["secretary_id"],
            current_user.tenant_id,
            "Secretary",
        )

    if (
        "committee_code" in data
        and data["committee_code"] != committee.committee_code
    ):
        duplicate = db.execute(
            select(GovernanceCommittee.id).where(
                GovernanceCommittee.tenant_id == current_user.tenant_id,
                GovernanceCommittee.committee_code == data["committee_code"],
                GovernanceCommittee.id != committee.id,
            )
        ).scalar_one_or_none()

        if duplicate is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Committee code already exists.",
            )

    history_fields = {
        "committee_code",
        "name",
        "committee_type",
        "description",
        "chairperson_id",
        "secretary_id",
        "status",
        "meeting_cadence",
        "effective_date",
        "review_date",
    }

    for field_name, new_value in data.items():
        if field_name not in history_fields:
            continue

        old_value = getattr(committee, field_name)

        if old_value == new_value:
            continue

        add_history(
            db,
            committee,
            action="FIELD_UPDATED",
            performed_by=current_user.id,
            field_name=field_name,
            old_value=str(old_value) if old_value is not None else None,
            new_value=str(new_value) if new_value is not None else None,
        )

        setattr(committee, field_name, new_value)

    committee.updated_by = current_user.id

    db.commit()
    db.refresh(committee)

    return committee


@router.delete(
    "/{committee_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_committee(
    committee_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("governance_committee.delete")
    ),
):
    committee = get_committee_or_404(
        db,
        committee_id,
        current_user.tenant_id,
    )

    committee.is_deleted = True
    committee.updated_by = current_user.id

    add_history(
        db,
        committee,
        action="DELETED",
        performed_by=current_user.id,
        comment="Committee soft deleted.",
    )

    db.commit()

    return None


@router.get(
    "/{committee_id}/members",
    response_model=list[GovernanceCommitteeMemberRead],
)
def list_members(
    committee_id: int,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("governance_committee.view")
    ),
):
    committee = get_committee_or_404(
        db,
        committee_id,
        current_user.tenant_id,
    )

    conditions = [
        GovernanceCommitteeMember.committee_id == committee.id,
        GovernanceCommitteeMember.tenant_id == current_user.tenant_id,
    ]

    if status_filter:
        conditions.append(
            GovernanceCommitteeMember.status == status_filter
        )

    return db.execute(
        select(GovernanceCommitteeMember)
        .where(and_(*conditions))
        .order_by(
            GovernanceCommitteeMember.status.asc(),
            GovernanceCommitteeMember.member_role.asc(),
            GovernanceCommitteeMember.id.asc(),
        )
    ).scalars().all()


@router.post(
    "/{committee_id}/members",
    response_model=GovernanceCommitteeMemberRead,
    status_code=status.HTTP_201_CREATED,
)
def add_member(
    committee_id: int,
    payload: GovernanceCommitteeMemberCreate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("governance_committee.manage_members")
    ),
):
    committee = get_committee_or_404(
        db,
        committee_id,
        current_user.tenant_id,
    )

    validate_user_tenant(
        db,
        payload.user_id,
        current_user.tenant_id,
        "Member",
    )

    duplicate = db.execute(
        select(GovernanceCommitteeMember.id).where(
            GovernanceCommitteeMember.committee_id == committee.id,
            GovernanceCommitteeMember.user_id == payload.user_id,
        )
    ).scalar_one_or_none()

    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this committee.",
        )

    if (
        payload.start_date is not None
        and payload.end_date is not None
        and payload.end_date < payload.start_date
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Member end date cannot be earlier than start date.",
        )

    member = GovernanceCommitteeMember(
        tenant_id=current_user.tenant_id,
        committee_id=committee.id,
        user_id=payload.user_id,
        member_role=payload.member_role,
        is_voting_member=payload.is_voting_member,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status=payload.status,
    )

    db.add(member)
    db.flush()

    add_history(
        db,
        committee,
        action="MEMBER_ADDED",
        performed_by=current_user.id,
        field_name="member_id",
        new_value=str(member.id),
        comment=f"User {payload.user_id} added as committee member.",
    )

    db.commit()
    db.refresh(member)

    return member


@router.patch(
    "/{committee_id}/members/{member_id}",
    response_model=GovernanceCommitteeMemberRead,
)
def update_member(
    committee_id: int,
    member_id: int,
    payload: GovernanceCommitteeMemberUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("governance_committee.manage_members")
    ),
):
    committee = get_committee_or_404(
        db,
        committee_id,
        current_user.tenant_id,
    )

    member = db.execute(
        select(GovernanceCommitteeMember).where(
            GovernanceCommitteeMember.id == member_id,
            GovernanceCommitteeMember.committee_id == committee.id,
            GovernanceCommitteeMember.tenant_id == current_user.tenant_id,
        )
    ).scalar_one_or_none()

    if member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Committee member not found.",
        )

    data = payload.model_dump(exclude_unset=True)

    effective_start = data.get("start_date", member.start_date)
    effective_end = data.get("end_date", member.end_date)

    if (
        effective_start is not None
        and effective_end is not None
        and effective_end < effective_start
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Member end date cannot be earlier than start date.",
        )

    for field_name, new_value in data.items():
        old_value = getattr(member, field_name)

        if old_value == new_value:
            continue

        add_history(
            db,
            committee,
            action="MEMBER_UPDATED",
            performed_by=current_user.id,
            field_name=field_name,
            old_value=str(old_value) if old_value is not None else None,
            new_value=str(new_value) if new_value is not None else None,
            comment=f"Member {member.id} updated.",
        )

        setattr(member, field_name, new_value)

    db.commit()
    db.refresh(member)

    return member


@router.delete(
    "/{committee_id}/members/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_member(
    committee_id: int,
    member_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("governance_committee.manage_members")
    ),
):
    committee = get_committee_or_404(
        db,
        committee_id,
        current_user.tenant_id,
    )

    member = db.execute(
        select(GovernanceCommitteeMember).where(
            GovernanceCommitteeMember.id == member_id,
            GovernanceCommitteeMember.committee_id == committee.id,
            GovernanceCommitteeMember.tenant_id == current_user.tenant_id,
        )
    ).scalar_one_or_none()

    if member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Committee member not found.",
        )

    add_history(
        db,
        committee,
        action="MEMBER_REMOVED",
        performed_by=current_user.id,
        field_name="member_id",
        old_value=str(member.id),
        comment=f"User {member.user_id} removed from committee.",
    )

    db.delete(member)
    db.commit()

    return None


@router.get(
    "/{committee_id}/meetings",
)
def list_committee_meetings(
    committee_id: int,
    status_filter: Optional[str] = Query(default=None, alias="status"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("governance_committee.view")
    ),
):
    committee = get_committee_or_404(
        db,
        committee_id,
        current_user.tenant_id,
    )

    conditions = [
        GovernanceMeeting.committee_id == committee.id,
        GovernanceMeeting.tenant_id == current_user.tenant_id,
        GovernanceMeeting.is_deleted.is_(False),
    ]

    if status_filter:
        conditions.append(
            GovernanceMeeting.status == status_filter
        )

    meetings = db.execute(
        select(GovernanceMeeting)
        .where(and_(*conditions))
        .order_by(GovernanceMeeting.scheduled_at.desc())
        .offset(skip)
        .limit(limit)
    ).scalars().all()

    return [
        {
            "id": meeting.id,
            "meeting_code": meeting.meeting_code,
            "title": meeting.title,
            "meeting_type": meeting.meeting_type,
            "status": meeting.status,
            "scheduled_at": meeting.scheduled_at,
            "duration_minutes": meeting.duration_minutes,
            "location": meeting.location,
            "chairperson_id": meeting.chairperson_id,
        }
        for meeting in meetings
    ]


@router.get(
    "/{committee_id}/history",
    response_model=list[GovernanceCommitteeHistoryRead],
)
def list_committee_history(
    committee_id: int,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("governance_committee.history")
    ),
):
    committee = get_committee_or_404(
        db,
        committee_id,
        current_user.tenant_id,
    )

    return db.execute(
        select(GovernanceCommitteeHistory)
        .where(
            GovernanceCommitteeHistory.committee_id == committee.id,
            GovernanceCommitteeHistory.tenant_id == current_user.tenant_id,
        )
        .order_by(
            GovernanceCommitteeHistory.created_at.desc(),
            GovernanceCommitteeHistory.id.desc(),
        )
        .offset(skip)
        .limit(limit)
    ).scalars().all()
