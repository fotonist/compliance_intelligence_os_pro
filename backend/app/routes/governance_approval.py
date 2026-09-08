from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.governance_approval import (
    GovernanceApprovalAuthority,
    GovernanceApprovalHistory,
    GovernanceDelegation,
)
from app.models.user import User
from app.schemas.governance_approval import (
    ApprovalAuthorityCreate,
    ApprovalAuthorityListResponse,
    ApprovalAuthorityResponse,
    ApprovalAuthorityUpdate,
    ApprovalHistoryResponse,
    ApprovalSummaryResponse,
    DelegationCreate,
    DelegationListResponse,
    DelegationResponse,
    DelegationUpdate,
)
from app.dependencies.permission_checker import require_permission


router = APIRouter(
    prefix="/governance-approvals",
    tags=["Governance Approvals"],
)


def validate_user_tenant(
    db: Session,
    user_id: Optional[int],
    tenant_id: int,
    label: str,
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


def get_authority_or_404(
    db: Session,
    authority_id: int,
    tenant_id: int,
) -> GovernanceApprovalAuthority:
    authority = db.execute(
        select(GovernanceApprovalAuthority).where(
            GovernanceApprovalAuthority.id == authority_id,
            GovernanceApprovalAuthority.tenant_id == tenant_id,
            GovernanceApprovalAuthority.is_deleted.is_(False),
        )
    ).scalar_one_or_none()

    if authority is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Approval authority not found.",
        )

    return authority


def get_delegation_or_404(
    db: Session,
    delegation_id: int,
    tenant_id: int,
) -> GovernanceDelegation:
    delegation = db.execute(
        select(GovernanceDelegation).where(
            GovernanceDelegation.id == delegation_id,
            GovernanceDelegation.tenant_id == tenant_id,
            GovernanceDelegation.is_deleted.is_(False),
        )
    ).scalar_one_or_none()

    if delegation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Delegation not found.",
        )

    return delegation


def validate_authority_tenant(
    db: Session,
    authority_id: Optional[int],
    tenant_id: int,
) -> Optional[GovernanceApprovalAuthority]:
    if authority_id is None:
        return None

    authority = db.execute(
        select(GovernanceApprovalAuthority).where(
            GovernanceApprovalAuthority.id == authority_id,
            GovernanceApprovalAuthority.tenant_id == tenant_id,
            GovernanceApprovalAuthority.is_deleted.is_(False),
        )
    ).scalar_one_or_none()

    if authority is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Approval authority does not belong to the current tenant.",
        )

    return authority


def add_history(
    db: Session,
    tenant_id: int,
    *,
    authority_id: Optional[int] = None,
    delegation_id: Optional[int] = None,
    action: str,
    performed_by: Optional[int],
    field_name: Optional[str] = None,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
    comment: Optional[str] = None,
) -> GovernanceApprovalHistory:
    history = GovernanceApprovalHistory(
        tenant_id=tenant_id,
        authority_id=authority_id,
        delegation_id=delegation_id,
        action=action,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        comment=comment,
        performed_by=performed_by,
    )

    db.add(history)
    return history


def check_authority_code(
    db: Session,
    tenant_id: int,
    authority_code: str,
    exclude_id: Optional[int] = None,
) -> None:
    query = select(GovernanceApprovalAuthority.id).where(
        GovernanceApprovalAuthority.tenant_id == tenant_id,
        GovernanceApprovalAuthority.authority_code == authority_code,
        GovernanceApprovalAuthority.is_deleted.is_(False),
    )

    if exclude_id is not None:
        query = query.where(
            GovernanceApprovalAuthority.id != exclude_id
        )

    duplicate = db.execute(query).scalar_one_or_none()

    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Authority code already exists.",
        )


