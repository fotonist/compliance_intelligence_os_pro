from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.models.risk_appetite_profile import RiskAppetiteProfile
from app.models.process_risk_appetite import ProcessRiskAppetite
from app.models.process import Process
from app.schemas.risk_appetite import (
    RiskAppetiteProfileResponse,
    RiskAppetiteProfileUpdate,
    ProcessRiskAppetiteResponse,
    ProcessRiskAppetiteUpdate,
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

@router.get(
    "/processes",
    response_model=list[ProcessRiskAppetiteResponse],
)
def list_process_appetite(
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

    processes = (
        db.query(Process)
        .filter(Process.tenant_id == user.tenant_id)
        .order_by(Process.name.asc())
        .all()
    )

    overrides = (
        db.query(ProcessRiskAppetite)
        .filter(
            ProcessRiskAppetite.tenant_id == user.tenant_id,
            ProcessRiskAppetite.profile_id == profile.id,
        )
        .all()
    )

    override_map = {
        item.process_id: item
        for item in overrides
    }

    return [
        ProcessRiskAppetiteResponse(
            process_id=process.id,
            process_name=process.name,
            threshold=(
                override_map[
                    process.id
                ].threshold_override
                if (
                    process.id in override_map
                    and override_map[
                        process.id
                    ].threshold_override
                    is not None
                )
                else profile.default_threshold
            ),
            threshold_override=(
                override_map[
                    process.id
                ].threshold_override
                if process.id in override_map
                else None
            ),
            criticality=(
                override_map[
                    process.id
                ].criticality
                if process.id in override_map
                else None
            ),
            inherited=(
                process.id not in override_map
                or override_map[
                    process.id
                ].threshold_override
                is None
            ),
        )
        for process in processes
    ]


@router.put(
    "/processes/{process_id}",
    response_model=ProcessRiskAppetiteResponse,
)
def update_process_appetite(
    process_id: int,
    payload: ProcessRiskAppetiteUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    process = (
        db.query(Process)
        .filter(
            Process.id == process_id,
            Process.tenant_id == user.tenant_id,
        )
        .first()
    )

    if not process:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=404,
            detail="Process not found.",
        )

    profile = (
        db.query(RiskAppetiteProfile)
        .filter(
            RiskAppetiteProfile.tenant_id
            == user.tenant_id,
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
        db.flush()

    override = (
        db.query(ProcessRiskAppetite)
        .filter(
            ProcessRiskAppetite.tenant_id
            == user.tenant_id,
            ProcessRiskAppetite.process_id
            == process.id,
        )
        .first()
    )

    criticality = (
        payload.criticality.strip().upper()
        if payload.criticality is not None
        else None
    )

    if criticality == "":
        criticality = None

    allowed_criticalities = {
        "LOW",
        "MEDIUM",
        "HIGH",
        "CRITICAL",
    }

    if (
        criticality is not None
        and criticality not in allowed_criticalities
    ):
        from fastapi import HTTPException

        raise HTTPException(
            status_code=422,
            detail=(
                "Criticality must be one of: "
                "LOW, MEDIUM, HIGH, CRITICAL."
            ),
        )

    if (
        payload.threshold_override is not None
        and payload.threshold_override < 1
    ):
        from fastapi import HTTPException

        raise HTTPException(
            status_code=422,
            detail=(
                "Threshold must be greater than zero."
            ),
        )

    if (
        payload.threshold_override is None
        and criticality is None
    ):
        if override:
            db.delete(override)
            db.commit()

        return ProcessRiskAppetiteResponse(
            process_id=process.id,
            process_name=process.name,
            threshold=profile.default_threshold,
            threshold_override=None,
            criticality=None,
            inherited=True,
        )

    if not override:
        override = ProcessRiskAppetite(
            tenant_id=user.tenant_id,
            process_id=process.id,
            profile_id=profile.id,
        )
        db.add(override)

    override.profile_id = profile.id
    override.threshold_override = (
        payload.threshold_override
    )
    override.criticality = criticality

    db.commit()
    db.refresh(override)

    effective_threshold = (
        override.threshold_override
        if override.threshold_override is not None
        else profile.default_threshold
    )

    return ProcessRiskAppetiteResponse(
        process_id=process.id,
        process_name=process.name,
        threshold=effective_threshold,
        threshold_override=(
            override.threshold_override
        ),
        criticality=override.criticality,
        inherited=(
            override.threshold_override is None
        ),
    )

