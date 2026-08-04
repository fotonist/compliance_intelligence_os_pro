from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user

from app.models.process import Process
from app.models.risks import Risk
from app.models.process_risk_link import ProcessRiskLink

router = APIRouter(prefix="", tags=["Process-Risk Links"])


def _get_user_tenant_id(user) -> Optional[int]:
    # user objende tenant_id yoksa None döner; bu durumda tenant guard'ı bypass etmiyoruz,
    # hata veriyoruz çünkü multi-tenant'ta bu riskli.
    return getattr(user, "tenant_id", None)


def _require_tenant(user) -> int:
    tid = _get_user_tenant_id(user)
    if tid is None:
        raise HTTPException(status_code=400, detail="User tenant_id not found")
    return tid


def _load_process(db: Session, process_id: int, tenant_id: int) -> Process:
    p = (
        db.query(Process)
        .filter(Process.id == process_id)
        .filter(Process.tenant_id == tenant_id)
        .first()
    )
    if not p:
        raise HTTPException(status_code=404, detail="Process not found")
    return p


def _load_risk(db: Session, risk_id: int, tenant_id: int) -> Risk:
    r = db.query(Risk).filter(Risk.id == risk_id).filter(Risk.tenant_id == tenant_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Risk not found")
    return r


@router.post("/processes/{process_id}/risks/{risk_id}")
def link_risk_to_process(
    process_id: int,
    risk_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _require_tenant(user)

    process = _load_process(db, process_id, tenant_id)
    risk = _load_risk(db, risk_id, tenant_id)

    # Tenant consistency (zaten tenant filtreledik ama future-proof)
    if process.tenant_id != risk.tenant_id:
        raise HTTPException(status_code=400, detail="Cross-tenant link is not allowed")

    exists = (
        db.query(ProcessRiskLink)
        .filter(ProcessRiskLink.tenant_id == tenant_id)
        .filter(ProcessRiskLink.process_id == process_id)
        .filter(ProcessRiskLink.risk_id == risk_id)
        .first()
    )
    if exists:
        return {"ok": True, "id": exists.id, "message": "Already linked"}

    link = ProcessRiskLink(
        tenant_id=tenant_id,
        process_id=process_id,
        risk_id=risk_id,
    )
    db.add(link)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        # Unique constraint fallback (race condition)
        raise HTTPException(status_code=409, detail="Link already exists") from e

    db.refresh(link)
    return {"ok": True, "id": link.id}


@router.delete("/processes/{process_id}/risks/{risk_id}")
def unlink_risk_from_process(
    process_id: int,
    risk_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _require_tenant(user)

    link = (
        db.query(ProcessRiskLink)
        .filter(ProcessRiskLink.tenant_id == tenant_id)
        .filter(ProcessRiskLink.process_id == process_id)
        .filter(ProcessRiskLink.risk_id == risk_id)
        .first()
    )
    if not link:
        return {"ok": True, "message": "Not linked"}

    db.delete(link)
    db.commit()
    return {"ok": True}


@router.get("/processes/{process_id}/risks")
def list_risks_of_process(
    process_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _require_tenant(user)

    # ensure process exists (and tenant-scoped)
    _load_process(db, process_id, tenant_id)

    rows = (
        db.query(Risk)
        .join(ProcessRiskLink, ProcessRiskLink.risk_id == Risk.id)
        .filter(ProcessRiskLink.tenant_id == tenant_id)
        .filter(ProcessRiskLink.process_id == process_id)
        .all()
    )

    # minimal response (UI-friendly)
    return [
        {
            "id": r.id,
            "title": r.title,
            "impact": r.impact,
            "likelihood": r.likelihood,
            "score": r.score,
            "risk_level": r.risk_level,
            "status": r.status,
        }
        for r in rows
    ]


@router.get("/risks/{risk_id}/processes")
def list_processes_of_risk(
    risk_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _require_tenant(user)

    # ensure risk exists (and tenant-scoped)
    _load_risk(db, risk_id, tenant_id)

    rows = (
        db.query(Process)
        .join(ProcessRiskLink, ProcessRiskLink.process_id == Process.id)
        .filter(ProcessRiskLink.tenant_id == tenant_id)
        .filter(ProcessRiskLink.risk_id == risk_id)
        .all()
    )

    return [
        {
            "id": p.id,
            "code": p.code,
            "name": p.name,
            "type": p.type,
            "owner": p.owner,
            "status": p.status,
        }
        for p in rows
    ]
