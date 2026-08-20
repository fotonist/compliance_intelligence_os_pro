from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime
import os
import shutil
import uuid
import re

from app.db.session import get_db
from app.models.evidence_files import EvidenceFile
from app.models.evidences import Evidence
from app.models.risk_evidence_link import RiskEvidenceLink
from app.models.standards import Standard
from app.models.standard_versions import StandardVersion
from app.core.security import get_current_user

router = APIRouter(prefix="/evidences", tags=["Evidence Files"])


# =====================================================
# STORAGE POLICY
# =====================================================
# Files are NEVER placed directly into the audit-standard archive
# while they are being uploaded, reviewed, or awaiting approval.
#
# STAGING:
#   uploads/evidences/_staging/{tenant}/{evidence}/v{version}/file
#
# APPROVED ARCHIVE:
#   uploads/evidences/{tenant}/standards/{standard_code}/versions/{version_code}/evidence/{evidence_id}/v{version}/file
#
# Only an approved EvidenceFile is moved into the approved archive.
# Approved files are immutable; a new upload creates the next version.


def _safe_segment(value: str | None, fallback: str) -> str:
    value = (value or "").strip()
    value = re.sub(r"[^A-Za-z0-9._-]+", "_", value)
    return value or fallback


def _staging_dir(tenant_id: int, evidence_id: int, version: int) -> str:
    return os.path.join(
        "uploads",
        "evidences",
        "_staging",
        str(tenant_id),
        str(evidence_id),
        f"v{version}",
    )


def _approved_dir(evidence: Evidence, version: int) -> str:
    standard = evidence.standard
    standard_version = evidence.standard_version

    if standard is None or standard_version is None:
        raise HTTPException(
            status_code=409,
            detail="Evidence must reference a standard and standard version before approval.",
        )

    standard_code = _safe_segment(standard.code, f"standard-{standard.id}")
    version_code = _safe_segment(
        standard_version.version_code,
        f"version-{standard_version.id}",
    )

    return os.path.join(
        "uploads",
        "evidences",
        str(evidence.tenant_id),
        "standards",
        standard_code,
        "versions",
        version_code,
        "evidence",
        str(evidence.id),
        f"v{version}",
    )


def _move_to_approved_archive(evidence: Evidence, file: EvidenceFile) -> str:
    source = file.file_path
    if not source or not os.path.exists(source):
        raise HTTPException(
            status_code=409,
            detail="Evidence file content is missing from staging storage.",
        )

    target_dir = _approved_dir(evidence, file.version)
    os.makedirs(target_dir, exist_ok=True)

    target_path = os.path.join(
        target_dir,
        f"{uuid.uuid4().hex}_{_safe_segment(file.file_name, 'evidence-file')}",
    )

    shutil.move(source, target_path)
    return target_path


