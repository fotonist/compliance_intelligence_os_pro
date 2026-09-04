from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timedelta
import os
import shutil
import uuid

from app.db.session import get_db
from app.models.evidence_files import EvidenceFile
from app.models.evidence_file_history import EvidenceFileHistory
from app.models.evidences import Evidence
from app.models.risk_evidence_link import RiskEvidenceLink
from app.models.compliance_tasks import ComplianceTask
from app.models.task_evidence_link import TaskEvidenceLink
from app.models.process import Process
from app.core.security import get_current_user
from app.core.config import settings

router = APIRouter(prefix="/evidences", tags=["Evidence Files"])

STAGING_ROOT = os.path.join("uploads", "evidences", "_staging")
ARCHIVE_ROOT = os.path.join("uploads", "evidences", "_archive")


def _standard_archive_dir(evidence: Evidence) -> str:
    standard = getattr(evidence, "standard", None)
    standard_version = getattr(evidence, "standard_version", None)
    if not standard or not standard_version:
        raise HTTPException(
            status_code=409,
            detail="Evidence is not linked to a standard version; it cannot enter the audit archive.",
        )

    standard_code = str(getattr(standard, "code", standard.id)).strip().replace("/", "_")
    version_code = str(getattr(standard_version, "version_code", standard_version.id)).strip().replace("/", "_")

    return os.path.join(
        ARCHIVE_ROOT,
        str(evidence.tenant_id),
        standard_code,
        version_code,
        "evidence",
        str(evidence.id),
    )


def _staging_dir(evidence: Evidence) -> str:
    return os.path.join(STAGING_ROOT, str(evidence.tenant_id), str(evidence.id))


@router.get("/review/queue")
def get_review_queue(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    sla_rows = db.execute(
        text("""
            SELECT
                id,
                evidence_id,
                version,
                status,
                uploaded_at,
                approved_at,
                file_name,
                file_size,
                tenant_id,
                review_due_at,
                review_status,
                review_days_remaining,
                is_overdue
            FROM analytics.v_evidence_files
            WHERE tenant_id = :tenant_id
              AND review_status IN ('PENDING', 'DUE_SOON', 'OVERDUE')
            ORDER BY
                CASE review_status
                    WHEN 'OVERDUE' THEN 1
                    WHEN 'DUE_SOON' THEN 2
                    WHEN 'PENDING' THEN 3
                    ELSE 4
                END,
                review_due_at ASC NULLS LAST,
                id ASC
        """),
        {"tenant_id": user.tenant_id},
    ).fetchall()

    if not sla_rows:
        return {
            "total": 0,
            "items": [],
        }

    evidence_ids = list({row.evidence_id for row in sla_rows})
    file_ids = [row.id for row in sla_rows]

    evidence_rows = (
        db.query(Evidence)
        .filter(
            Evidence.id.in_(evidence_ids),
            Evidence.tenant_id == user.tenant_id,
        )
        .all()
    )
    evidence_map = {e.id: e for e in evidence_rows}

    file_rows = (
        db.query(EvidenceFile)
        .filter(
            EvidenceFile.id.in_(file_ids),
            EvidenceFile.tenant_id == user.tenant_id,
        )
        .all()
    )
    file_map = {f.id: f for f in file_rows}

    task_rows = (
        db.query(ComplianceTask, Process, TaskEvidenceLink)
        .outerjoin(
            TaskEvidenceLink,
            TaskEvidenceLink.task_id == ComplianceTask.id,
        )
        .outerjoin(
            Process,
            Process.id == ComplianceTask.process_id,
        )
        .filter(
            TaskEvidenceLink.evidence_id.in_(evidence_ids),
            ComplianceTask.tenant_id == user.tenant_id,
        )
        .all()
    )

    task_map = {}

    for task, process, link in task_rows:
        task_map.setdefault(link.evidence_id, []).append(
            {
                "task_id": task.id,
                "task_title": task.title,
                "task_type": task.task_type,
                "process_id": process.id if process else None,
                "process_code": process.code if process else None,
                "process_name": process.name if process else None,
            }
        )

    items = []

    for row in sla_rows:
        evidence = evidence_map.get(row.evidence_id)
        file = file_map.get(row.id)

        if evidence is None or file is None:
            continue

        items.append(
            {
                "file_id": row.id,
                "evidence_id": row.evidence_id,
                "evidence_title": evidence.title,
                "file_name": row.file_name,
                "version": row.version,
                "submitted_by": file.submitted_by,
                "submitted_at": file.submitted_at,
                "status": row.status,
                "review_due_at": row.review_due_at,
                "review_status": row.review_status,
                "review_days_remaining": row.review_days_remaining,
                "is_overdue": row.is_overdue,
                "tasks": task_map.get(row.evidence_id, []),
            }
        )

    return {
        "total": len(items),
        "items": items,
    }


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

    if not files:
        raise HTTPException(status_code=400, detail="At least one file is required")

    base_path = _staging_dir(evidence)
    os.makedirs(base_path, exist_ok=True)

    max_version = (
        db.query(EvidenceFile.version)
        .filter(EvidenceFile.evidence_id == evidence_id)
        .order_by(EvidenceFile.version.desc())
        .first()
    )
    current_version = max_version[0] if max_version else 0
    created_files = []

    for uploaded in files:
        current_version += 1
        file_id = uuid.uuid4().hex
        ext = os.path.splitext(uploaded.filename or "")[1]
        file_path = os.path.join(base_path, f"{file_id}{ext}")

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(uploaded.file, buffer)

        ef = EvidenceFile(
            tenant_id=getattr(user, "tenant_id", None) or evidence.tenant_id,
            evidence_id=evidence_id,
            version=current_version,
            uploaded_by=user.id,
            uploaded_at=datetime.utcnow(),
            file_name=uploaded.filename or "unnamed-file",
            file_path=file_path,
            mime_type=uploaded.content_type,
            file_size=os.path.getsize(file_path),
            status="uploaded",
        )
        db.add(ef)
        created_files.append(ef)

    evidence.status = "uploaded"
    evidence.updated_at = datetime.utcnow()

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "evidence_id": evidence_id,
        "files": [
            {
                "id": f.id,
                "file_name": f.file_name,
                "version": f.version,
                "status": f.status,
            }
            for f in created_files
        ],
        "storage_state": "staging",
    }