def check_delegation_code(
    db: Session,
    tenant_id: int,
    delegation_code: str,
    exclude_id: Optional[int] = None,
) -> None:
    query = select(GovernanceDelegation.id).where(
        GovernanceDelegation.tenant_id == tenant_id,
        GovernanceDelegation.delegation_code == delegation_code,
        GovernanceDelegation.is_deleted.is_(False),
    )

    if exclude_id is not None:
        query = query.where(
            GovernanceDelegation.id != exclude_id
        )

    duplicate = db.execute(query).scalar_one_or_none()

    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Delegation code already exists.",
        )


@router.get(
    "/summary",
    response_model=ApprovalSummaryResponse,
)
def get_approval_summary(
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("governance_approval.view")
    ),
):
    tenant_id = current_user.tenant_id
    today = date.today()
    expiry_date = today + timedelta(days=30)

    active_authorities = db.scalar(
        select(func.count(GovernanceApprovalAuthority.id)).where(
            GovernanceApprovalAuthority.tenant_id == tenant_id,
            GovernanceApprovalAuthority.status == "ACTIVE",
            GovernanceApprovalAuthority.is_deleted.is_(False),
        )
    ) or 0

    active_delegations = db.scalar(
        select(func.count(GovernanceDelegation.id)).where(
            GovernanceDelegation.tenant_id == tenant_id,
            GovernanceDelegation.status == "ACTIVE",
            GovernanceDelegation.is_deleted.is_(False),
            GovernanceDelegation.start_date <= today,
            GovernanceDelegation.end_date >= today,
        )
    ) or 0

    authority_expiring = db.scalar(
        select(func.count(GovernanceApprovalAuthority.id)).where(
            GovernanceApprovalAuthority.tenant_id == tenant_id,
            GovernanceApprovalAuthority.status == "ACTIVE",
            GovernanceApprovalAuthority.is_deleted.is_(False),
            GovernanceApprovalAuthority.review_date.is_not(None),
            GovernanceApprovalAuthority.review_date >= today,
            GovernanceApprovalAuthority.review_date <= expiry_date,
        )
    ) or 0

    delegation_expiring = db.scalar(
        select(func.count(GovernanceDelegation.id)).where(
            GovernanceDelegation.tenant_id == tenant_id,
            GovernanceDelegation.status == "ACTIVE",
            GovernanceDelegation.is_deleted.is_(False),
            GovernanceDelegation.end_date >= today,
            GovernanceDelegation.end_date <= expiry_date,
        )
    ) or 0

    expired_authorities = db.scalar(
        select(func.count(GovernanceApprovalAuthority.id)).where(
            GovernanceApprovalAuthority.tenant_id == tenant_id,
            GovernanceApprovalAuthority.is_deleted.is_(False),
            GovernanceApprovalAuthority.review_date.is_not(None),
            GovernanceApprovalAuthority.review_date < today,
        )
    ) or 0

    expired_delegations = db.scalar(
        select(func.count(GovernanceDelegation.id)).where(
            GovernanceDelegation.tenant_id == tenant_id,
            GovernanceDelegation.is_deleted.is_(False),
            GovernanceDelegation.end_date < today,
        )
    ) or 0

    return ApprovalSummaryResponse(
        active_authorities=active_authorities,
        active_delegations=active_delegations,
        expiring_soon=authority_expiring + delegation_expiring,
        expired=expired_authorities + expired_delegations,
    )


@router.get(
    "/authorities",
    response_model=ApprovalAuthorityListResponse,
)
def list_authorities(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    authority_type: Optional[str] = Query(default=None),
    keyword: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("governance_approval.view")
    ),
):
    conditions = [
        GovernanceApprovalAuthority.tenant_id == current_user.tenant_id,
        GovernanceApprovalAuthority.is_deleted.is_(False),
    ]

    if status_filter:
        conditions.append(
            GovernanceApprovalAuthority.status == status_filter
        )

    if authority_type:
        conditions.append(
            GovernanceApprovalAuthority.authority_type == authority_type
        )

    if keyword:
        pattern = f"%{keyword.strip()}%"
        conditions.append(
            or_(
                GovernanceApprovalAuthority.authority_code.ilike(pattern),
                GovernanceApprovalAuthority.name.ilike(pattern),
                GovernanceApprovalAuthority.scope.ilike(pattern),
            )
        )

    total = db.scalar(
        select(func.count(GovernanceApprovalAuthority.id)).where(
            and_(*conditions)
        )
    ) or 0

    items = db.execute(
        select(GovernanceApprovalAuthority)
        .where(and_(*conditions))
        .order_by(
            GovernanceApprovalAuthority.status.asc(),
            GovernanceApprovalAuthority.name.asc(),
        )
        .offset(skip)
        .limit(limit)
    ).scalars().all()

    return ApprovalAuthorityListResponse(
        items=[
            ApprovalAuthorityResponse.model_validate(item)
            for item in items
        ],
        total=total,
    )


