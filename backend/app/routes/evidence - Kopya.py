from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func, select, String
from pydantic import BaseModel
from datetime import datetime
import os
import shutil
import uuid

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.evidences import Evidence
from app.models.evidence_files import EvidenceFile
from app.models.risk_evidence_link import RiskEvidenceLink
from app.models.risks import Risk
from app.models.controls import Control
from app.models.requirements import Requirement
from app.models.clauses import Clause
from app.models.standards import Standard

router = APIRouter(prefix="/evidences", tags=["Evidences"])


# =====================================================
# REQUEST SCHEMAS
# =====================================================
class UnlinkRiskRequest(BaseModel):
    risk_id: int


# =====================================================
# ACTIONS
# =====================================================
def resolve_available_actions(file: EvidenceFile, user) -> list[str]:
    actions: list[str] = []
    roles = set(getattr(user, "roles", []))

    if file.status == "uploaded":
        if "user" in roles or "admin" in roles:
            actions.append("submit")

    if file.status == "waiting_approval":
        if "auditor" in roles or "admin" in roles:
            actions.extend(["approve", "reject"])

    if file.status == "rejected":
        if "admin" in roles:
            actions.append("rollback")

    if file.status in ["uploaded", "rejected"] and "admin" in roles:
        actions.append("delete")

    return actions


# =====================================================
# COVERAGE
# =====================================================
def calculate_coverage_status(
    db: Session,
    evidence_id: int,
) -> str:
    files = (
        db.query(EvidenceFile.status)
        .filter(EvidenceFile.evidence_id == evidence_id)
        .all()
    )

    if not files:
        return "not_achieved"

    statuses = [f.status.lower().strip() for f in files]

    # 🔒 KİLİT KURAL: rejected varsa achieved OLAMAZ
    if "rejected" in statuses:
        return "partially_achieved"

    # 🔒 tümü approved ise
    if all(s == "approved" for s in statuses):
        return "achieved"

    # 🔒 1'den fazla dosya ve en az biri approved değilse
    if len(statuses) > 1 and any(s != "approved" for s in statuses):
        return "partially_achieved"

    return "not_achieved"

# =====================================================
# DERIVED EVIDENCE STATUS (FROM FILES)
# =====================================================
def calculate_evidence_status(
    db: Session,
    evidence_id: int,
    fallback: str,
) -> str:
    files = (
        db.query(EvidenceFile.status)
        .filter(EvidenceFile.evidence_id == evidence_id)
        .all()
    )

    if not files:
        return fallback

    statuses = [f.status.lower().strip() for f in files]

    if "rejected" in statuses:
        return "rejected"

    if all(s == "approved" for s in statuses):
        return "approved"

    if "waiting_approval" in statuses:
        return "waiting_approval"

    return "uploaded"


