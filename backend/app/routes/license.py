from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.premium_module_request import PremiumModuleRequest
from app.models.tenant_premium_module import TenantPremiumModule
from app.models.user import User
from app.dependencies.permission_checker import require_permission
from app.dependencies.scope_checker import require_tenant_scope
from app.dependencies.auth import get_current_user

router = APIRouter(
    prefix="/company/license",
    tags=["License"]
)


# ==========================================================
# REQUEST PREMIUM MODULE ACTIVATION
# ==========================================================

@router.post("/request")
def create_license_request(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
    scope=Depends(require_tenant_scope()),
):

    tenant_id = user.tenant_id


    module_code = payload.get("module_code")
    module_name = payload.get("module_name")


    if not module_code or not module_name:
        raise HTTPException(
            status_code=400,
            detail="module_code and module_name are required"
        )


    existing = (
        db.query(PremiumModuleRequest)
        .filter(
            PremiumModuleRequest.tenant_id == tenant_id,
            PremiumModuleRequest.requested_by == user.id,
            PremiumModuleRequest.module_code == module_code,
            PremiumModuleRequest.status == "PENDING",
        )
        .first()
    )


    if existing:
        return {
            "message": "Request already exists",
            "id": existing.id,
            "status": existing.status,
        }


    request = PremiumModuleRequest(
        tenant_id=tenant_id,
        requested_by=user.id,
        module_code=module_code,
        module_name=module_name,
        status="PENDING",
    )


    db.add(request)
    db.commit()
    db.refresh(request)


    return {
        "message": "Activation request submitted",
        "id": request.id,
        "status": request.status,
    }

# ==========================================================
# GET ACTIVE PREMIUM MODULES
# ==========================================================

@router.get("/modules")
def get_active_modules(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    modules = (
        db.query(TenantPremiumModule)
        .filter(
            TenantPremiumModule.tenant_id == user.tenant_id,
            TenantPremiumModule.status == "ACTIVE",
        )
        .all()
    )

    result = {}

    for module in modules:
        result[module.module_code] = True

    return result

# ==========================================================
# LIST REQUESTS
# ==========================================================

@router.get("/requests")
def list_license_requests(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("admin.view")),
):

    requests = (
        db.query(PremiumModuleRequest)
        .order_by(
            PremiumModuleRequest.requested_at.desc()
        )
        .all()
    )


    return requests



# ==========================================================
# APPROVE REQUEST
# ==========================================================

@router.patch("/requests/{request_id}/approve")
def approve_license_request(
    request_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("admin.view")),
):

    request = (
        db.query(PremiumModuleRequest)
        .filter(
            PremiumModuleRequest.id == request_id
        )
        .first()
    )


    if not request:
        raise HTTPException(
            status_code=404,
            detail="Request not found"
        )


    request.status = "APPROVED"
    request.reviewed_by = user.id
    request.reviewed_at = datetime.utcnow()


    existing_module = (
        db.query(TenantPremiumModule)
        .filter(
            TenantPremiumModule.tenant_id == request.tenant_id,
            TenantPremiumModule.module_code == request.module_code,
        )
        .first()
    )


    if not existing_module:

        premium_module = TenantPremiumModule(
            tenant_id=request.tenant_id,
            module_code=request.module_code,
            status="ACTIVE",
            activated_by=user.id,
        )

        db.add(premium_module)


    db.commit()


    return {
        "message": "Request approved",
        "id": request.id,
        "status": request.status,
    }


# ==========================================================
# REJECT REQUEST
# ==========================================================

@router.patch("/requests/{request_id}/reject")
def reject_license_request(
    request_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("admin.view")),
):

    request = (
        db.query(PremiumModuleRequest)
        .filter(
            PremiumModuleRequest.id == request_id
        )
        .first()
    )


    if not request:
        raise HTTPException(
            status_code=404,
            detail="Request not found"
        )


    request.status = "REJECTED"
    request.reviewed_by = user.id
    request.reviewed_at = datetime.utcnow()
    request.review_note = payload.get("review_note")


    db.commit()


    return {
        "message": "Request rejected",
        "id": request.id,
        "status": request.status,
    }
    
# ==========================================================
# GET ACTIVE PREMIUM MODULES
# ==========================================================

@router.get("/modules")
def get_active_modules(
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("risk.intelligence.view")),
):

    modules = (
        db.query(TenantPremiumModule)
        .filter(
            TenantPremiumModule.tenant_id == user.tenant_id,
            TenantPremiumModule.status == "ACTIVE",
        )
        .all()
    )


    return {
        module.module_code: True
        for module in modules
    }