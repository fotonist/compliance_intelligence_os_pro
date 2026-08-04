from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.db.session import get_db
from app.core.security import get_current_user

from app.models.standards import Standard
from app.models.standard_versions import StandardVersion
from app.schemas.standard_schema import StandardCreate, StandardResponse

# STRUCTURE MODELS
from app.models.clauses import Clause
from app.models.requirements import Requirement
from app.models.controls import Control
from app.models.standard_process_area import StandardProcessArea
from app.models.standard_practice import StandardPractice

router = APIRouter(
    prefix="/standards",
    tags=["Standards"]
)

# =================================================
# PHASE A – CORE RULE
# =================================================
def ensure_draft(db: Session, standard: Standard) -> StandardVersion:
    """
    Phase A lifecycle kuralı:
    - Tek aktif draft
    - Varsa döndür
    - Yoksa published'dan clone et
    - Hiç published yoksa empty draft oluştur
    """

    draft = (
        db.query(StandardVersion)
        .filter(
            and_(
                StandardVersion.standard_id == standard.id,
                StandardVersion.status == "draft",
            )
        )
        .first()
    )
    if draft:
        return draft

    published = (
        db.query(StandardVersion)
        .filter(
            and_(
                StandardVersion.standard_id == standard.id,
                StandardVersion.status == "published",
            )
        )
        .order_by(StandardVersion.id.desc())
        .first()
    )

    if not published:
        draft = StandardVersion(
            standard_id=standard.id,
            version_code="v1",
            status="draft",
        )
        db.add(draft)
        db.commit()
        db.refresh(draft)
        return draft

    draft = StandardVersion(
        standard_id=standard.id,
        version_code=f"v{published.id + 1}",
        status="draft",
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)

    if standard.type == "CONTROL_BASED":
        clauses = db.query(Clause).filter(
            Clause.standard_version_id == published.id
        ).all()

        clause_map = {}
        for c in clauses:
            nc = Clause(
                code=c.code,
                title=c.title,
                standard_id=c.standard_id,
                standard_version_id=draft.id,
            )
            db.add(nc)
            db.flush()
            clause_map[c.id] = nc.id

        requirements = db.query(Requirement).filter(
            Requirement.clause_id.in_(clause_map.keys())
        ).all()

        req_map = {}
        for r in requirements:
            nr = Requirement(
                code=r.code,
                title=r.title,
                clause_id=clause_map[r.clause_id],
            )
            db.add(nr)
            db.flush()
            req_map[r.id] = nr.id

        controls = db.query(Control).filter(
            Control.standard_version_id == published.id
        ).all()

        for ctl in controls:
            db.add(
                Control(
                    code=ctl.code,
                    title=ctl.title,
                    description=ctl.description,
                    requirement_id=req_map.get(ctl.requirement_id),
                    standard_id=ctl.standard_id,
                    standard_version_id=draft.id,
                )
            )

    db.commit()
    return draft


