from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user
from app.dependencies.permission_checker import require_permission

from app.models.user import User
from app.models.decision_register import DecisionRegister
from app.models.decision_register_history import DecisionRegisterHistory

from app.schemas.decision_register import (
    DecisionRegisterCreate,
    DecisionRegisterUpdate,
    DecisionRegisterRead,
    DecisionRegisterListItem,
    DecisionRegisterHistoryRead,
    DecisionRegisterReject,
    DecisionRegisterLifecycleRead,
)


router = APIRouter(
    prefix="/decision-registers",
    tags=["Decision Register"],
)


# ==========================================================
# Helpers
# ==========================================================

def get_decision_or_404(
    db: Session,
    decision_id: int,
    user: User,
) -> DecisionRegister:

    decision = db.execute(
        select(DecisionRegister).where(
            DecisionRegister.id == decision_id,
            DecisionRegister.tenant_id == user.tenant_id,
            DecisionRegister.is_deleted == False,
        )
    ).scalar_one_or_none()

    if decision is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Decision register entry not found.",
        )

    return decision


def validate_reference_tenant(
    db: Session,
    model,
    object_id: int,
    tenant_id: int,
    label: str,
):
    obj = db.execute(
        select(model).where(
            model.id == object_id,
            model.tenant_id == tenant_id,
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
    decision: DecisionRegister,
    action: str,
    user_id: int,
    field_name: str | None = None,
    old_value: str | None = None,
    new_value: str | None = None,
    comment: str | None = None,
):
    history = DecisionRegisterHistory(
        decision_register_id=decision.id,
        action=action,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        comment=comment,
        performed_by=user_id,
    )

    db.add(history)


# ==========================================================
# LIST
# ==========================================================

@router.get(
    "",
    response_model=list[DecisionRegisterListItem],
    dependencies=[
        Depends(require_permission("decision_register.view")),
    ],
)
def list_decision_registers(
    status_filter: str | None = Query(
        default=None,
        alias="status",
    ),
    decision_type: str | None = None,
    priority: str | None = None,
    keyword: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(DecisionRegister).where(
        DecisionRegister.tenant_id == user.tenant_id,
        DecisionRegister.is_deleted == False,
    )

    if status_filter:
        query = query.where(
            DecisionRegister.status == status_filter
        )

    if decision_type:
        query = query.where(
            DecisionRegister.decision_type == decision_type
        )

    if priority:
        query = query.where(
            DecisionRegister.priority == priority
        )

    if keyword:
        search = f"%{keyword.strip()}%"

        query = query.where(
            DecisionRegister.title.ilike(search)
            | DecisionRegister.decision_code.ilike(search)
            | DecisionRegister.decision_statement.ilike(search)
        )

    query = query.order_by(
        DecisionRegister.decision_date.desc().nullslast(),
        DecisionRegister.created_at.desc(),
    )

    return db.execute(query).scalars().all()


# ==========================================================
# CREATE
# ==========================================================

@router.post(
    "",
    response_model=DecisionRegisterRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[
        Depends(require_permission("decision_register.create")),
    ],
)
def create_decision_register(
    payload: DecisionRegisterCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    duplicate = db.execute(
        select(DecisionRegister).where(
            DecisionRegister.tenant_id == user.tenant_id,
            DecisionRegister.decision_code == payload.decision_code,
            DecisionRegister.is_deleted == False,
        )
    ).scalar_one_or_none()

    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Decision code already exists.",
        )

    if payload.decision_maker_id:
        validate_reference_tenant(
            db,
            User,
            payload.decision_maker_id,
            user.tenant_id,
            "Decision maker",
        )

    if payload.owner_id:
        validate_reference_tenant(
            db,
            User,
            payload.owner_id,
            user.tenant_id,
            "Owner",
        )

    if payload.approver_id:
        validate_reference_tenant(
            db,
            User,
            payload.approver_id,
            user.tenant_id,
            "Approver",
        )

    if payload.policy_id:
        from app.models.governance_policy import GovernancePolicy

        validate_reference_tenant(
            db,
            GovernancePolicy,
            payload.policy_id,
            user.tenant_id,
            "Policy",
        )

    if payload.procedure_id:
        from app.models.governance_procedure import GovernanceProcedure

        validate_reference_tenant(
            db,
            GovernanceProcedure,
            payload.procedure_id,
            user.tenant_id,
            "Procedure",
        )

    decision = DecisionRegister(
        tenant_id=user.tenant_id,
        decision_code=payload.decision_code.strip(),
        title=payload.title.strip(),
        decision_type=payload.decision_type,
        status="draft",
        priority=payload.priority,
        decision_date=payload.decision_date,
        decision_maker_id=payload.decision_maker_id,
        owner_id=payload.owner_id,
        approver_id=payload.approver_id,
        approval_date=None,
        review_date=payload.review_date,
        context=payload.context,
        rationale=payload.rationale,
        decision_statement=payload.decision_statement,
        expected_outcome=payload.expected_outcome,
        impact_assessment=payload.impact_assessment,
        policy_id=payload.policy_id,
        procedure_id=payload.procedure_id,
        created_by=user.id,
        updated_by=user.id,
    )

    db.add(decision)
    db.flush()

    add_history(
        db=db,
        decision=decision,
        action="created",
        user_id=user.id,
        comment="Decision register entry created.",
    )

    db.commit()
    db.refresh(decision)

    return decision


# ==========================================================
# GET
# ==========================================================

@router.get(
    "/{decision_id}",
    response_model=DecisionRegisterRead,
    dependencies=[
        Depends(require_permission("decision_register.view")),
    ],
)
def get_decision_register(
    decision_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return get_decision_or_404(
        db,
        decision_id,
        user,
    )


# ==========================================================
# UPDATE
# ==========================================================

@router.patch(
    "/{decision_id}",
    response_model=DecisionRegisterRead,
    dependencies=[
        Depends(require_permission("decision_register.edit")),
    ],
)
def update_decision_register(
    decision_id: int,
    payload: DecisionRegisterUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    decision = get_decision_or_404(
        db,
        decision_id,
        user,
    )

    changes = payload.model_dump(
        exclude_unset=True,
    )

    # ------------------------------------------------------
    # Lifecycle fields are controlled by dedicated workflow
    # endpoints and cannot be changed through generic PATCH.
    # ------------------------------------------------------

    protected_fields = {
        "status",
        "approver_id",
        "approval_date",
    }

    attempted_protected_fields = protected_fields.intersection(
        changes.keys()
    )

    if attempted_protected_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Lifecycle fields cannot be changed through the "
                "generic update endpoint: "
                f"{sorted(attempted_protected_fields)}"
            ),
        )

    if "decision_code" in changes:
        changes["decision_code"] = changes["decision_code"].strip()

        duplicate = db.execute(
            select(DecisionRegister).where(
                DecisionRegister.tenant_id == user.tenant_id,
                DecisionRegister.decision_code == changes["decision_code"],
                DecisionRegister.id != decision.id,
                DecisionRegister.is_deleted == False,
            )
        ).scalar_one_or_none()

        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Decision code already exists.",
            )

    reference_checks = {
        "decision_maker_id": (User, "Decision maker"),
        "owner_id": (User, "Owner"),
    }

    from app.models.governance_policy import GovernancePolicy
    from app.models.governance_procedure import GovernanceProcedure

    reference_checks.update({
        "policy_id": (GovernancePolicy, "Policy"),
        "procedure_id": (GovernanceProcedure, "Procedure"),
    })

    for field_name, (model, label) in reference_checks.items():
        if field_name in changes and changes[field_name] is not None:
            validate_reference_tenant(
                db,
                model,
                changes[field_name],
                user.tenant_id,
                label,
            )

    for field_name, new_value in changes.items():
        old_value = getattr(decision, field_name)

        if old_value == new_value:
            continue

        add_history(
            db=db,
            decision=decision,
            action="updated",
            user_id=user.id,
            field_name=field_name,
            old_value=(
                str(old_value)
                if old_value is not None
                else None
            ),
            new_value=(
                str(new_value)
                if new_value is not None
                else None
            ),
        )

        setattr(
            decision,
            field_name,
            new_value.strip()
            if isinstance(new_value, str)
            else new_value,
        )

    decision.updated_by = user.id
    decision.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(decision)

    return decision


# ==========================================================
# DELETE - SOFT DELETE
# ==========================================================

@router.delete(
    "/{decision_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[
        Depends(require_permission("decision_register.delete")),
    ],
)
def delete_decision_register(
    decision_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    decision = get_decision_or_404(
        db,
        decision_id,
        user,
    )

    decision.is_deleted = True
    decision.updated_by = user.id
    decision.updated_at = datetime.utcnow()

    add_history(
        db=db,
        decision=decision,
        action="deleted",
        user_id=user.id,
        comment="Decision register entry soft-deleted.",
    )

    db.commit()

    return None


# ==========================================================
# HISTORY
# ==========================================================

@router.get(
    "/{decision_id}/history",
    response_model=list[DecisionRegisterHistoryRead],
    dependencies=[
        Depends(require_permission("decision_register.history")),
    ],
)
def list_decision_register_history(
    decision_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    decision = get_decision_or_404(
        db,
        decision_id,
        user,
    )

    query = (
        select(DecisionRegisterHistory)
        .where(
            DecisionRegisterHistory.decision_register_id
            == decision.id
        )
        .order_by(
            DecisionRegisterHistory.created_at.desc()
        )
    )

    return db.execute(query).scalars().all()

# ==========================================================
# LIFECYCLE - SUBMIT
# ==========================================================

@router.post(
    "/{decision_id}/submit",
    response_model=DecisionRegisterLifecycleRead,
    dependencies=[
        Depends(require_permission("decision_register.edit")),
    ],
)
def submit_decision_register(
    decision_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    decision = get_decision_or_404(
        db,
        decision_id,
        user,
    )

    if decision.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Only draft decisions can be submitted."
            ),
        )

    old_status = decision.status
    decision.status = "submitted"
    decision.updated_by = user.id
    decision.updated_at = datetime.utcnow()

    add_history(
        db=db,
        decision=decision,
        action="submitted",
        user_id=user.id,
        field_name="status",
        old_value=old_status,
        new_value="submitted",
        comment="Decision submitted for approval.",
    )

    db.commit()
    db.refresh(decision)

    return decision


# ==========================================================
# LIFECYCLE - APPROVE
# ==========================================================

@router.post(
    "/{decision_id}/approve",
    response_model=DecisionRegisterLifecycleRead,
    dependencies=[
        Depends(require_permission("decision_register.approve")),
    ],
)
def approve_decision_register(
    decision_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    decision = get_decision_or_404(
        db,
        decision_id,
        user,
    )

    if decision.status != "submitted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Only submitted decisions can be approved."
            ),
        )

    old_status = decision.status

    decision.status = "approved"
    decision.approver_id = user.id
    decision.approval_date = datetime.utcnow()
    decision.updated_by = user.id
    decision.updated_at = datetime.utcnow()

    add_history(
        db=db,
        decision=decision,
        action="approved",
        user_id=user.id,
        field_name="status",
        old_value=old_status,
        new_value="approved",
        comment="Decision approved.",
    )

    add_history(
        db=db,
        decision=decision,
        action="approved",
        user_id=user.id,
        field_name="approver_id",
        old_value=None,
        new_value=str(user.id),
    )

    add_history(
        db=db,
        decision=decision,
        action="approved",
        user_id=user.id,
        field_name="approval_date",
        old_value=None,
        new_value=decision.approval_date.isoformat(),
    )

    db.commit()
    db.refresh(decision)

    return decision


