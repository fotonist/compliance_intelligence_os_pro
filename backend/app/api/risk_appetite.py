from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.models.risk_appetite_profile import RiskAppetiteProfile
from app.schemas.risk_appetite import (
    RiskAppetiteProfileResponse,
    RiskAppetiteProfileUpdate,
)
from app.core.security import get_current_user

router = APIRouter(
    prefix="/risk-appetite",
    tags=["Risk Appetite"],
)


@router.get(
    "/profile",
    response_model=RiskAppetiteProfileResponse,
)
def get_profile(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    profile = (
        db.query(RiskAppetiteProfile)
        .filter(
            RiskAppetiteProfile.tenant_id == user.tenant_id,
            RiskAppetiteProfile.is_default.is_(True),
        )
        .first()
    )

    if not profile:
        profile = RiskAppetiteProfile(
            tenant_id=user.tenant_id,
            name="Default",
            description="Default Risk Appetite",
            is_default=True,
            default_threshold=16,
        )

        db.add(profile)
        db.commit()
        db.refresh(profile)

    return profile


@router.put(
    "/profile",
    response_model=RiskAppetiteProfileResponse,
)
def update_profile(
    payload: RiskAppetiteProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    profile = (
        db.query(RiskAppetiteProfile)
        .filter(
            RiskAppetiteProfile.tenant_id == user.tenant_id,
            RiskAppetiteProfile.is_default.is_(True),
        )
        .first()
    )

    if not profile:
        profile = RiskAppetiteProfile(
            tenant_id=user.tenant_id,
            is_default=True,
        )
        db.add(profile)

    profile.name = payload.name
    profile.description = payload.description
    profile.default_threshold = payload.default_threshold

    db.commit()
    db.refresh(profile)

    return profile