# -----------------------------
# CREATE STANDARD
# -----------------------------
@router.post("/", response_model=StandardResponse)
def create_standard(
    standard: StandardCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    exists = db.query(Standard).filter(Standard.code == standard.code).first()
    if exists:
        raise HTTPException(status_code=400, detail="Standard already exists")

    db_standard = Standard(**standard.model_dump())
    db.add(db_standard)
    db.commit()
    db.refresh(db_standard)

    ensure_draft(db, db_standard)

    return StandardResponse.model_validate(db_standard)


# =================================================
# PHASE B – PUBLISH
# =================================================
@router.post("/{standard_id}/publish")
def publish_standard(
    standard_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    standard = db.query(Standard).filter(Standard.id == standard_id).first()
    if not standard:
        raise HTTPException(status_code=404, detail="Standard not found")

    draft = (
        db.query(StandardVersion)
        .filter(
            and_(
                StandardVersion.standard_id == standard_id,
                StandardVersion.status == "draft",
            )
        )
        .first()
    )
    if not draft:
        raise HTTPException(status_code=400, detail="No draft to publish")

    db.query(StandardVersion).filter(
        and_(
            StandardVersion.standard_id == standard_id,
            StandardVersion.status == "published",
        )
    ).update({"status": "archived"})

    draft.status = "published"
    db.commit()
    db.refresh(draft)

    new_draft = ensure_draft(db, standard)

    return {
        "standard_id": standard_id,
        "published_version_id": draft.id,
        "new_draft_version_id": new_draft.id,
    }


# =================================================
# CREATE NEW DRAFT FROM PUBLISHED (MANUAL)
# =================================================
@router.post("/{standard_id}/draft")
def create_draft_from_published(
    standard_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    standard = db.query(Standard).filter(Standard.id == standard_id).first()
    if not standard:
        raise HTTPException(status_code=404, detail="Standard not found")

    draft = ensure_draft(db, standard)

    return {
        "standard_id": standard_id,
        "draft_version_id": draft.id,
        "version": draft.version_code,
        "status": "draft",
    }


# =================================================
# GET STANDARD STRUCTURE (DRAFT FIRST)
# =================================================
@router.get("/{standard_id}/structure")
def get_standard_structure(
    standard_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    standard = db.query(Standard).filter(Standard.id == standard_id).first()
    if not standard:
        raise HTTPException(status_code=404, detail="Standard not found")

    version = ensure_draft(db, standard)

    if standard.type == "CONTROL_BASED":
        clauses = db.query(Clause).filter(
            Clause.standard_version_id == version.id
        ).all()

        result = []
        for c in clauses:
            reqs = db.query(Requirement).filter(
                Requirement.clause_id == c.id
            ).all()

            req_items = []
            for r in reqs:
                ctrls = db.query(Control).filter(
                    Control.requirement_id == r.id
                ).all()

                req_items.append({
                    "id": r.id,
                    "code": r.code,
                    "title": r.title,
                    "controls": [
                        {
                            "id": ctl.id,
                            "code": ctl.code,
                            "title": ctl.title,
                        }
                        for ctl in ctrls
                    ],
                })

            result.append({
                "id": c.id,
                "code": c.code,
                "title": c.title,
                "requirements": req_items,
            })

        return {
            "standard_id": standard.id,
            "standard_code": standard.code,
            "version": version.version_code,
            "status": version.status,
            "type": standard.type,
            "clauses": result,
        }

    process_areas = (
        db.query(StandardProcessArea)
        .filter(StandardProcessArea.standard_id == standard.id)
        .order_by(StandardProcessArea.code)
        .all()
    )

    return {
        "standard_id": standard.id,
        "standard_code": standard.code,
        "version": version.version_code,
        "status": version.status,
        "type": standard.type,
        "process_areas": [
            {
                "id": pa.id,
                "code": pa.code,
                "title": pa.name,
                "practices": [
                    {
                        "id": p.id,
                        "code": p.code,
                        "title": p.title,
                        "level": p.level,
                    }
                    for p in db.query(StandardPractice)
                    .filter(StandardPractice.process_area_id == pa.id)
                    .order_by(StandardPractice.code)
                    .all()
                ],
            }
            for pa in process_areas
        ],
    }


# -----------------------------
# LIST STANDARDS (BOTH PATHS)
# -----------------------------
@router.get("/", response_model=list[StandardResponse])
def list_standards(
    type: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    q = (
        db.query(
            Standard,
            StandardVersion.version_code,
            StandardVersion.status,
        )
        .outerjoin(
            StandardVersion,
            and_(
                StandardVersion.standard_id == Standard.id,
                StandardVersion.status == "draft",
            )
        )
    )

    if type:
        q = q.filter(Standard.type == type)

    rows = q.order_by(Standard.code).all()

    result = []
    for standard, version_code, status in rows:
        item = StandardResponse.model_validate(standard)
        item.version = version_code
        item.status = status or "draft"
        result.append(item)

    return result


# -----------------------------
# GET STANDARD BY ID
# -----------------------------
@router.get("/{standard_id}", response_model=StandardResponse)
def get_standard(
    standard_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    standard = db.query(Standard).filter(Standard.id == standard_id).first()
    if not standard:
        raise HTTPException(status_code=404, detail="Standard not found")
    return StandardResponse.model_validate(standard)
