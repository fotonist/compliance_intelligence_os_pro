from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.company_profile import CompanyProfile
from app.models.process import Process
from app.models.user import User
from app.models.process_risk_link import ProcessRiskLink
from app.models.risks import Risk

router = APIRouter(prefix="/company", tags=["Company"])


# ===================================================
# COMPANY PROFILE
# ===================================================

@router.get("/profile")
def get_company_profile(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(CompanyProfile).where(
        CompanyProfile.tenant_id == user.tenant_id
    )

    profile = db.execute(stmt).scalar_one_or_none()

    if not profile:
        return {}

    return {
        "id": profile.id,
        "legal_name": profile.legal_name,
        "trade_name": profile.trade_name,
        "tax_id": profile.tax_id,
        "registration_no": profile.registration_no,
        "industry": profile.industry,
        "employee_count": profile.employee_count,
        "headquarters_address": profile.headquarters_address,
        "website": profile.website,
        "internal_issues": profile.internal_issues,
        "external_issues": profile.external_issues,
        "strategic_objectives": profile.strategic_objectives,
        "scope_description": profile.scope_description,
        "excluded_activities": profile.excluded_activities,
        "status": profile.status,
    }


@router.put("/profile")
def upsert_company_profile(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(CompanyProfile).where(
        CompanyProfile.tenant_id == user.tenant_id
    )

    profile = db.execute(stmt).scalar_one_or_none()

    if not profile:
        profile = CompanyProfile(
            tenant_id=user.tenant_id,
            legal_name=payload.get("legal_name") or "Unnamed Company",
        )
        db.add(profile)

    for field in [
        "legal_name",
        "trade_name",
        "tax_id",
        "registration_no",
        "industry",
        "employee_count",
        "headquarters_address",
        "website",
        "internal_issues",
        "external_issues",
        "strategic_objectives",
        "scope_description",
        "excluded_activities",
    ]:
        if field in payload:
            setattr(profile, field, payload.get(field))

    db.commit()
    db.refresh(profile)

    return {"success": True}


@router.post("/profile/publish")
def publish_company_profile(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(CompanyProfile).where(
        CompanyProfile.tenant_id == user.tenant_id
    )

    profile = db.execute(stmt).scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    profile.status = "published"
    db.commit()

    return {"status": "published"}


# ===================================================
# PROCESSES
# ===================================================

@router.get("/processes")
def list_processes(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Process).where(
        Process.tenant_id == user.tenant_id
    ).order_by(Process.code)

    rows = db.execute(stmt).scalars().all()

    return [
        {
            "id": p.id,
            "code": p.code,
            "name": p.name,
            "type": p.type,
            "owner": p.owner,
            "status": p.status,
        }
        for p in rows
    ]


@router.post("/processes")
def create_process(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not payload.get("code") or not payload.get("name"):
        raise HTTPException(status_code=400, detail="Code and name are required")

    process = Process(
        tenant_id=user.tenant_id,
        code=payload.get("code"),
        name=payload.get("name"),
        type=payload.get("type") or "core",
        owner=payload.get("owner"),
        status=payload.get("status") or "draft",
    )

    db.add(process)
    db.commit()
    db.refresh(process)

    return {
        "id": process.id,
        "code": process.code,
        "name": process.name,
        "type": process.type,
        "owner": process.owner,
        "status": process.status,
    }


@router.delete("/processes/{process_id}")
def delete_process(
    process_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Process).where(
        Process.id == process_id,
        Process.tenant_id == user.tenant_id,
    )

    process = db.execute(stmt).scalar_one_or_none()

    if not process:
        raise HTTPException(status_code=404, detail="Process not found")

    db.delete(process)
    db.commit()

    return {"success": True}
@router.get("/processes/{process_id}")
def get_process_detail(
    process_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Process).where(
        Process.id == process_id,
        Process.tenant_id == user.tenant_id,
    )

    process = db.execute(stmt).scalar_one_or_none()

    if not process:
        raise HTTPException(status_code=404, detail="Process not found")

    return {
        "id": process.id,
        "code": process.code,
        "name": process.name,
        "type": process.type,
        "owner": process.owner,
        "status": process.status,
        "created_at": process.created_at,
        "updated_at": process.updated_at,
    }
# ----------------------------------------------------------
# LIST LINKED RISKS
# ----------------------------------------------------------
@router.get("/processes/{process_id}/risks")
def list_process_risks(
    process_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = (
        select(Risk)
        .join(ProcessRiskLink, ProcessRiskLink.risk_id == Risk.id)
        .where(
            ProcessRiskLink.process_id == process_id,
            ProcessRiskLink.tenant_id == user.tenant_id,
        )
    )

    risks = db.execute(stmt).scalars().all()

    return [
        {
            "id": r.id,
            "title": r.title,
            "status": r.status,
            "inherent_score": getattr(r, "inherent_score", None),
            "residual_score": getattr(r, "residual_score", None),
        }
        for r in risks
    ]

# ----------------------------------------------------------
# UNLINK RISKS
# ----------------------------------------------------------

@router.delete("/processes/{process_id}/risks/{risk_id}")
def unlink_risk_from_process(
    process_id: int,
    risk_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    link = db.execute(
        select(ProcessRiskLink).where(
            ProcessRiskLink.process_id == process_id,
            ProcessRiskLink.risk_id == risk_id,
            ProcessRiskLink.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()

    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    db.delete(link)
    db.commit()

    return {"unlinked": True}
