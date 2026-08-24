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

from app.models.location import Location
from app.models.user import User


router = APIRouter(
    prefix="/company/locations",
    tags=["Company Locations"],
)


def location_response(location):

    return {
        "id": location.id,
        "tenant_id": location.tenant_id,
        "organization_id": location.organization_id,
        "name": location.name,
        "code": location.code,
        "location_type": location.location_type,
        "address": location.address,
        "city": location.city,
        "country": location.country,
        "contact_person": location.contact_person,
        "contact_email": location.contact_email,
        "contact_phone": location.contact_phone,
        "status": location.status,
        "created_by": location.created_by,
        "created_at": location.created_at,
        "updated_at": location.updated_at,
    }


@router.get("")
def list_locations(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = (
        select(Location)
        .where(
            Location.tenant_id == user.tenant_id
        )
        .order_by(
            Location.name,
            Location.id,
        )
    )

    locations = db.execute(stmt).scalars().all()

    return [
        location_response(location)
        for location in locations
    ]


@router.get("/{location_id}")
def get_location(
    location_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = select(Location).where(
        Location.id == location_id,
        Location.tenant_id == user.tenant_id,
    )

    location = db.execute(stmt).scalar_one_or_none()

    if not location:
        raise HTTPException(
            status_code=404,
            detail="Location not found",
        )

    return location_response(location)


@router.post("")
def create_location(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    name = str(
        payload.get("name", "")
    ).strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Location name is required",
        )

    location = Location(
        tenant_id=user.tenant_id,
        organization_id=payload.get(
            "organization_id"
        ),
        name=name,
        code=payload.get("code"),
        location_type=payload.get(
            "location_type"
        ),
        address=payload.get("address"),
        city=payload.get("city"),
        country=payload.get("country"),
        contact_person=payload.get(
            "contact_person"
        ),
        contact_email=payload.get(
            "contact_email"
        ),
        contact_phone=payload.get(
            "contact_phone"
        ),
        status=payload.get(
            "status",
            "ACTIVE",
        ),
        created_by=payload.get(
            "created_by"
        ),
    )

    db.add(location)
    db.commit()
    db.refresh(location)

    return location_response(location)


@router.put("/{location_id}")
def update_location(
    location_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = select(Location).where(
        Location.id == location_id,
        Location.tenant_id == user.tenant_id,
    )

    location = db.execute(stmt).scalar_one_or_none()

    if not location:
        raise HTTPException(
            status_code=404,
            detail="Location not found",
        )

    for field in [
        "organization_id",
        "name",
        "code",
        "location_type",
        "address",
        "city",
        "country",
        "contact_person",
        "contact_email",
        "contact_phone",
        "status",
    ]:
        if field in payload:
            setattr(
                location,
                field,
                payload[field],
            )

    location.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(location)

    return location_response(location)


@router.delete("/{location_id}")
def delete_location(
    location_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = select(Location).where(
        Location.id == location_id,
        Location.tenant_id == user.tenant_id,
    )

    location = db.execute(stmt).scalar_one_or_none()

    if not location:
        raise HTTPException(
            status_code=404,
            detail="Location not found",
        )

    db.delete(location)
    db.commit()

    return {
        "message": "Location deleted successfully"
    }
