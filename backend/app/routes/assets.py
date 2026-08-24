from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db

from app.models.asset import Asset
from app.models.user import User


router = APIRouter(
    prefix="/company/assets",
    tags=["Company Assets"],
)


def parse_datetime(value):

    if value is None or value == "":
        return None

    if isinstance(value, datetime):
        return value

    try:
        return datetime.fromisoformat(
            str(value).replace("Z", "+00:00")
        )
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid datetime format",
        )


def asset_response(asset):

    return {
        "id": asset.id,
        "code": asset.code,
        "name": asset.name,
        "description": asset.description,
        "tenant_id": asset.tenant_id,
        "asset_type": asset.asset_type,
        "criticality": asset.criticality,
        "status": asset.status,
        "lifecycle_status": asset.lifecycle_status,
        "information_classification": asset.information_classification,
        "owner_user_id": asset.owner_user_id,
        "custodian_user_id": asset.custodian_user_id,
        "department": asset.department,
        "location": asset.location,
        "manufacturer": asset.manufacturer,
        "model_number": asset.model_number,
        "serial_number": asset.serial_number,
        "acquisition_date": asset.acquisition_date,
        "warranty_expiry": asset.warranty_expiry,
        "contract_expiry": asset.contract_expiry,
        "notes": asset.notes,
        "created_at": asset.created_at,
        "updated_at": asset.updated_at,
    }


def validate_user(
    db,
    user_id,
    tenant_id,
    field_name,
):

    stmt = select(User).where(
        User.id == user_id,
        User.tenant_id == tenant_id,
    )

    target_user = db.execute(stmt).scalar_one_or_none()

    if not target_user:
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} user not found in current tenant",
        )

    return target_user


@router.get("")
def list_assets(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = (
        select(Asset)
        .where(
            Asset.tenant_id == user.tenant_id
        )
        .order_by(
            Asset.code,
            Asset.id,
        )
    )

    assets = db.execute(stmt).scalars().all()

    return [
        asset_response(asset)
        for asset in assets
    ]


@router.get("/{asset_id}")
def get_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = select(Asset).where(
        Asset.id == asset_id,
        Asset.tenant_id == user.tenant_id,
    )

    asset = db.execute(stmt).scalar_one_or_none()

    if not asset:
        raise HTTPException(
            status_code=404,
            detail="Asset not found",
        )

    return asset_response(asset)


@router.post("")
def create_asset(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    code = str(payload.get("code", "")).strip()

    if not code:
        raise HTTPException(
            status_code=400,
            detail="Code is required",
        )

    name = str(payload.get("name", "")).strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Name is required",
        )

    existing_stmt = select(Asset).where(
        Asset.tenant_id == user.tenant_id,
        Asset.code == code,
    )

    existing = db.execute(existing_stmt).scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Asset code already exists",
        )

    owner_user_id = payload.get("owner_user_id")
    custodian_user_id = payload.get("custodian_user_id")

    if owner_user_id:
        validate_user(
            db,
            owner_user_id,
            user.tenant_id,
            "Owner",
        )

    if custodian_user_id:
        validate_user(
            db,
            custodian_user_id,
            user.tenant_id,
            "Custodian",
        )

    asset = Asset(
        tenant_id=user.tenant_id,
        code=code,
        name=name,
        description=payload.get("description"),
        asset_type=payload.get("asset_type", "other"),
        criticality=payload.get("criticality", "medium"),
        status=payload.get("status", "active"),
        lifecycle_status=payload.get("lifecycle_status", "in_service"),
        information_classification=payload.get(
            "information_classification"
        ),
        owner_user_id=owner_user_id,
        custodian_user_id=custodian_user_id,
        department=payload.get("department"),
        location=payload.get("location"),
        manufacturer=payload.get("manufacturer"),
        model_number=payload.get("model_number"),
        serial_number=payload.get("serial_number"),
        acquisition_date=parse_datetime(
            payload.get("acquisition_date")
        ),
        warranty_expiry=parse_datetime(
            payload.get("warranty_expiry")
        ),
        contract_expiry=parse_datetime(
            payload.get("contract_expiry")
        ),
        notes=payload.get("notes"),
    )

    db.add(asset)
    db.commit()
    db.refresh(asset)

    return asset_response(asset)


@router.put("/{asset_id}")
def update_asset(
    asset_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = select(Asset).where(
        Asset.id == asset_id,
        Asset.tenant_id == user.tenant_id,
    )

    asset = db.execute(stmt).scalar_one_or_none()

    if not asset:
        raise HTTPException(
            status_code=404,
            detail="Asset not found",
        )

    if "code" in payload:

        code = str(payload.get("code")).strip()

        if not code:
            raise HTTPException(
                status_code=400,
                detail="Code cannot be empty",
            )

        duplicate_stmt = select(Asset).where(
            Asset.tenant_id == user.tenant_id,
            Asset.code == code,
            Asset.id != asset_id,
        )

        duplicate = db.execute(
            duplicate_stmt
        ).scalar_one_or_none()

        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="Asset code already exists",
            )

        asset.code = code

    if "name" in payload:
        name = str(payload.get("name")).strip()

        if not name:
            raise HTTPException(
                status_code=400,
                detail="Name cannot be empty",
            )

        asset.name = name

    for field in [
        "description",
        "asset_type",
        "criticality",
        "status",
        "lifecycle_status",
        "information_classification",
        "department",
        "location",
        "manufacturer",
        "model_number",
        "serial_number",
        "notes",
    ]:
        if field in payload:
            setattr(
                asset,
                field,
                payload[field],
            )

    for field, label in [
        ("owner_user_id", "Owner"),
        ("custodian_user_id", "Custodian"),
    ]:
        if field in payload:

            value = payload[field]

            if value:
                validate_user(
                    db,
                    value,
                    user.tenant_id,
                    label,
                )

            setattr(
                asset,
                field,
                value,
            )

    for field in [
        "acquisition_date",
        "warranty_expiry",
        "contract_expiry",
    ]:
        if field in payload:
            setattr(
                asset,
                field,
                parse_datetime(payload[field]),
            )

    db.commit()
    db.refresh(asset)

    return asset_response(asset)


@router.delete("/{asset_id}")
def delete_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = select(Asset).where(
        Asset.id == asset_id,
        Asset.tenant_id == user.tenant_id,
    )

    asset = db.execute(stmt).scalar_one_or_none()

    if not asset:
        raise HTTPException(
            status_code=404,
            detail="Asset not found",
        )

    db.delete(asset)
    db.commit()

    return {
        "success": True,
        "deleted_id": asset_id,
    }