# ==========================================================
# LIFECYCLE - REJECT
# ==========================================================

@router.post(
    "/{decision_id}/reject",
    response_model=DecisionRegisterLifecycleRead,
    dependencies=[
        Depends(require_permission("decision_register.approve")),
    ],
)
def reject_decision_register(
    decision_id: int,
    payload: DecisionRegisterReject,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    decision = get_decision_or_404(
        db,
        decision_id,
        user,
    )

    if decision.status != "submitted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Only submitted decisions can be rejected."
            ),
        )

    old_status = decision.status
    decision.status = "rejected"
    decision.updated_by = user.id
    decision.updated_at = datetime.utcnow()

    add_history(
        db=db,
        decision=decision,
        action="rejected",
        user_id=user.id,
        field_name="status",
        old_value=old_status,
        new_value="rejected",
        comment=payload.comment.strip(),
    )

    db.commit()
    db.refresh(decision)

    return decision


# ==========================================================
# LIFECYCLE - CLOSE
# ==========================================================

@router.post(
    "/{decision_id}/close",
    response_model=DecisionRegisterLifecycleRead,
    dependencies=[
        Depends(require_permission("decision_register.edit")),
    ],
)
def close_decision_register(
    decision_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    decision = get_decision_or_404(
        db,
        decision_id,
        user,
    )

    if decision.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Only approved decisions can be closed."
            ),
        )

    old_status = decision.status
    decision.status = "closed"
    decision.updated_by = user.id
    decision.updated_at = datetime.utcnow()

    add_history(
        db=db,
        decision=decision,
        action="closed",
        user_id=user.id,
        field_name="status",
        old_value=old_status,
        new_value="closed",
        comment="Decision closed.",
    )

    db.commit()
    db.refresh(decision)

    return decision
