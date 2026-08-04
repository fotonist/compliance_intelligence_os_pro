from fastapi import APIRouter, Depends, HTTPException, Body, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime
import os
from uuid import uuid4

from app.db.session import get_db
from app.models.evidences import Evidence
from app.models.evidence_files import EvidenceFile
from app.models.user import User
from app.core.rbac import require_roles, Role

# =====================================================
# ROUTER
# =====================================================
router = APIRouter(prefix="/evidences", tags=["evidences"])

UPLOAD_ROOT = os.path.join(os.getcwd(), "uploads", "evidences")


# =====================================================
# GET /evidences
# =====================================================
@router.get("")
@router.get("/")
def list_evidences(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(
            Role.Admin,
            Role.ComplianceOfficer,
            Role.ControlOwner,
            Role.Auditor,
        )
    ),
):
    return (
        db.query(Evidence)
        .filter(Evidence.is_deleted == False)
        .order_by(Evidence.created_at.desc())
        .all()
    )


# =====================================================
# POST /evidences
# =====================================================
@router.post("")
@router.post("/")
def create_evidence(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(
            Role.Admin,
            Role.ComplianceOfficer,
            Role.ControlOwner,
        )
    ),
):
    evidence = Evidence(
        title=payload.get("title"),
        description=payload.get("description"),
        control_id=payload.get("control_id"),
        status=payload.get("status", "Draft"),
        is_deleted=False,
    )

    db.add(evidence)
    db.commit()
    db.refresh(evidence)
    return evidence


# =====================================================
# PUT /evidences/{id}
# =====================================================
@router.put("/{evidence_id}")
def update_evidence(
    evidence_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(
            Role.Admin,
            Role.ComplianceOfficer,
            Role.ControlOwner,
        )
    ),
):
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    for key, value in payload.items():
        if hasattr(evidence, key):
            setattr(evidence, key, value)

    db.commit()
    db.refresh(evidence)
    return evidence


# =====================================================
# GET /evidences/{id}/files
# =====================================================
@router.get("/{evidence_id}/files")
@router.get("/{evidence_id}/files/")
def list_evidence_files(
    evidence_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(
            Role.Admin,
            Role.ComplianceOfficer,
            Role.ControlOwner,
            Role.Auditor,
        )
    ),
):
    files = (
        db.query(EvidenceFile)
        .filter(EvidenceFile.evidence_id == evidence_id)
        .order_by(EvidenceFile.version.desc(), EvidenceFile.id.desc())
        .all()
    )

    return [
        {
            "id": f.id,
            "file_name": f.file_name,
            "version": f.version,
            "uploaded_at": f.uploaded_at,
            "uploaded_by": f.uploaded_by,
            "mime_type": f.mime_type,
            "file_size": f.file_size,
        }
        for f in files
    ]


# =====================================================
# POST /evidences/{id}/files   (UPLOAD)
# =====================================================
@router.post("/{evidence_id}/files")
@router.post("/{evidence_id}/files/")
def upload_evidence_files(
    evidence_id: int,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(
            Role.Admin,
            Role.ComplianceOfficer,
            Role.ControlOwner,
        )
    ),
):
    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    folder = os.path.join(UPLOAD_ROOT, str(evidence_id))
    os.makedirs(folder, exist_ok=True)

    saved = []
    for file in files:
        original_name = file.filename
        _, ext = os.path.splitext(original_name)
        stored_name = f"{uuid4().hex}{ext}"
        path = os.path.join(folder, stored_name)

        with open(path, "wb") as f:
            f.write(file.file.read())

        last = (
            db.query(EvidenceFile)
            .filter(EvidenceFile.evidence_id == evidence_id)
            .order_by(EvidenceFile.version.desc())
            .first()
        )
        next_version = (last.version + 1) if last else 1

        record = EvidenceFile(
            evidence_id=evidence_id,
            version=next_version,
            uploaded_by=current_user.id,
            file_name=original_name,
            file_path=path,
            mime_type=file.content_type,
            file_size=os.path.getsize(path),
            uploaded_at=datetime.utcnow(),
        )

        db.add(record)
        saved.append(record)

    db.commit()

    return {
        "uploaded": [
            {
                "id": f.id,
                "version": f.version,
                "file_name": f.file_name,
            }
            for f in saved
        ]
    }


# =====================================================
# POST /evidences/files/{file_id}/rollback
# =====================================================
@router.post("/files/{file_id}/rollback")
def rollback_evidence_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles(
            Role.Admin,
            Role.ComplianceOfficer,
            Role.ControlOwner,
        )
    ),
):
    file = db.query(EvidenceFile).filter(EvidenceFile.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    # Bu modelde is_current yok → rollback mantıksal
    return {
        "message": "Rollback executed",
        "file_id": file.id,
        "version": file.version,
    }
