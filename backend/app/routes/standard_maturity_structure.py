from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user

from app.models.standards import Standard
from app.models.standard_process_area import StandardProcessArea
from app.models.standard_practice import StandardPractice
from app.models.standard_capability_level import StandardCapabilityLevel

router = APIRouter(
    prefix="/maturity/structure",
    tags=["Maturity Structure"],
)

# =========================================================
# PROCESS AREAS
# =========================================================

@router.post("/standards/{standard_id}/process-areas")
def create_process_area(
    standard_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    standard = db.get(Standard, standard_id)
    if not standard or standard.type != "MATURITY_BASED":
        raise HTTPException(status_code=404, detail="Maturity standard not found")

    area = StandardProcessArea(
        standard_id=standard_id,
        code=payload.get("code"),
        name=payload["name"],
        description=payload.get("description"),
        sort_order=payload.get("sort_order", 0),
    )
    db.add(area)
    db.commit()
    db.refresh(area)
    return area


# =========================================================
# PRACTICES
# =========================================================

@router.post("/standards/{standard_id}/practices")
def create_practice(
    standard_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    practice = StandardPractice(
        standard_id=standard_id,
        process_area_id=payload["process_area_id"],
        level=payload["level"],
        code=payload.get("code"),
        title=payload.get("title"),
        text=payload["text"],
        guidance=payload.get("guidance"),
        sort_order=payload.get("sort_order", 0),
    )
    db.add(practice)
    db.commit()
    db.refresh(practice)
    return practice


# =========================================================
# CAPABILITY LEVELS
# =========================================================

@router.post("/standards/{standard_id}/capability-levels")
def create_capability_level(
    standard_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    level = StandardCapabilityLevel(
        standard_id=standard_id,
        level=payload["level"],
        name=payload["name"],
        description=payload.get("description"),
    )
    db.add(level)
    db.commit()
    db.refresh(level)
    return level