@router.post("/files/{file_id}/submit")
def submit_file(
    file_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    f = db.query(EvidenceFile).filter(EvidenceFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    if f.status not in ["uploaded", "rejected"]:
        raise HTTPException(status_code=409, detail=f"File cannot be submitted from status '{f.status}'")

    old_status = f.status

    submitted_at = datetime.utcnow()

    f.status = "waiting_approval"
    f.submitted_by = user.id
    f.submitted_at = submitted_at
    f.review_due_at = submitted_at + timedelta(days=settings.EVIDENCE_REVIEW_SLA_DAYS)

    db.add(
        EvidenceFileHistory(
            evidence_file_id=f.id,
            action="SUBMIT_REVIEW",
            old_status=old_status,
            new_status=f.status,
            performed_by=user.id,
        )
    )

    db.commit()

    return {"success": True, "status": f.status}


@router.post("/files/{file_id}/approve")
def approve_file(
    file_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    f = db.query(EvidenceFile).filter(EvidenceFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    if f.status != "waiting_approval":
        raise HTTPException(status_code=409, detail="Only files waiting for approval can be approved")
    if f.submitted_by and f.submitted_by == user.id:
        raise HTTPException(status_code=403, detail="The submitter cannot approve the same evidence file")

    evidence = db.query(Evidence).filter(Evidence.id == f.evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    archive_root = _standard_archive_dir(evidence)
    archive_version_dir = os.path.join(archive_root, f"v{f.version}")
    os.makedirs(archive_version_dir, exist_ok=True)

    source_path = f.file_path
    if not source_path or not os.path.exists(source_path):
        raise HTTPException(status_code=404, detail="Staged evidence file is missing")

    archive_path = os.path.join(
        archive_version_dir,
        os.path.basename(source_path),
    )
    shutil.move(source_path, archive_path)

    old_status = f.status

    f.file_path = archive_path
    f.archive_path = archive_path
    f.archived_at = datetime.utcnow()

    f.status = "approved"
    f.approved_by = user.id
    f.approved_at = datetime.utcnow()

    evidence.updated_at = datetime.utcnow()

    db.add(
        EvidenceFileHistory(
            evidence_file_id=f.id,
            action="APPROVE",
            old_status=old_status,
            new_status=f.status,
            performed_by=user.id,
        )
    )

    db.commit()

    return {
        "success": True,
        "status": f.status,
        "archive_path": archive_path,
        "version": f.version,
    }


@router.post("/files/{file_id}/reject")
def reject_file(
    file_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    f = db.query(EvidenceFile).filter(EvidenceFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    if f.status != "waiting_approval":
        raise HTTPException(status_code=409, detail="Only files waiting for approval can be rejected")

    if f.submitted_by and f.submitted_by == user.id:
        raise HTTPException(
            status_code=403,
            detail="The submitter cannot reject the same evidence file",
        )

    old_status = f.status

    f.status = "rejected"
    f.rejected_by = user.id
    f.rejected_at = datetime.utcnow()

    db.add(
        EvidenceFileHistory(
            evidence_file_id=f.id,
            action="REJECT",
            old_status=old_status,
            new_status=f.status,
            performed_by=user.id,
        )
    )

    db.commit()

    return {"success": True, "status": f.status}


@router.post("/files/{file_id}/rollback")
def rollback_file(
    file_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    f = db.query(EvidenceFile).filter(EvidenceFile.id == file_id).first()
    if not f:
        raise HTTPException(status_code=404, detail="File not found")

    if f.status == "approved":
        raise HTTPException(status_code=409, detail="Approved evidence versions are immutable; upload a new version instead")

    old_status = f.status

    f.status = "uploaded"
    f.approved_by = None
    f.approved_at = None
    f.submitted_by = None
    f.submitted_at = None

    db.add(
        EvidenceFileHistory(
            evidence_file_id=f.id,
            action="ROLLBACK",
            old_status=old_status,
            new_status=f.status,
            performed_by=user.id,
        )
    )

    db.commit()

    return {"success": True, "status": f.status}


def _delete_evidence_file(file_id: int, db: Session):
    file = db.query(EvidenceFile).filter(EvidenceFile.id == file_id).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")

    if file.status not in ["uploaded", "draft", "rejected"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete a file with status '{file.status}'",
        )

    evidence = db.query(Evidence).filter(Evidence.id == file.evidence_id).first()
    db.query(RiskEvidenceLink).filter(
        RiskEvidenceLink.evidence_file_id == file.id
    ).delete(synchronize_session=False)

    file_path = file.file_path
    evidence_id = file.evidence_id
    db.delete(file)

    remaining_files = (
        db.query(EvidenceFile.id)
        .filter(EvidenceFile.evidence_id == evidence_id)
        .filter(EvidenceFile.id != file.id)
        .first()
    )
    if evidence is not None and remaining_files is None:
        evidence.status = "draft"

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


@router.post("/files/{file_id}/delete")
def delete_evidence_file_legacy(
    file_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return _delete_evidence_file(file_id, db)









@router.get("/files/{file_id}/history")
def get_file_history(
    file_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    file = (
        db.query(EvidenceFile)
        .filter(EvidenceFile.id == file_id)
        .first()
    )

    if not file:
        raise HTTPException(
            status_code=404,
            detail="File not found"
        )

    history = (
        db.query(EvidenceFileHistory)
        .filter(
            EvidenceFileHistory.evidence_file_id == file_id
        )
        .order_by(
            EvidenceFileHistory.created_at.desc()
        )
        .all()
    )

    return [
        {
            "id": h.id,
            "action": h.action,
            "old_status": h.old_status,
            "new_status": h.new_status,
            "comment": h.comment,
            "performed_by": h.performed_by,
            "created_at": h.created_at,
        }
        for h in history
    ]
