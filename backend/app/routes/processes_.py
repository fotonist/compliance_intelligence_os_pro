# backend/app/routes/processes.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, func, case, desc
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.process import Process
from app.models.process_risk_link import ProcessRiskLink
from app.models.risks import Risk

# Optional model import (DB hazır dediğin için mevcut varsayıyoruz)
try:
    from app.models.process_risk_link_audit import ProcessRiskLinkAudit  # type: ignore
except Exception:
    ProcessRiskLinkAudit = None  # type: ignore


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
                # DB'de severity yok → risk_level
                "severity": getattr(r, "risk_level", None),
            }
        )
    return out


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


def _severity_weight_expr():
    # DB'de severity yok → risk_level string değerlerini normalize edip ağırlıkla.
    lvl_upper = func.upper(func.coalesce(Risk.risk_level, ""))
    return case(
        (lvl_upper.like("CRITICAL%"), 4),
        (lvl_upper.like("HIGH%"), 3),
        (lvl_upper.like("MEDIUM%"), 2),
        (lvl_upper.like("LOW%"), 1),
        else_=0,
    )


def _weight_to_severity(weight: int) -> str | None:
    if weight >= 4:
        return "CRITICAL"
    if weight == 3:
        return "HIGH"
    if weight == 2:
        return "MEDIUM"
    if weight == 1:
        return "LOW"
    return None


def _risk_is_open_expr():
    # Risk.status alanı varsa OPEN say, yoksa "her şeyi open" gibi davranacağız (fallback).
    # SQLAlchemy level'da attribute yoksa compile error olur; bu yüzden try/catch ile branch.
    try:
        status_upper = func.upper(func.coalesce(Risk.status, ""))
        return status_upper.like("OPEN%")
    except Exception:
        return None


def _audit_write(db: Session, user: User, process_id: int, risk_id: int, action: str):
    # Audit model yoksa 500 verelim: audit trail optional olmamalı.
    if ProcessRiskLinkAudit is None:
        raise HTTPException(status_code=500, detail="Audit model is not available on server")

    audit = ProcessRiskLinkAudit(
        process_id=process_id,
        risk_id=risk_id,
        action=action,
        user_id=user.id,
    )
    # tenant_id varsa set et
    if hasattr(audit, "tenant_id"):
        setattr(audit, "tenant_id", user.tenant_id)

    db.add(audit)


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


@router.get("/{process_id}/risk-summary")
def get_process_risk_summary(
    process_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_process_or_404(db, user.tenant_id, process_id)

    weight_expr = _severity_weight_expr()
    is_open_expr = _risk_is_open_expr()

    base_where = and_(
        ProcessRiskLink.tenant_id == user.tenant_id,
        ProcessRiskLink.process_id == process_id,
        Risk.id == ProcessRiskLink.risk_id,
        Risk.tenant_id == user.tenant_id,
    )

    # linked_count
    linked_count = (
        db.execute(
            select(func.count()).select_from(ProcessRiskLink).where(
                and_(
                    ProcessRiskLink.tenant_id == user.tenant_id,
                    ProcessRiskLink.process_id == process_id,
                )
            )
        ).scalar_one()
        or 0
    )

    # open_count + breakdown
    # Eğer Risk.status yoksa fallback: open_count = linked_count, breakdown tüm linked üzerinden
    if is_open_expr is None:
        open_filter = None
        open_count = linked_count
    else:
        open_filter = is_open_expr
        open_count = (
            db.execute(
                select(func.count())
                .select_from(ProcessRiskLink)
                .join(Risk, Risk.id == ProcessRiskLink.risk_id)
                .where(and_(base_where, open_filter))
            ).scalar_one()
            or 0
        )

    # Breakdown: LOW/MEDIUM/HIGH/CRITICAL
    breakdown = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}

    breakdown_stmt = (
        # DB'de severity yok → risk_level
        select(func.upper(func.coalesce(Risk.risk_level, "")).label("sev"), func.count().label("cnt"))
        .select_from(ProcessRiskLink)
        .join(Risk, Risk.id == ProcessRiskLink.risk_id)
        .where(base_where)
        .group_by("sev")
    )
    if open_filter is not None:
        breakdown_stmt = breakdown_stmt.where(open_filter)

    for sev, cnt in db.execute(breakdown_stmt).all():
        s = (sev or "").upper()
        c = int(cnt or 0)
        if s.startswith("CRITICAL"):
            breakdown["CRITICAL"] += c
        elif s.startswith("HIGH"):
            breakdown["HIGH"] += c
        elif s.startswith("MEDIUM"):
            breakdown["MEDIUM"] += c
        elif s.startswith("LOW"):
            breakdown["LOW"] += c

    # highest_severity: sadece OPEN üzerinden (fallback'te tüm linked)
    max_stmt = (
        select(func.max(weight_expr))
        .select_from(ProcessRiskLink)
        .join(Risk, Risk.id == ProcessRiskLink.risk_id)
        .where(base_where)
    )
    if open_filter is not None:
        max_stmt = max_stmt.where(open_filter)

    max_weight = db.execute(max_stmt).scalar_one()
    highest = _weight_to_severity(int(max_weight or 0))

    return {
        "linked_count": int(linked_count),
        "open_count": int(open_count),
        "highest_severity": highest,
        "severity_breakdown": breakdown,
    }


@router.get("/{process_id}/risk-audit-log")
def get_process_risk_audit_log(
    process_id: int,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _get_process_or_404(db, user.tenant_id, process_id)

    if ProcessRiskLinkAudit is None:
        raise HTTPException(status_code=500, detail="Audit model is not available on server")

    # page size guard
    if page_size not in (20, 50, 100):
        page_size = 20
    if page < 1:
        page = 1

    # tenant guard (audit modelde tenant_id varsa kullan)
    base_filters = [ProcessRiskLinkAudit.process_id == process_id]
    if hasattr(ProcessRiskLinkAudit, "tenant_id"):
        base_filters.append(getattr(ProcessRiskLinkAudit, "tenant_id") == user.tenant_id)

    total = db.execute(
        select(func.count()).select_from(ProcessRiskLinkAudit).where(and_(*base_filters))
    ).scalar_one() or 0

    total_pages = int((int(total) + page_size - 1) / page_size) if total else 1
    if page > total_pages:
        page = total_pages

    stmt = (
        select(ProcessRiskLinkAudit, Risk, User)
        .join(Risk, Risk.id == ProcessRiskLinkAudit.risk_id)
        .join(User, User.id == ProcessRiskLinkAudit.user_id)
        .where(and_(*base_filters))
        .order_by(desc(getattr(ProcessRiskLinkAudit, "created_at")))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    items = []
    for a, r, u in db.execute(stmt).all():
        items.append(
            {
                "risk_id": r.id,
                "risk_code": getattr(r, "code", None),
                "risk_title": getattr(r, "title", "") or "",
                "action": getattr(a, "action", None),
                "user": {
                    "id": u.id,
                    "full_name": getattr(u, "full_name", None) or getattr(u, "name", None) or getattr(u, "email", ""),
                },
                "created_at": getattr(a, "created_at").isoformat() if getattr(a, "created_at", None) else None,
            }
        )

    return {
        "items": items,
        "total": int(total),
        "page": int(page),
        "page_size": int(page_size),
        "total_pages": int(total_pages),
    }


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
        # Audit: transactional (same commit)
        _audit_write(db, user, process_id, risk_id, "LINKED")
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

    try:
        _audit_write(db, user, process_id, risk_id, "UNLINKED")
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to write audit log")

    return {"ok": True, "deleted": True, "process_id": process_id, "risk_id": risk_id}