# =====================================================
# EVIDENCE DETAIL
# =====================================================
@router.get("/{evidence_id}/detail")
def get_evidence_detail(
    evidence_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    risks = (
        db.query(Risk)
        .join(RiskEvidenceLink, Risk.id == RiskEvidenceLink.risk_id)
        .filter(RiskEvidenceLink.evidence_id == evidence_id)
        .all()
    )

    # 🔍 DEBUG – GERÇEK DURUMU GÖRELİM
    print(
        f"[EVIDENCE DETAIL] evidence_id={evidence_id} "
        f"linked_risks={[r.id for r in risks]}"
    )

    return {
        "evidence": {
            "id": evidence.id,
            "title": evidence.title,
            "description": evidence.description,
            "status": evidence.status,
            "control_id": evidence.control_id,
            "requirement_id": evidence.requirement_id,
        },
        "risks": [
            {
                "id": r.id,
                "title": r.title,
                "score": r.score,
                "risk_level": r.risk_level,
            }
            for r in risks
        ],
    }
# =====================================================
# GET EVIDENCE FILES
# =====================================================
@router.get("/{evidence_id}/files")
def get_evidence_files(
    evidence_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    files = (
        db.query(EvidenceFile)
        .filter(EvidenceFile.evidence_id == evidence_id)
        .order_by(EvidenceFile.version.desc())
        .all()
    )

    return [
        {
            "id": f.id,
            "file_name": f.file_name,
            "version": f.version,
            "status": f.status,
            "uploaded_at": f.uploaded_at,
            "mime_type": f.mime_type,
            "file_size": f.file_size,
            "available_actions": resolve_available_actions(f, user),
        }
        for f in files
    ]


# =====================================================
# UPLOAD FILES
# =====================================================
@router.post("/{evidence_id}/files")
def upload_evidence_files(
    evidence_id: int,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    base_path = f"uploads/evidences/{evidence_id}"
    os.makedirs(base_path, exist_ok=True)

    current_version = (
        db.query(func.max(EvidenceFile.version))
        .filter(EvidenceFile.evidence_id == evidence_id)
        .scalar()
        or 0
    )

    for file in files:
        ext = os.path.splitext(file.filename)[1]
        file_uuid = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(base_path, file_uuid)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        ef = EvidenceFile(
            evidence_id=evidence_id,
            version=current_version + 1,
            uploaded_by=user.id,
            uploaded_at=datetime.utcnow(),
            file_name=file.filename,
            file_path=file_path,
            mime_type=file.content_type,
            file_size=os.path.getsize(file_path),
            status="uploaded",
        )

        current_version += 1
        db.add(ef)

    db.commit()
    return {"success": True}


# =====================================================
# FILE LIFECYCLE
# =====================================================
@router.post("/files/{file_id}/submit")
def submit_file(
    file_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    f = db.query(EvidenceFile).filter(EvidenceFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")

    f.status = "waiting_approval"
    f.submitted_by = user.id
    f.submitted_at = datetime.utcnow()
    db.commit()
    return {"success": True}


@router.post("/files/{file_id}/approve")
def approve_file(
    file_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    f = db.query(EvidenceFile).filter(EvidenceFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")

    f.status = "approved"
    f.approved_by = user.id
    f.approved_at = datetime.utcnow()
    db.commit()
    return {"success": True}


@router.post("/files/{file_id}/reject")
def reject_file(
    file_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    f = db.query(EvidenceFile).filter(EvidenceFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")

    f.status = "rejected"
    db.commit()
    return {"success": True}


@router.post("/files/{file_id}/rollback")
def rollback_file(
    file_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    f = db.query(EvidenceFile).filter(EvidenceFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")

    f.status = "uploaded"
    db.commit()
    return {"success": True}


# =====================================================
# EVIDENCE LIST (PAGINATED)
# =====================================================
@router.get("")
def evidences_paged(
    page: int = 1,
    page_size: int = 10,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    offset = (page - 1) * page_size

    file_count_sq = (
        select(func.count(EvidenceFile.id))
        .where(EvidenceFile.evidence_id == Evidence.id)
        .correlate(Evidence)
        .scalar_subquery()
    )

    risk_count_sq = (
        select(func.count(RiskEvidenceLink.risk_id))
        .where(RiskEvidenceLink.evidence_id == Evidence.id)
        .correlate(Evidence)
        .scalar_subquery()
    )

    rows = (
        db.query(
            Evidence.id.label("evidence_id"),
            Evidence.title.label("evidence_title"),
            Evidence.status.label("evidence_status"),
            file_count_sq.label("files_count"),
            risk_count_sq.label("related_risks_count"),
            Control.code.label("control_code"),
            Control.title.label("control_title"),
            Requirement.code.label("requirement_code"),
            Requirement.title.label("requirement_title"),
            Standard.code.label("standard_code"),
            Standard.title.label("standard_title"),
        )
        .join(Control, Evidence.control_id == Control.id)
        .join(Requirement, Control.requirement_id == Requirement.id)
        .join(Clause, Requirement.clause_id == Clause.id)
        .join(Standard, Clause.standard_id == Standard.id)
        .order_by(Evidence.id.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    items = []

    for r in rows:
        related_risks_count = r.related_risks_count or 0

        coverage = calculate_coverage_status(
            db=db,
            evidence_id=r.evidence_id,
         )

        derived_status = calculate_evidence_status(
            db=db,
            evidence_id=r.evidence_id,
            fallback=r.evidence_status,
        )

        items.append(
            {
                "evidence_id": r.evidence_id,
                "evidence_title": r.evidence_title,
                "status": derived_status,
                "files_count": r.files_count or 0,
                "related_risks_count": related_risks_count,
                "coverage": coverage,
                "coverage_status": coverage,
                "standard": {
                    "code": r.standard_code,
                    "title": r.standard_title,
                },
                "requirement": {
                    "code": r.requirement_code,
                    "title": r.requirement_title,
                },
                "control": {
                    "code": r.control_code,
                    "title": r.control_title,
                },
            }
        )

    total = db.query(func.count(Evidence.id)).scalar()

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }
from fastapi import HTTPException

# =====================================================
# DELETE EVIDENCE (WITH BUSINESS VALIDATION)
# =====================================================
@router.delete("/{evidence_id}")
def delete_evidence(
    evidence_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    # 🔴 BUSINESS RULE:
    # Approved file varsa silinemez
    approved_file_exists = (
        db.query(EvidenceFile.id)
        .filter(
            EvidenceFile.evidence_id == evidence_id,
            EvidenceFile.status == "approved",
        )
        .first()
        is not None
    )

    if approved_file_exists:
        raise HTTPException(
            status_code=400,
            detail="This evidence cannot be deleted because it contains approved files.",
        )

    # Risk linklerini sil
    db.query(RiskEvidenceLink).filter(
        RiskEvidenceLink.evidence_id == evidence_id
    ).delete()

    # Dosyaları sil
    db.query(EvidenceFile).filter(
        EvidenceFile.evidence_id == evidence_id
    ).delete()

    # Evidence sil
    db.delete(evidence)
    db.commit()

    return {"deleted": evidence_id}
# -------------------------------------------------------
# GET EVIDENCE BY CONTROL
# -------------------------------------------------------

@router.get("/by-control/{control_id}")
def get_evidences_by_control(
    control_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    evidences = (
        db.query(Evidence)
        .filter(Evidence.control_id == control_id)
        .order_by(Evidence.id.desc())
        .all()
    )

    return [
        {
            "id": e.id,
            "title": e.title,
            "status": calculate_evidence_status(
                db=db,
                evidence_id=e.id,
                fallback=e.status,
            ),
            "coverage": calculate_coverage_status(
                db=db,
                evidence_id=e.id,
            ),
        }
        for e in evidences
    ]
# ------------------------------------------
# LINK EVIDENCE WITH CONTROL
# -------------------------------------------
class LinkEvidenceRequest(BaseModel):
    evidence_id: int


@router.post("/link-to-control/{control_id}")
def link_evidence_to_control(
    control_id: int,
    payload: LinkEvidenceRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    evidence = (
        db.query(Evidence)
        .filter(Evidence.id == payload.evidence_id)
        .first()
    )

    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    evidence.control_id = control_id
    db.commit()

    return {"linked": payload.evidence_id, "control_id": control_id}
# ------------------------------------------------------------------
# UNLINK EVIDENCE FROM CONTROL
# ------------------------------------------------------------------
@router.post("/unlink-from-control/{control_id}")
def unlink_evidence_from_control(
    control_id: int,
    payload: LinkEvidenceRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    evidence = (
        db.query(Evidence)
        .filter(
            Evidence.id == payload.evidence_id,
            Evidence.control_id == control_id,
        )
        .first()
    )

    if not evidence:
        raise HTTPException(
            status_code=404,
            detail="Evidence not linked to this control",
        )

    evidence.control_id = None
    db.commit()

    return {"unlinked": payload.evidence_id}