# =====================================================
# GET FILES FOR EVIDENCE
# =====================================================
@router.get("/{evidence_id}/files")
def get_evidence_files(
    evidence_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    evidence = (
        db.query(Evidence)
        .filter(
            Evidence.id == evidence_id,
            Evidence.tenant_id == getattr(user, "tenant_id", None),
            Evidence.is_deleted.is_(False),
        )
        .first()
    )
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    return (
        db.query(EvidenceFile)
        .filter(
            EvidenceFile.evidence_id == evidence_id,
            EvidenceFile.tenant_id == evidence.tenant_id,
        )
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
    tenant_id = getattr(user, "tenant_id", None)
    evidence = (
        db.query(Evidence)
        .filter(
            Evidence.id == evidence_id,
            Evidence.tenant_id == tenant_id,
            Evidence.is_deleted.is_(False),
        )
        .first()
    )
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    if not evidence.standard_id or not evidence.standard_version_id:
        raise HTTPException(
            status_code=409,
            detail="Evidence must be linked to a standard and audit standard version before files can be uploaded.",
        )

    max_version = (
        db.query(EvidenceFile.version)
        .filter(
            EvidenceFile.evidence_id == evidence_id,
            EvidenceFile.tenant_id == tenant_id,
        )
        .order_by(EvidenceFile.version.desc())
        .first()
    )
    current_version = max_version[0] if max_version else 0

    created_files = []

    try:
        for f in files:
            current_version += 1

            staging_dir = _staging_dir(tenant_id, evidence_id, current_version)
            os.makedirs(staging_dir, exist_ok=True)

            file_id = uuid.uuid4().hex
            ext = os.path.splitext(f.filename or "")[1]
            file_path = os.path.join(staging_dir, f"{file_id}{ext}")

            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(f.file, buffer)

            ef = EvidenceFile(
                tenant_id=tenant_id,
                evidence_id=evidence_id,
                version=current_version,
                uploaded_by=user.id,
                uploaded_at=datetime.utcnow(),
                file_name=f.filename or "evidence-file",
                file_path=file_path,
                mime_type=f.content_type,
                file_size=os.path.getsize(file_path),
                status="uploaded",
            )

            db.add(ef)
            created_files.append(ef)

        evidence.status = "Uploaded"
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
    tenant_id = getattr(user, "tenant_id", None)
    f = (
        db.query(EvidenceFile)
        .filter(EvidenceFile.id == file_id, EvidenceFile.tenant_id == tenant_id)
        .first()
    )
    if not f:
        raise HTTPException(status_code=404, detail="File not found")

    if f.status not in ["uploaded", "rejected", "draft"]:
        raise HTTPException(
            status_code=409,
            detail=f"File cannot be submitted from status '{f.status}'.",
        )

    f.status = "waiting_approval"
    f.submitted_by = user.id
    f.submitted_at = datetime.utcnow()

    evidence = db.query(Evidence).filter(Evidence.id == f.evidence_id).first()
    if evidence:
        evidence.status = "PendingReview"

    db.commit()
    return {"success": True, "status": f.status, "version": f.version}


@router.post("/files/{file_id}/approve")
def approve_file(
    file_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)
    f = (
        db.query(EvidenceFile)
        .filter(EvidenceFile.id == file_id, EvidenceFile.tenant_id == tenant_id)
        .first()
    )
    if not f:
        raise HTTPException(status_code=404, detail="File not found")

    if f.status != "waiting_approval":
        raise HTTPException(
            status_code=409,
            detail="Only a file waiting for approval can be approved.",
        )

    if f.submitted_by == user.id:
        raise HTTPException(
            status_code=403,
            detail="Four-eyes approval required: the uploader cannot approve the same submission.",
        )

    evidence = (
        db.query(Evidence)
        .filter(
            Evidence.id == f.evidence_id,
            Evidence.tenant_id == tenant_id,
            Evidence.is_deleted.is_(False),
        )
        .first()
    )
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    # The physical move into the audit-standard/version archive happens ONLY here.
    archived_path = _move_to_approved_archive(evidence, f)

    f.file_path = archived_path
    f.status = "approved"
    f.approved_by = user.id
    f.approved_at = datetime.utcnow()

    evidence.status = "Approved"
    evidence.reviewed_by = user.id
    evidence.reviewed_at = datetime.utcnow()

    db.commit()
    return {
        "success": True,
        "status": f.status,
        "version": f.version,
        "archive_path": f.file_path,
    }


@router.post("/files/{file_id}/reject")
def reject_file(
    file_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)
    f = (
        db.query(EvidenceFile)
        .filter(EvidenceFile.id == file_id, EvidenceFile.tenant_id == tenant_id)
        .first()
    )
    if not f:
        raise HTTPException(status_code=404, detail="File not found")

    if f.status != "waiting_approval":
        raise HTTPException(
            status_code=409,
            detail="Only a file waiting for approval can be rejected.",
        )

    f.status = "rejected"
    f.approved_by = None
    f.approved_at = None
    f.rejected_at = datetime.utcnow()

    evidence = db.query(Evidence).filter(Evidence.id == f.evidence_id).first()
    if evidence:
        evidence.status = "Rejected"
        evidence.reviewed_by = user.id
        evidence.reviewed_at = datetime.utcnow()

    db.commit()
    return {"success": True, "status": f.status, "version": f.version}


@router.post("/files/{file_id}/rollback")
def rollback_file(
    file_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = getattr(user, "tenant_id", None)
    f = (
        db.query(EvidenceFile)
        .filter(EvidenceFile.id == file_id, EvidenceFile.tenant_id == tenant_id)
        .first()
    )
    if not f:
        raise HTTPException(status_code=404, detail="File not found")

    # Approved versions are immutable assurance records. A new upload must be
    # created as the next version instead of mutating the approved file.
    if f.status == "approved":
        raise HTTPException(
            status_code=409,
            detail="Approved evidence versions are immutable. Upload a new version instead of rolling back the approved record.",
        )

    if f.status not in ["waiting_approval", "rejected"]:
        raise HTTPException(
            status_code=409,
            detail=f"File cannot be rolled back from status '{f.status}'.",
        )

    f.status = "uploaded"
    f.approved_by = None
    f.approved_at = None
    f.submitted_by = None
    f.submitted_at = None
    f.rejected_at = None

    evidence = db.query(Evidence).filter(Evidence.id == f.evidence_id).first()
    if evidence:
        evidence.status = "Uploaded"

    db.commit()
    return {"success": True, "status": f.status, "version": f.version}


# =====================================================
# DELETE FILE
# =====================================================
def _delete_evidence_file(file_id: int, db: Session, tenant_id: int):
    file = (
        db.query(EvidenceFile)
        .filter(EvidenceFile.id == file_id, EvidenceFile.tenant_id == tenant_id)
        .first()
    )
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Approved / waiting-approval files are part of the assurance trail.
    if file.status not in ["uploaded", "draft", "rejected"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete a file with status '{file.status}'",
        )

    evidence = (
        db.query(Evidence)
        .filter(Evidence.id == file.evidence_id, Evidence.tenant_id == tenant_id)
        .first()
    )

    db.query(RiskEvidenceLink).filter(
        RiskEvidenceLink.evidence_file_id == file.id
    ).delete(synchronize_session=False)

    file_path = file.file_path
    evidence_id = file.evidence_id
    db.delete(file)

    remaining_files = (
        db.query(EvidenceFile.id)
        .filter(
            EvidenceFile.evidence_id == evidence_id,
            EvidenceFile.tenant_id == tenant_id,
            EvidenceFile.id != file.id,
        )
        .first()
    )
    if evidence is not None and remaining_files is None:
        evidence.status = "Uploaded"

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
    return _delete_evidence_file(file_id, db, getattr(user, "tenant_id", None))


# Backward-compatible alias for the existing frontend contract.
@router.post("/files/{file_id}/delete")
def delete_evidence_file_legacy(
    file_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return _delete_evidence_file(file_id, db, getattr(user, "tenant_id", None))