@router.get(
    "/authorities/{authority_id}",
    response_model=ApprovalAuthorityResponse,
)
def get_authority(
    authority_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("governance_approval.view")
    ),
):
    return get_authority_or_404(
        db,
        authority_id,
        current_user.tenant_id,
    )


@router.post(
    "/authorities",
    response_model=ApprovalAuthorityResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_authority(
    payload: ApprovalAuthorityCreate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("governance_approval.create")
    ),
):
    tenant_id = current_user.tenant_id

    validate_user_tenant(
        db,
        payload.approver_id,
        tenant_id,
        "Approver",
    )

    check_authority_code(
        db,
        tenant_id,
        payload.authority_code,
    )

    authority = GovernanceApprovalAuthority(
        tenant_id=tenant_id,
        authority_code=payload.authority_code,
        name=payload.name,
        authority_type=payload.authority_type,
        scope=payload.scope,
        approver_id=payload.approver_id,
        approval_limit=payload.approval_limit,
        currency=payload.currency,
        effective_date=payload.effective_date,
        review_date=payload.review_date,
        status=payload.status,
        created_by=current_user.id,
        updated_by=current_user.id,
    )

    db.add(authority)
    db.flush()

    add_history(
        db,
        tenant_id,
        authority_id=authority.id,
        action="CREATED",
        performed_by=current_user.id,
        comment="Approval authority created.",
    )

    db.commit()
    db.refresh(authority)

    return authority


@router.patch(
    "/authorities/{authority_id}",
    response_model=ApprovalAuthorityResponse,
)
def update_authority(
    authority_id: int,
    payload: ApprovalAuthorityUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("governance_approval.edit")
    ),
):
    authority = get_authority_or_404(
        db,
        authority_id,
        current_user.tenant_id,
    )

    data = payload.model_dump(exclude_unset=True)

    if "approver_id" in data:
        validate_user_tenant(
            db,
            data["approver_id"],
            current_user.tenant_id,
            "Approver",
        )

    if (
        "authority_code" in data
        and data["authority_code"] != authority.authority_code
    ):
        check_authority_code(
            db,
            current_user.tenant_id,
            data["authority_code"],
            authority.id,
        )

    effective_date = data.get(
        "effective_date",
        authority.effective_date,
    )
    review_date = data.get(
        "review_date",
        authority.review_date,
    )

    if (
        effective_date is not None
        and review_date is not None
        and review_date < effective_date
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="review_date cannot be before effective_date.",
        )

    history_fields = {
        "authority_code",
        "name",
        "authority_type",
        "scope",
        "approver_id",
        "approval_limit",
        "currency",
        "effective_date",
        "review_date",
        "status",
    }

    for field_name, new_value in data.items():
        if field_name not in history_fields:
            continue

        old_value = getattr(authority, field_name)

        if old_value == new_value:
            continue

        add_history(
            db,
            current_user.tenant_id,
            authority_id=authority.id,
            action="FIELD_UPDATED",
            performed_by=current_user.id,
            field_name=field_name,
            old_value=str(old_value) if old_value is not None else None,
            new_value=str(new_value) if new_value is not None else None,
        )

        setattr(authority, field_name, new_value)

    authority.updated_by = current_user.id

    db.commit()
    db.refresh(authority)

    return authority


