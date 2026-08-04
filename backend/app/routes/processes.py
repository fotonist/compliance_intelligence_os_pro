# backend/app/routes/processes.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.process import Process
from app.models.process_risk_link import ProcessRiskLink
from app.models.risks import Risk

from app.models.standards import Standard
from app.models.clauses import Clause
from app.models.requirements import Requirement
from app.models.controls import Control
router = APIRouter(prefix="/company/processes", tags=["Company"])


def _process_to_json(p: Process):
    return {
        "id": p.id,
        "code": p.code,
        "name": p.name,
        "type": p.type,
        "owner": p.owner or "",
        "status": p.status or "draft",
        # UI bekliyor ama modelde yok → şimdilik boş dönüyoruz
        "description": "",
        "inputs": [],
        "outputs": [],
        "related_standards": [],
        "linked_risks": [],
        "kpis": [],
        "created_at": p.created_at.isoformat() if getattr(p, "created_at", None) else None,
        "updated_at": p.updated_at.isoformat() if getattr(p, "updated_at", None) else None,
    }


def _linked_risks_for_process(db: Session, tenant_id: int, process_id: int):
    links_stmt = (
        select(ProcessRiskLink, Risk)
        .join(Risk, Risk.id == ProcessRiskLink.risk_id)
        .where(
            and_(
                ProcessRiskLink.tenant_id == tenant_id,
                ProcessRiskLink.process_id == process_id,
            )
        )
        .order_by(ProcessRiskLink.id.desc())
    )
    pairs = db.execute(links_stmt).all()

    out = []
    for link, r in pairs:
        out.append(
            {
                "id": r.id,
                "code": getattr(r, "code", None),
                "title": getattr(r, "title", "") or "",
                "severity": getattr(r, "severity", None),
            }
        )
    return out

def _derived_standards_for_process(db: Session, tenant_id: int, process_id: int):
    stmt = (
        select(Standard)
        .join(Clause, Clause.standard_id == Standard.id)
        .join(Requirement, Requirement.clause_id == Clause.id)
        .join(Control, Control.requirement_id == Requirement.id)
        .join(Risk, Risk.control_id == Control.id)
        .join(ProcessRiskLink, ProcessRiskLink.risk_id == Risk.id)
        .where(
            and_(
                ProcessRiskLink.process_id == process_id,
                ProcessRiskLink.tenant_id == tenant_id,
                Risk.tenant_id == tenant_id,
                Control.tenant_id == tenant_id,
                Requirement.tenant_id == tenant_id,
                Clause.tenant_id == tenant_id,
            )
        )
        .distinct()
        .order_by(Standard.id)
    )

    rows = db.execute(stmt).scalars().all()

    return [
        {
            "id": s.id,
            "code": s.code,
            "name": s.name,
        }
        for s in rows
    ]
def _get_process_or_404(db: Session, tenant_id: int, process_id: int) -> Process:
    p = db.execute(
        select(Process).where(and_(Process.id == process_id, Process.tenant_id == tenant_id))
    ).scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Process not found")
    return p


def _get_risk_or_404(db: Session, tenant_id: int, risk_id: int) -> Risk:
    r = db.execute(
        select(Risk).where(and_(Risk.id == risk_id, Risk.tenant_id == tenant_id))
    ).scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Risk not found")
    return r


@router.get("")
def list_processes(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Process).where(Process.tenant_id == user.tenant_id).order_by(Process.id.desc())
    rows = db.execute(stmt).scalars().all()
    return [_process_to_json(p) for p in rows]


