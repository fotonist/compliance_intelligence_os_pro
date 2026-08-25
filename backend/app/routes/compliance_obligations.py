from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.permission_checker import require_permission
from app.dependencies.scope_checker import require_tenant_scope

from app.models.compliance_obligation import ComplianceObligation
from app.models.user import User

from app.schemas.compliance_obligation import (
    ComplianceObligation as ComplianceObligationRead,
    ComplianceObligationCreate,
    ComplianceObligationReview,
    ComplianceObligationUpdate,
)


router = APIRouter(
    prefix="/compliance-obligations",
    tags=["Compliance - Obligations"],
)


# ==========================================================
# Constants
# ==========================================================

VALID_STATUSES = {
    "active",
    "inactive",
    "expired",
    "under_review",
}

VALID_CRITICALITIES = {
    "low",
    "medium",
    "high",
    "critical",
}

VALID_APPLICABILITY_STATUSES = {
    "under_review",
    "applicable",
    "not_applicable",
    "partially_applicable",
}


# ==========================================================
# Helpers
# ==========================================================

def get_obligation_or_404(
    db: Session,
    obligation_id: int,
    tenant_id: int,
) -> ComplianceObligation:

    obligation = (
        db.query(ComplianceObligation)
        .filter(
            ComplianceObligation.id == obligation_id,
            ComplianceObligation.tenant_id == tenant_id,
        )
        .first()
    )

    if obligation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Compliance obligation not found.",
        )

    return obligation


def validate_status(value: str | None) -> None:

    if value is None:
        return

    normalized = value.strip().lower()

    if normalized not in VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Invalid obligation status.",
                "allowed_values": sorted(VALID_STATUSES),
            },
        )


def validate_criticality(value: str | None) -> None:

    if value is None:
        return

    normalized = value.strip().lower()

    if normalized not in VALID_CRITICALITIES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Invalid criticality.",
                "allowed_values": sorted(VALID_CRITICALITIES),
            },
        )


def validate_applicability_status(value: str | None) -> None:

    if value is None:
        return

    normalized = value.strip().lower()

    if normalized not in VALID_APPLICABILITY_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": "Invalid applicability status.",
                "allowed_values": sorted(
                    VALID_APPLICABILITY_STATUSES
                ),
            },
        )


def validate_dates(
    effective_date: date | None,
    expiry_date: date | None,
) -> None:

    if (
        effective_date is not None
        and expiry_date is not None
        and expiry_date < effective_date
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Expiry date cannot be earlier than effective date.",
        )


def validate_code_uniqueness(
    db: Session,
    tenant_id: int,
    code: str,
    exclude_id: int | None = None,
) -> None:

    normalized_code = code.strip()

    query = (
        db.query(ComplianceObligation)
        .filter(
            ComplianceObligation.tenant_id == tenant_id,
            ComplianceObligation.code.ilike(normalized_code),
        )
    )

    if exclude_id is not None:
        query = query.filter(
            ComplianceObligation.id != exclude_id
        )

    if query.first() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Compliance obligation code already exists.",
        )


# ==========================================================
# GET /compliance-obligations
# ==========================================================

@router.get(
    "/",
    response_model=list[ComplianceObligationRead],
)
def list_compliance_obligations(
    keyword: str | None = Query(
        default=None,
        min_length=1,
        max_length=255,
    ),
    status_filter: str | None = Query(
        default=None,
        alias="status",
    ),
    criticality: str | None = Query(
        default=None,
    ),
    applicability_status: str | None = Query(
        default=None,
    ),
    owner_user_id: int | None = Query(
        default=None,
        ge=1,
    ),
    review_due: bool | None = Query(
        default=None,
    ),
    page: int = Query(
        default=1,
        ge=1,
    ),
    page_size: int = Query(
        default=50,
        ge=1,
        le=200,
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("obligation.view")
    ),
    tenant_scope=Depends(
        require_tenant_scope()
    ),
):

    tenant_id = current_user.tenant_id

    validate_status(status_filter)
    validate_criticality(criticality)
    validate_applicability_status(
        applicability_status
    )

    query = (
        db.query(ComplianceObligation)
        .filter(
            ComplianceObligation.tenant_id == tenant_id
        )
    )

    if keyword:
        search = keyword.strip()

        query = query.filter(
            or_(
                ComplianceObligation.code.ilike(
                    f"%{search}%"
                ),
                ComplianceObligation.title.ilike(
                    f"%{search}%"
                ),
                ComplianceObligation.description.ilike(
                    f"%{search}%"
                ),
                ComplianceObligation.regulation_name.ilike(
                    f"%{search}%"
                ),
                ComplianceObligation.source_authority.ilike(
                    f"%{search}%"
                ),
                ComplianceObligation.jurisdiction.ilike(
                    f"%{search}%"
                ),
            )
        )

    if status_filter:
        query = query.filter(
            ComplianceObligation.status
            == status_filter.strip().lower()
        )

    if criticality:
        query = query.filter(
            ComplianceObligation.criticality
            == criticality.strip().lower()
        )

    if applicability_status:
        query = query.filter(
            ComplianceObligation.applicability_status
            == applicability_status.strip().lower()
        )

    if owner_user_id is not None:
        query = query.filter(
            ComplianceObligation.owner_user_id
            == owner_user_id
        )

    if review_due is True:
        query = query.filter(
            ComplianceObligation.review_date.is_not(None),
            ComplianceObligation.review_date <= date.today(),
        )

    return (
        query
        .order_by(
            ComplianceObligation.criticality.desc(),
            ComplianceObligation.review_date.asc().nulls_last(),
            ComplianceObligation.code.asc(),
            ComplianceObligation.id.asc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )


# ==========================================================
# GET /compliance-obligations/{obligation_id}
# ==========================================================

@router.get(
    "/{obligation_id}",
    response_model=ComplianceObligationRead,
)
def get_compliance_obligation(
    obligation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("obligation.view")
    ),
    tenant_scope=Depends(
        require_tenant_scope()
    ),
):

    return get_obligation_or_404(
        db,
        obligation_id,
        current_user.tenant_id,
    )