@router.delete(
    "/authorities/{authority_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_authority(
    authority_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("governance_approval.delete")
    ),
):
    authority = get_authority_or_404(
        db,
        authority_id,
        current_user.tenant_id,
    )

    authority.is_deleted = True
    authority.status = "INACTIVE"
    authority.updated_by = current_user.id

    add_history(
        db,
        current_user.tenant_id,
        authority_id=authority.id,
        action="DELETED",
        performed_by=current_user.id,
        comment="Approval authority soft deleted.",
    )

    db.commit()

    return None


@router.get(
    "/authorities/{authority_id}/history",
    response_model=list[ApprovalHistoryResponse],
)
def list_authority_history(
    authority_id: int,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("governance_approval.history")
    ),
):
    authority = get_authority_or_404(
        db,
        authority_id,
        current_user.tenant_id,
    )

    return db.execute(
        select(GovernanceApprovalHistory)
        .where(
            GovernanceApprovalHistory.authority_id == authority.id,
            GovernanceApprovalHistory.tenant_id == current_user.tenant_id,
        )
        .order_by(
            GovernanceApprovalHistory.created_at.desc(),
            GovernanceApprovalHistory.id.desc(),
        )
        .offset(skip)
        .limit(limit)
    ).scalars().all()


@router.get(
    "/delegations",
    response_model=DelegationListResponse,
)
def list_delegations(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    authority_id: Optional[int] = Query(default=None),
    keyword: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("governance_approval.view")
    ),
):
    conditions = [
        GovernanceDelegation.tenant_id == current_user.tenant_id,
        GovernanceDelegation.is_deleted.is_(False),
    ]

    if status_filter:
        conditions.append(
            GovernanceDelegation.status == status_filter
        )

    if authority_id is not None:
        conditions.append(
            GovernanceDelegation.authority_id == authority_id
        )

    if keyword:
        pattern = f"%{keyword.strip()}%"
        conditions.append(
            or_(
                GovernanceDelegation.delegation_code.ilike(pattern),
                GovernanceDelegation.name.ilike(pattern),
                GovernanceDelegation.scope.ilike(pattern),
                GovernanceDelegation.reason.ilike(pattern),
            )
        )

    total = db.scalar(
        select(func.count(GovernanceDelegation.id)).where(
            and_(*conditions)
        )
    ) or 0

    items = db.execute(
        select(GovernanceDelegation)
        .where(and_(*conditions))
        .order_by(
            GovernanceDelegation.status.asc(),
            GovernanceDelegation.end_date.asc(),
            GovernanceDelegation.name.asc(),
        )
        .offset(skip)
        .limit(limit)
    ).scalars().all()

    return DelegationListResponse(
        items=[
            DelegationResponse.model_validate(item)
            for item in items
        ],
        total=total,
    )


@router.get(
    "/delegations/{delegation_id}",
    response_model=DelegationResponse,
)
def get_delegation(
    delegation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("governance_approval.view")
    ),
):
    return get_delegation_or_404(
        db,
        delegation_id,
        current_user.tenant_id,
    )


@router.post(
    "/delegations",
    response_model=DelegationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_delegation(
    payload: DelegationCreate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("governance_approval.create")
    ),
):
    tenant_id = current_user.tenant_id

    validate_user_tenant(
        db,
        payload.delegator_id,
        tenant_id,
        "Delegator",
    )

    validate_user_tenant(
        db,
        payload.delegate_id,
        tenant_id,
        "Delegate",
    )

    validate_authority_tenant(
        db,
        payload.authority_id,
        tenant_id,
    )

    check_delegation_code(
        db,
        tenant_id,
        payload.delegation_code,
    )

    delegation = GovernanceDelegation(
        tenant_id=tenant_id,
        authority_id=payload.authority_id,
        delegation_code=payload.delegation_code,
        name=payload.name,
        delegator_id=payload.delegator_id,
        delegate_id=payload.delegate_id,
        scope=payload.scope,
        authority_limit=payload.authority_limit,
        currency=payload.currency,
        start_date=payload.start_date,
        end_date=payload.end_date,
        reason=payload.reason,
        status=payload.status,
        created_by=current_user.id,
        updated_by=current_user.id,
    )

    db.add(delegation)
    db.flush()

    add_history(
        db,
        tenant_id,
        delegation_id=delegation.id,
        action="CREATED",
        performed_by=current_user.id,
        comment="Delegation created.",
    )

    db.commit()
    db.refresh(delegation)

    return delegation