@router.post("")
def create_process(
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    code = (payload.get("code") or "").strip()
    name = (payload.get("name") or "").strip()
    ptype = (payload.get("type") or "core").strip()
    owner = payload.get("owner")
    status = payload.get("status") or "draft"

    if not code or not name:
        raise HTTPException(status_code=400, detail="code and name are required")

    p = Process(
        tenant_id=user.tenant_id,
        code=code,
        name=name,
        type=ptype,
        owner=owner,
        status=status,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _process_to_json(p)


@router.get("/{process_id}")
def get_process(
    process_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    p = _get_process_or_404(db, user.tenant_id, process_id)

    out = _process_to_json(p)
    out["linked_risks"] = _linked_risks_for_process(db, user.tenant_id, process_id)

    # ✅ Derived standards
    out["related_standards"] = _derived_standards_for_process(
        db, user.tenant_id, process_id
    )

    return out

@router.put("/{process_id}")
def update_process(
    process_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    p = _get_process_or_404(db, user.tenant_id, process_id)

    for field in ["code", "name", "type", "owner", "status"]:
        if field in payload:
            setattr(p, field, payload.get(field))

    db.commit()
    db.refresh(p)
    out = _process_to_json(p)
    out["linked_risks"] = _linked_risks_for_process(db, user.tenant_id, process_id)
    return out


@router.get("/{process_id}/risks")
def list_process_risks(
    process_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_process_or_404(db, user.tenant_id, process_id)
    return _linked_risks_for_process(db, user.tenant_id, process_id)


@router.post("/{process_id}/risks/{risk_id}")
def link_risk_to_process(
    process_id: int,
    risk_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # tenant guards
    _get_process_or_404(db, user.tenant_id, process_id)
    _get_risk_or_404(db, user.tenant_id, risk_id)

    link = ProcessRiskLink(
        tenant_id=user.tenant_id,
        process_id=process_id,
        risk_id=risk_id,
    )
    db.add(link)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # uq_process_risk_unique -> duplicate link
        raise HTTPException(status_code=409, detail="Process-Risk link already exists")

    return {"ok": True, "process_id": process_id, "risk_id": risk_id}


@router.delete("/{process_id}/risks/{risk_id}")
def unlink_risk_from_process(
    process_id: int,
    risk_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_process_or_404(db, user.tenant_id, process_id)

    link = db.execute(
        select(ProcessRiskLink).where(
            and_(
                ProcessRiskLink.tenant_id == user.tenant_id,
                ProcessRiskLink.process_id == process_id,
                ProcessRiskLink.risk_id == risk_id,
            )
        )
    ).scalar_one_or_none()

    if not link:
        # idempotent delete: production’da rahatlık sağlar
        return {"ok": True, "deleted": False, "process_id": process_id, "risk_id": risk_id}

    db.delete(link)
    db.commit()
    return {"ok": True, "deleted": True, "process_id": process_id, "risk_id": risk_id}
# -------------------------------------------------------------------------------------------------
# GET STANDARDS
# ------------------------------------------------------------------------------------------------
@router.get("/standards")
def list_standards(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = db.execute(
        select(Standard)
        .where(Standard.tenant_id == user.tenant_id)
        .order_by(Standard.id)
    ).scalars().all()

    return [
        {"id": s.id, "code": getattr(s, "code", None), "name": getattr(s, "name", "")}
        for s in rows
    ]
# ----------------------------------------------------------------------------------------------------
# GET CLAUSES BY STANDARD
# ----------------------------------------------------------------------------------------------------
@router.get("/standards/{standard_id}/clauses")
def list_clauses(
    standard_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = db.execute(
        select(Clause)
        .where(
            and_(
                Clause.standard_id == standard_id,
                Clause.tenant_id == user.tenant_id,
            )
        )
        .order_by(Clause.id)
    ).scalars().all()

    return [
        {"id": c.id, "code": getattr(c, "code", None), "title": getattr(c, "title", "")}
        for c in rows
    ]
# ----------------------------------------------------------------------------------------------------
# GET REQUIREMENTS BY CLAUSE
# ----------------------------------------------------------------------------------------------------
@router.get("/clauses/{clause_id}/requirements")
def list_requirements(
    clause_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = db.execute(
        select(Requirement)
        .where(
            and_(
                Requirement.clause_id == clause_id,
                Requirement.tenant_id == user.tenant_id,
            )
        )
        .order_by(Requirement.id)
    ).scalars().all()

    return [
        {"id": r.id, "code": getattr(r, "code", None), "title": getattr(r, "title", "")}
        for r in rows
    ]
# ----------------------------------------------------------------------------------------------------
# GET CONTROLS BY REQUIREMENTS
# ----------------------------------------------------------------------------------------------------
@router.get("/requirements/{requirement_id}/controls")
def list_controls(
    requirement_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = db.execute(
        select(Control)
        .where(
            and_(
                Control.requirement_id == requirement_id,
                Control.tenant_id == user.tenant_id,
            )
        )
        .order_by(Control.id)
    ).scalars().all()

    return [
        {"id": c.id, "code": getattr(c, "code", None), "title": getattr(c, "title", "")}
        for c in rows
    ]
# ----------------------------------------------------------------------------------------------------
# DERIVED STANDARDS FOR PROCESS (via Risk -> Control -> Requirement -> Clause -> Standard)
# ----------------------------------------------------------------------------------------------------
@router.get("/{process_id}/standards")
def list_derived_standards_for_process(
    process_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_process_or_404(db, user.tenant_id, process_id)

    stmt = (
        select(Standard)
        .join(Clause, Clause.standard_id == Standard.id)
        .join(Requirement, Requirement.clause_id == Clause.id)
        .join(Control, Control.requirement_id == Requirement.id)
        .join(Risk, Risk.control_id == Control.id)
        .join(ProcessRiskLink, ProcessRiskLink.risk_id == Risk.id)
        .where(
            and_(
                ProcessRiskLink.process_id == process_id,
                ProcessRiskLink.tenant_id == user.tenant_id,
            )
        )
        .distinct()
        .order_by(Standard.id)
    )

    rows = db.execute(stmt).scalars().all()

    return [
        {
            "id": s.id,
            "code": s.code,
            "name": s.title,   # Standard modelinde name yok, title var
        }
        for s in rows
    ]