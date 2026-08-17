from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime
import os
import shutil
import uuid

from app.db.session import get_db
from app.models.evidence_files import EvidenceFile
from app.models.evidences import Evidence
from app.models.risk_evidence_link import RiskEvidenceLink
from app.core.security import get_current_user

router = APIRouter(prefix="/evidences", tags=["Evidence Files"])


# =====================================================
# GET FILES FOR EVIDENCE
# =====================================================
@router.get("/{evidence_id}/files")
def get_evidence_files(
    evidence_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return (
        db.query(EvidenceFile)
        .filter(EvidenceFile.evidence_id == evidence_id)
        .order_by(EvidenceFile.version.desc())
        .all()
    )


# =====================================================
# UPLOAD FILES
# =====================================================
@router.post("/{evidence_id}/files")
def upload_files(
    evidence_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    base_path = os.path.join("uploads", "evidences", str(evidence_id))
    os.makedirs(base_path, exist_ok=True)

    max_version = (
        db.query(EvidenceFile.version)
        .filter(EvidenceFile.evidence_id == evidence_id)
        .order_by(EvidenceFile.version.desc())
        .first()
    )
    current_version = max_version[0] if max_version else 0

    created_files = []

    for f in files:
        current_version += 1

        file_id = uuid.uuid4().hex
        ext = os.path.splitext(f.filename)[1]
        file_path = os.path.join(base_path, f"{file_id}{ext}")

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(f.file, buffer)

        ef = EvidenceFile(
            tenant_id=getattr(user, "tenant_id", None) or 1,
            evidence_id=evidence_id,
            version=current_version,
            uploaded_by=user.id,
            uploaded_at=datetime.utcnow(),
            file_name=f.filename,
            file_path=file_path,
            mime_type=f.content_type,
            file_size=os.path.getsize(file_path),
            status="uploaded",
        )

        db.add(ef)
        created_files.append(ef)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    return created_files


# =====================================================
# FILE ACTIONS
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
    f.rejected_by = user.id
    f.rejected_at = datetime.utcnow()
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
    f.approved_by = None
    f.approved_at = None
    f.submitted_by = None
    f.submitted_at = None
    db.commit()
    return {"success": True}


# =====================================================
# DELETE FILE
# =====================================================

def _delete_evidence_file(file_id: int, db: Session):
    file = db.query(EvidenceFile).filter(EvidenceFile.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Approved / waiting-approval files are part of the assurance trail.
    if file.status not in ["uploaded", "draft", "rejected"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete a file with status '{file.status}'",
        )

    evidence = db.query(Evidence).filter(Evidence.id == file.evidence_id).first()

    # Risk links belong to the evidence file. Remove them before deleting it.
    db.query(RiskEvidenceLink).filter(
        RiskEvidenceLink.evidence_file_id == file.id
    ).delete(synchronize_session=False)

    file_path = file.file_path
    evidence_id = file.evidence_id
    db.delete(file)

    # If this was the last file, return the parent evidence to draft/no-file state.
    remaining_files = (
        db.query(EvidenceFile.id)
        .filter(EvidenceFile.evidence_id == evidence_id)
        .filter(EvidenceFile.id != file.id)
        .first()
    )
    if evidence is not None and remaining_files is None:
        evidence.status = "draft"
        if hasattr(evidence, "approval_status"):
            evidence.approval_status = None

    db.commit()

    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except OSError:
            pass

    return {"success": True, "deleted_file_id": file_id}


@router.delete("/files/{file_id}")
def delete_evidence_file(
    file_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return _delete_evidence_file(file_id, db)


# Backward-compatible alias for the existing frontend contract.
@router.post("/files/{file_id}/delete")
def delete_evidence_file_legacy(
    file_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return _delete_evidence_file(file_id, db)