@router.patch(
    "/delegations/{delegation_id}",
    response_model=DelegationResponse,
)
def update_delegation(
    delegation_id: int,
    payload: DelegationUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("governance_approval.edit")
    ),
):
    delegation = get_delegation_or_404(
        db,
        delegation_id,
        current_user.tenant_id,
    )

    data = payload.model_dump(exclude_unset=True)

    if "delegator_id" in data:
        validate_user_tenant(
            db,
            data["delegator_id"],
            current_user.tenant_id,
            "Delegator",
        )

    if "delegate_id" in data:
        validate_user_tenant(
            db,
            data["delegate_id"],
            current_user.tenant_id,
            "Delegate",
        )

    if "authority_id" in data:
        validate_authority_tenant(
            db,
            data["authority_id"],
            current_user.tenant_id,
        )

    if (
        "delegation_code" in data
        and data["delegation_code"] != delegation.delegation_code
    ):
        check_delegation_code(
            db,
            current_user.tenant_id,
            data["delegation_code"],
            delegation.id,
        )

    effective_start = data.get(
        "start_date",
        delegation.start_date,
    )
    effective_end = data.get(
        "end_date",
        delegation.end_date,
    )

    if effective_end < effective_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="end_date cannot be before start_date.",
        )

    history_fields = {
        "authority_id",
        "delegation_code",
        "name",
        "delegator_id",
        "delegate_id",
        "scope",
        "authority_limit",
        "currency",
        "start_date",
        "end_date",
        "reason",
        "status",
    }

    for field_name, new_value in data.items():
        if field_name not in history_fields:
            continue

        old_value = getattr(delegation, field_name)

        if old_value == new_value:
            continue

        add_history(
            db,
            current_user.tenant_id,
            delegation_id=delegation.id,
            action="FIELD_UPDATED",
            performed_by=current_user.id,
            field_name=field_name,
            old_value=str(old_value) if old_value is not None else None,
            new_value=str(new_value) if new_value is not None else None,
        )

        setattr(delegation, field_name, new_value)

    delegation.updated_by = current_user.id

    db.commit()
    db.refresh(delegation)

    return delegation


@router.delete(
    "/delegations/{delegation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_delegation(
    delegation_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("governance_approval.delete")
    ),
):
    delegation = get_delegation_or_404(
        db,
        delegation_id,
        current_user.tenant_id,
    )

    delegation.is_deleted = True
    delegation.status = "REVOKED"
    delegation.updated_by = current_user.id

    add_history(
        db,
        current_user.tenant_id,
        delegation_id=delegation.id,
        action="REVOKED",
        performed_by=current_user.id,
        comment="Delegation revoked.",
    )

    db.commit()

    return None


@router.get(
    "/delegations/{delegation_id}/history",
    response_model=list[ApprovalHistoryResponse],
)
def list_delegation_history(
    delegation_id: int,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user=Depends(
        require_permission("governance_approval.history")
    ),
):
    delegation = get_delegation_or_404(
        db,
        delegation_id,
        current_user.tenant_id,
    )

    return db.execute(
        select(GovernanceApprovalHistory)
        .where(
            GovernanceApprovalHistory.delegation_id == delegation.id,
            GovernanceApprovalHistory.tenant_id == current_user.tenant_id,
        )
        .order_by(
            GovernanceApprovalHistory.created_at.desc(),
            GovernanceApprovalHistory.id.desc(),
        )
        .offset(skip)
        .limit(limit)
    ).scalars().all()

