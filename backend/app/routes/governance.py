from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.core.security import get_current_user

from app.models.user import User
from app.models.governance_policy import GovernancePolicy
from app.models.governance_procedure import GovernanceProcedure
from app.models.governance_procedure_control import GovernanceProcedureControl
from app.models.controls import Control

from app.schemas.governance_procedure_schema import GovernanceProcedureCreate, GovernanceProcedureUpdate

from app.schemas.governance_policy_schema import (
    GovernancePolicyCreate,
    GovernancePolicyUpdate,
)


router = APIRouter(
    prefix="/governance",
    tags=["Governance"],
)


# ==========================================================
# LIST POLICIES
# ==========================================================

@router.get("/policies")
def list_policies(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = (
        select(GovernancePolicy)
        .where(
            GovernancePolicy.tenant_id == user.tenant_id,
            GovernancePolicy.is_deleted == False,
        )
        .order_by(
            GovernancePolicy.created_at.desc()
        )
    )

    policies = db.execute(stmt).scalars().all()

    return [
        {
            "id": p.id,
            "policy_code": p.policy_code,
            "title": p.title,
            "category": p.category,
            "status": p.status,
            "version": p.version,
            "owner_id": p.owner_id,
            "review_date": p.review_date,
        }
        for p in policies
    ]


# ==========================================================
# GET POLICY
# ==========================================================

@router.get("/policies/{policy_id}")
def get_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = select(GovernancePolicy).where(
        GovernancePolicy.id == policy_id,
        GovernancePolicy.tenant_id == user.tenant_id,
        GovernancePolicy.is_deleted == False,
    )

    policy = db.execute(stmt).scalar_one_or_none()

    if not policy:
        raise HTTPException(
            status_code=404,
            detail="Policy not found",
        )

    return policy


# ==========================================================
# CREATE POLICY
# ==========================================================

@router.post("/policies")
def create_policy(
    payload: GovernancePolicyCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    policy = GovernancePolicy(
        tenant_id=user.tenant_id,
        **payload.model_dump(),
    )

    db.add(policy)
    db.commit()
    db.refresh(policy)

    return policy


# ==========================================================
# UPDATE POLICY
# ==========================================================

@router.put("/policies/{policy_id}")
def update_policy(
    policy_id: int,
    payload: GovernancePolicyUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = select(GovernancePolicy).where(
        GovernancePolicy.id == policy_id,
        GovernancePolicy.tenant_id == user.tenant_id,
    )

    policy = db.execute(stmt).scalar_one_or_none()

    if not policy:
        raise HTTPException(
            status_code=404,
            detail="Policy not found",
        )

    for key, value in payload.model_dump(
        exclude_unset=True
    ).items():

        setattr(
            policy,
            key,
            value,
        )

    db.commit()
    db.refresh(policy)

    return policy


# ==========================================================
# SUBMIT FOR REVIEW
# ==========================================================

@router.post("/policies/{policy_id}/submit")
def submit_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    policy = db.execute(
        select(GovernancePolicy).where(
            GovernancePolicy.id == policy_id,
            GovernancePolicy.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()

    if not policy:
        raise HTTPException(
            status_code=404,
            detail="Policy not found",
        )

    policy.status = "under_review"

    db.commit()

    return {
        "status": policy.status
    }


# ==========================================================
# APPROVE POLICY
# ==========================================================

@router.post("/policies/{policy_id}/approve")
def approve_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    policy = db.execute(
        select(GovernancePolicy).where(
            GovernancePolicy.id == policy_id,
            GovernancePolicy.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()

    if not policy:
        raise HTTPException(
            status_code=404,
            detail="Policy not found",
        )

    policy.status = "approved"

    db.commit()

    return {
        "status": policy.status
    }


# ==========================================================
# ARCHIVE POLICY
# ==========================================================

@router.post("/policies/{policy_id}/archive")
def archive_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    policy = db.execute(
        select(GovernancePolicy).where(
            GovernancePolicy.id == policy_id,
            GovernancePolicy.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()

    if not policy:
        raise HTTPException(
            status_code=404,
            detail="Policy not found",
        )

    policy.status = "archived"
    policy.is_deleted = True

    db.commit()

    return {
        "status": policy.status
    }

# ==========================================================
# GOVERNANCE PROCEDURES
# ==========================================================

@router.get("/procedures")
def list_procedures(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = (
        select(GovernanceProcedure)
        .where(
            GovernanceProcedure.tenant_id == user.tenant_id,
            GovernanceProcedure.is_deleted == False,
        )
        .order_by(
            GovernanceProcedure.created_at.desc()
        )
    )

    procedures = db.execute(stmt).scalars().all()

    return [
        {
            "id": p.id,
            "policy_id": p.policy_id,
            "procedure_code": p.procedure_code,
            "title": p.title,
            "status": p.status,
            "version": p.version,
            "owner_id": p.owner_id,
            "review_date": p.review_date,
        }
        for p in procedures
    ]


# ==========================================================
# CREATE PROCEDURE
# ==========================================================

@router.post("/procedures")
def create_procedure(
    payload: GovernanceProcedureCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    procedure = GovernanceProcedure(
        tenant_id=user.tenant_id,
        **payload.model_dump(),
    )

    db.add(procedure)
    db.commit()
    db.refresh(procedure)

    return procedure


# ==========================================================
# GET PROCEDURE
# ==========================================================

@router.get("/procedures/{procedure_id}")
def get_procedure(
    procedure_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    procedure = db.execute(
        select(GovernanceProcedure).where(
            GovernanceProcedure.id == procedure_id,
            GovernanceProcedure.tenant_id == user.tenant_id,
            GovernanceProcedure.is_deleted == False,
        )
    ).scalar_one_or_none()

    if not procedure:
        raise HTTPException(
            status_code=404,
            detail="Procedure not found",
        )

    return procedure


# ==========================================================
# UPDATE PROCEDURE
# ==========================================================

@router.put("/procedures/{procedure_id}")
def update_procedure(
    procedure_id: int,
    payload: GovernanceProcedureUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    procedure = db.execute(
        select(GovernanceProcedure).where(
            GovernanceProcedure.id == procedure_id,
            GovernanceProcedure.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()

    if not procedure:
        raise HTTPException(
            status_code=404,
            detail="Procedure not found",
        )

    for key, value in payload.model_dump(
        exclude_unset=True
    ).items():
        setattr(
            procedure,
            key,
            value,
        )

    db.commit()
    db.refresh(procedure)

    return procedure


# ==========================================================
# SUBMIT PROCEDURE
# ==========================================================

@router.post("/procedures/{procedure_id}/submit")
def submit_procedure(
    procedure_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    procedure = db.execute(
        select(GovernanceProcedure).where(
            GovernanceProcedure.id == procedure_id,
            GovernanceProcedure.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()

    if not procedure:
        raise HTTPException(
            status_code=404,
            detail="Procedure not found",
        )

    procedure.status = "under_review"

    db.commit()

    return {
        "status": procedure.status
    }


# ==========================================================
# APPROVE PROCEDURE
# ==========================================================

@router.post("/procedures/{procedure_id}/approve")
def approve_procedure(
    procedure_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    procedure = db.execute(
        select(GovernanceProcedure).where(
            GovernanceProcedure.id == procedure_id,
            GovernanceProcedure.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()

    if not procedure:
        raise HTTPException(
            status_code=404,
            detail="Procedure not found",
        )

    procedure.status = "approved"

    db.commit()

    return {
        "status": procedure.status
    }


# ==========================================================
# ARCHIVE PROCEDURE
# ==========================================================

@router.post("/procedures/{procedure_id}/archive")
def archive_procedure(
    procedure_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    procedure = db.execute(
        select(GovernanceProcedure).where(
            GovernanceProcedure.id == procedure_id,
            GovernanceProcedure.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()

    if not procedure:
        raise HTTPException(
            status_code=404,
            detail="Procedure not found",
        )

    procedure.status = "archived"
    procedure.is_deleted = True

    db.commit()

    return {
        "status": procedure.status
    }


# ==========================================================
# LIST POLICY PROCEDURES
# ==========================================================

@router.get("/policies/{policy_id}/procedures")
def list_policy_procedures(
    policy_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    policy = db.execute(
        select(GovernancePolicy).where(
            GovernancePolicy.id == policy_id,
            GovernancePolicy.tenant_id == user.tenant_id,
            GovernancePolicy.is_deleted == False,
        )
    ).scalar_one_or_none()


    if not policy:
        raise HTTPException(
            status_code=404,
            detail="Policy not found",
        )


    procedures = db.execute(
        select(GovernanceProcedure).where(
            GovernanceProcedure.policy_id == policy_id,
            GovernanceProcedure.tenant_id == user.tenant_id,
            GovernanceProcedure.is_deleted == False,
        )
        .order_by(
            GovernanceProcedure.created_at.desc()
        )
    ).scalars().all()


    return [
        {
            "id": p.id,
            "procedure_code": p.procedure_code,
            "title": p.title,
            "status": p.status,
            "version": p.version,
            "owner_id": p.owner_id,
            "review_date": p.review_date,
        }
        for p in procedures
    ]


# ==========================================================
# LIST PROCEDURE CONTROLS
# ==========================================================

@router.get("/procedures/{procedure_id}/controls")
def list_procedure_controls(
    procedure_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    procedure = db.execute(
        select(GovernanceProcedure).where(
            GovernanceProcedure.id == procedure_id,
            GovernanceProcedure.tenant_id == user.tenant_id,
            GovernanceProcedure.is_deleted == False,
        )
    ).scalar_one_or_none()

    if not procedure:
        raise HTTPException(
            status_code=404,
            detail="Procedure not found",
        )


    links = db.execute(
        select(
            GovernanceProcedureControl,
            Control,
        )
        .join(
            Control,
            Control.id == GovernanceProcedureControl.control_id,
        )
        .where(
            GovernanceProcedureControl.procedure_id == procedure_id,
            GovernanceProcedureControl.tenant_id == user.tenant_id,
        )
    ).all()


    return [
        {
            "id": link.id,
            "control_id": control.id,
            "control_code": control.code,
            "control_title": control.title,
        }
        for link, control in links
    ]


# ==========================================================
# LINK CONTROL TO PROCEDURE
# ==========================================================

@router.post("/procedures/{procedure_id}/controls/{control_id}")
def link_procedure_control(
    procedure_id: int,
    control_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    procedure = db.execute(
        select(GovernanceProcedure).where(
            GovernanceProcedure.id == procedure_id,
            GovernanceProcedure.tenant_id == user.tenant_id,
            GovernanceProcedure.is_deleted == False,
        )
    ).scalar_one_or_none()

    if not procedure:
        raise HTTPException(
            status_code=404,
            detail="Procedure not found",
        )


    control = db.execute(
        select(Control).where(
            Control.id == control_id,
        )
    ).scalar_one_or_none()

    if not control:
        raise HTTPException(
            status_code=404,
            detail="Control not found",
        )


    existing = db.execute(
        select(GovernanceProcedureControl).where(
            GovernanceProcedureControl.procedure_id == procedure_id,
            GovernanceProcedureControl.control_id == control_id,
            GovernanceProcedureControl.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()


    if existing:
        raise HTTPException(
            status_code=400,
            detail="Control already linked",
        )


    link = GovernanceProcedureControl(
        tenant_id=user.tenant_id,
        procedure_id=procedure_id,
        control_id=control_id,
    )


    db.add(link)
    db.commit()
    db.refresh(link)


    return {
        "id": link.id,
        "procedure_id": procedure_id,
        "control_id": control_id,
    }


# ==========================================================
# UNLINK CONTROL FROM PROCEDURE
# ==========================================================

@router.delete("/procedures/{procedure_id}/controls/{control_id}")
def unlink_procedure_control(
    procedure_id: int,
    control_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    link = db.execute(
        select(GovernanceProcedureControl).where(
            GovernanceProcedureControl.procedure_id == procedure_id,
            GovernanceProcedureControl.control_id == control_id,
            GovernanceProcedureControl.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()


    if not link:
        raise HTTPException(
            status_code=404,
            detail="Control link not found",
        )


    db.delete(link)
    db.commit()


    return {
        "status": "removed"
    }


