from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
import re

from app.db.session import get_db
from app.core.security import get_current_user

from app.models.standards import Standard
from app.models.standard_versions import StandardVersion
from app.schemas.standard_schema import StandardCreate, StandardResponse

from app.models.clauses import Clause
from app.models.requirements import Requirement
from app.models.controls import Control
from app.models.standard_process_area import StandardProcessArea
from app.models.standard_practice import StandardPractice

from pydantic import BaseModel

router = APIRouter(
    prefix="/standards",
    tags=["Standards"]
)


def _normalized_code(value: str | None) -> str:
    return re.sub(r"[^A-Z0-9]", "", (value or "").upper())


def _find_canonical_published_version(
    db: Session,
    standard: Standard,
) -> StandardVersion | None:
    if standard.type != "CONTROL_BASED":
        return None

    candidates = (
        db.query(Standard)
        .filter(
            Standard.id != standard.id,
            Standard.type == "CONTROL_BASED",
        )
        .order_by(Standard.id.desc())
        .all()
    )

    source_standard = next(
        (
            item
            for item in candidates
            if _normalized_code(item.code) == _normalized_code(standard.code)
        ),
        None,
    )
    if not source_standard:
        return None

    return (
        db.query(StandardVersion)
        .filter(
            StandardVersion.standard_id == source_standard.id,
            StandardVersion.status == "published",
        )
        .order_by(StandardVersion.id.desc())
        .first()
    )


def _clone_control_structure(
    db: Session,
    source_version: StandardVersion,
    target_standard: Standard,
    target_version: StandardVersion,
) -> None:
    clauses = (
        db.query(Clause)
        .filter(Clause.standard_version_id == source_version.id)
        .order_by(Clause.id)
        .all()
    )

    clause_map: dict[int, int] = {}
    for c in clauses:
        nc = Clause(
            code=c.code,
            title=c.title,
            standard_id=target_standard.id,
            standard_version_id=target_version.id,
        )
        db.add(nc)
        db.flush()
        clause_map[c.id] = nc.id

    if not clause_map:
        return

    requirements = (
        db.query(Requirement)
        .filter(Requirement.clause_id.in_(list(clause_map.keys())))
        .order_by(Requirement.id)
        .all()
    )

    req_map: dict[int, int] = {}
    for r in requirements:
        target_clause_id = clause_map.get(r.clause_id)
        if not target_clause_id:
            continue
        nr = Requirement(
            code=r.code,
            title=r.title,
            clause_id=target_clause_id,
        )
        db.add(nr)
        db.flush()
        req_map[r.id] = nr.id

    controls = (
        db.query(Control)
        .filter(Control.standard_version_id == source_version.id)
        .order_by(Control.id)
        .all()
    )

    for ctl in controls:
        target_requirement_id = req_map.get(ctl.requirement_id)
        if not target_requirement_id:
            continue
        db.add(
            Control(
                code=ctl.code,
                title=ctl.title,
                description=ctl.description,
                requirement_id=target_requirement_id,
                standard_id=target_standard.id,
                standard_version_id=target_version.id,
            )
        )


def ensure_draft(db: Session, standard: Standard) -> StandardVersion:
    draft = (
        db.query(StandardVersion)
        .filter(
            StandardVersion.standard_id == standard.id,
            StandardVersion.status == "draft",
        )
        .first()
    )
    if draft:
        if standard.type == "CONTROL_BASED":
            has_structure = (
                db.query(Clause.id)
                .filter(Clause.standard_version_id == draft.id)
                .first()
                is not None
            )
            if not has_structure:
                source_version = _find_canonical_published_version(db, standard)
                if source_version:
                    _clone_control_structure(db, source_version, standard, draft)
                    db.commit()
        return draft

    published = (
        db.query(StandardVersion)
        .filter(
            StandardVersion.standard_id == standard.id,
            StandardVersion.status == "published",
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

        if standard.type == "CONTROL_BASED":
            source_version = _find_canonical_published_version(db, standard)
            if source_version:
                _clone_control_structure(db, source_version, standard, draft)
                db.commit()
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
        _clone_control_structure(db, published, standard, draft)

    db.commit()
    return draft


class ClauseCreate(BaseModel):
    code: str
    title: str


@router.post("/{standard_id}/clauses")
def create_clause(
    standard_id: int,
    payload: ClauseCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    standard = db.query(Standard).filter(Standard.id == standard_id).first()
    if not standard:
        raise HTTPException(status_code=404, detail="Standard not found")

    version = ensure_draft(db, standard)

    if version.status != "draft":
        raise HTTPException(
            status_code=400,
            detail="Cannot add clause to published standard",
        )

    exists = (
        db.query(Clause)
        .filter(
            Clause.standard_version_id == version.id,
            Clause.code == payload.code,
        )
        .first()
    )
    if exists:
        raise HTTPException(
            status_code=400,
            detail="Clause with same code already exists",
        )

    clause = Clause(
        code=payload.code,
        title=payload.title,
        standard_id=standard.id,
        standard_version_id=version.id,
    )

    db.add(clause)
    db.commit()
    db.refresh(clause)

    return {
        "id": clause.id,
        "code": clause.code,
        "title": clause.title,
        "standard_version_id": version.id,
    }


@router.post("/", response_model=StandardResponse)
def create_standard(
    standard: StandardCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    exists = db.query(Standard).filter(Standard.code == standard.code).first()
    if exists:
        raise HTTPException(status_code=400, detail="Standard already exists")

    db_standard = Standard(
        code=standard.code,
        title=standard.title,
        description=standard.description,
        type=standard.type,
    )
    db.add(db_standard)
    db.commit()
    db.refresh(db_standard)

    requested_version = (standard.version or "").strip()
    draft = StandardVersion(
        standard_id=db_standard.id,
        version_code=requested_version or "v1",
        status="draft",
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)

    if db_standard.type == "CONTROL_BASED":
        source_version = _find_canonical_published_version(db, db_standard)
        if source_version:
            _clone_control_structure(db, source_version, db_standard, draft)

    db.commit()
    return StandardResponse.model_validate(db_standard)


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
            StandardVersion.standard_id == standard_id,
            StandardVersion.status == "draft",
        )
        .first()
    )
    if not draft:
        raise HTTPException(status_code=400, detail="No draft to publish")

    db.query(StandardVersion).filter(
        StandardVersion.standard_id == standard_id,
        StandardVersion.status == "published",
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


@router.post("/{standard_id}/draft")
def get_or_create_draft(
    standard_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    standard = db.query(Standard).filter(Standard.id == standard_id).first()
    if not standard:
        raise HTTPException(status_code=404, detail="Standard not found")

    draft = ensure_draft(db, standard)

    return {
        "standard_id": standard.id,
        "draft_version_id": draft.id,
        "version": draft.version_code,
        "status": draft.status,
    }