# ==========================================================
# POST /compliance-obligations
# ==========================================================

@router.post(
    "/",
    response_model=ComplianceObligationRead,
    status_code=status.HTTP_201_CREATED,
)
def create_compliance_obligation(
    payload: ComplianceObligationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("obligation.edit")
    ),
    tenant_scope=Depends(
        require_tenant_scope()
    ),
):

    validate_status(payload.status)
    validate_criticality(payload.criticality)
    validate_applicability_status(
        payload.applicability_status
    )

    validate_dates(
        payload.effective_date,
        payload.expiry_date,
    )

    validate_code_uniqueness(
        db,
        current_user.tenant_id,
        payload.code,
    )

    obligation = ComplianceObligation(
        tenant_id=current_user.tenant_id,
        code=payload.code.strip(),
        title=payload.title.strip(),
        description=payload.description,
        source_authority=payload.source_authority,
        regulation_name=payload.regulation_name,
        jurisdiction=payload.jurisdiction,
        reference_url=payload.reference_url,
        effective_date=payload.effective_date,
        expiry_date=payload.expiry_date,
        review_date=payload.review_date,
        status=payload.status.strip().lower(),
        criticality=payload.criticality.strip().lower(),
        owner_user_id=payload.owner_user_id,
        applicability_status=(
            payload.applicability_status
            .strip()
            .lower()
        ),
        applicability_reason=payload.applicability_reason,
    )

    db.add(obligation)

    try:
        db.commit()
        db.refresh(obligation)

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unable to create compliance obligation.",
        )

    return obligation


# ==========================================================
# PUT /compliance-obligations/{obligation_id}
# ==========================================================

@router.put(
    "/{obligation_id}",
    response_model=ComplianceObligationRead,
)
def update_compliance_obligation(
    obligation_id: int,
    payload: ComplianceObligationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("obligation.edit")
    ),
    tenant_scope=Depends(
        require_tenant_scope()
    ),
):

    obligation = get_obligation_or_404(
        db,
        obligation_id,
        current_user.tenant_id,
    )

    data = payload.model_dump(
        exclude_unset=True
    )

    if "code" in data and data["code"] is not None:

        validate_code_uniqueness(
            db,
            current_user.tenant_id,
            data["code"],
            exclude_id=obligation.id,
        )

        data["code"] = data["code"].strip()

    if "title" in data and data["title"] is not None:
        data["title"] = data["title"].strip()

    if "status" in data and data["status"] is not None:
        validate_status(data["status"])
        data["status"] = data["status"].strip().lower()

    if (
        "criticality" in data
        and data["criticality"] is not None
    ):
        validate_criticality(data["criticality"])
        data["criticality"] = (
            data["criticality"]
            .strip()
            .lower()
        )

    if (
        "applicability_status" in data
        and data["applicability_status"] is not None
    ):
        validate_applicability_status(
            data["applicability_status"]
        )
        data["applicability_status"] = (
            data["applicability_status"]
            .strip()
            .lower()
        )

    effective_date = data.get(
        "effective_date",
        obligation.effective_date,
    )

    expiry_date = data.get(
        "expiry_date",
        obligation.expiry_date,
    )

    validate_dates(
        effective_date,
        expiry_date,
    )

    for key, value in data.items():
        setattr(
            obligation,
            key,
            value,
        )

    db.commit()
    db.refresh(obligation)

    return obligation


# ==========================================================
# DELETE /compliance-obligations/{obligation_id}
# Enterprise lifecycle:
# Soft deactivation instead of hard delete.
# ==========================================================

@router.delete(
    "/{obligation_id}",
)
def deactivate_compliance_obligation(
    obligation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("obligation.delete")
    ),
    tenant_scope=Depends(
        require_tenant_scope()
    ),
):

    obligation = get_obligation_or_404(
        db,
        obligation_id,
        current_user.tenant_id,
    )

    obligation.status = "inactive"

    db.commit()
    db.refresh(obligation)

    return {
        "detail": "Compliance obligation deactivated successfully.",
        "obligation_id": obligation.id,
        "status": obligation.status,
    }


# ==========================================================
# POST /compliance-obligations/{obligation_id}/review
# ==========================================================

@router.post(
    "/{obligation_id}/review",
    response_model=ComplianceObligationRead,
)
def review_compliance_obligation(
    obligation_id: int,
    payload: ComplianceObligationReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_permission("obligation.review")
    ),
    tenant_scope=Depends(
        require_tenant_scope()
    ),
):

    obligation = get_obligation_or_404(
        db,
        obligation_id,
        current_user.tenant_id,
    )

    validate_applicability_status(
        payload.applicability_status
    )

    obligation.applicability_status = (
        payload.applicability_status
        .strip()
        .lower()
    )

    obligation.applicability_reason = (
        payload.applicability_reason
    )

    obligation.review_date = (
        payload.review_date
        or date.today()
    )

    db.commit()
    db.refresh(obligation)

    return obligation
