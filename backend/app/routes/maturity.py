from datetime import datetime
import os
import uuid

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.core.security import get_current_user

from app.models.standards import Standard
from app.models.standard_process_area import StandardProcessArea
from app.models.standard_practice import StandardPractice
from app.models.standard_capability_level import StandardCapabilityLevel

from app.models.maturity_assessment_session import MaturityAssessmentSession
from app.models.maturity_practice_evaluation import MaturityPracticeEvaluation
from app.models.maturity_evidence import MaturityEvidence
from app.models.maturity_evidence_file import MaturityEvidenceFile
from app.models.maturity_workspace_sessions import MaturityWorkspaceSession
from app.schemas.maturity_evidence import MaturityEvidenceCreate



router = APIRouter(prefix="/maturity", tags=["Maturity"])


# =========================================================
# REQUEST MODELS
# =========================================================

class CreateWorkspaceSessionRequest(BaseModel):
    standard_id: int
    process_area_id: int | None = None
    name: str
    scope: str | None = None


# =========================================================
# STANDARD STRUCTURE
# =========================================================


# F03_MATURITY_SECURITY_HELPERS

def _get_tenant_workspace_session_or_404(
    db: Session,
    session_id: int,
    tenant_id: int,
):
    session = (
        db.query(MaturityWorkspaceSession)
        .filter(
            MaturityWorkspaceSession.id == session_id,
            MaturityWorkspaceSession.tenant_id == tenant_id,
        )
        .first()
    )

    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Maturity workspace session not found",
        )

    return session


def _get_tenant_maturity_evaluation_or_404(
    db: Session,
    evaluation_id: int,
    tenant_id: int,
):
    row = (
        db.query(
            MaturityPracticeEvaluation,
            MaturityWorkspaceSession,
        )
        .join(
            MaturityWorkspaceSession,
            MaturityWorkspaceSession.id
            == MaturityPracticeEvaluation.session_id,
        )
        .filter(
            MaturityPracticeEvaluation.id == evaluation_id,
            MaturityWorkspaceSession.tenant_id == tenant_id,
        )
        .first()
    )

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Practice evaluation not found",
        )

    return row[0], row[1]


def _get_tenant_maturity_evidence_or_404(
    db: Session,
    evidence_id: int,
    tenant_id: int,
):
    row = (
        db.query(
            MaturityEvidence,
            MaturityWorkspaceSession,
        )
        .join(
            MaturityPracticeEvaluation,
            MaturityPracticeEvaluation.id
            == MaturityEvidence.evaluation_id,
        )
        .join(
            MaturityWorkspaceSession,
            MaturityWorkspaceSession.id
            == MaturityPracticeEvaluation.session_id,
        )
        .filter(
            MaturityEvidence.id == evidence_id,
            MaturityWorkspaceSession.tenant_id == tenant_id,
            MaturityEvidence.session_id
            == MaturityWorkspaceSession.id,
        )
        .first()
    )

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Maturity evidence not found",
        )

    return row[0], row[1]


def _get_tenant_maturity_file_or_404(
    db: Session,
    evidence_id: int,
    file_id: int,
    tenant_id: int,
):
    row = (
        db.query(
            MaturityEvidenceFile,
            MaturityEvidence,
            MaturityWorkspaceSession,
        )
        .join(
            MaturityEvidence,
            MaturityEvidence.id
            == MaturityEvidenceFile.evidence_id,
        )
        .join(
            MaturityPracticeEvaluation,
            MaturityPracticeEvaluation.id
            == MaturityEvidence.evaluation_id,
        )
        .join(
            MaturityWorkspaceSession,
            MaturityWorkspaceSession.id
            == MaturityPracticeEvaluation.session_id,
        )
        .filter(
            MaturityEvidenceFile.id == file_id,
            MaturityEvidenceFile.evidence_id == evidence_id,
            MaturityWorkspaceSession.tenant_id == tenant_id,
            MaturityEvidence.session_id
            == MaturityWorkspaceSession.id,
        )
        .first()
    )

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Maturity evidence file not found",
        )

    return row[0], row[1], row[2]


@router.post("/standards/{standard_id}/process-areas")
def create_process_area(standard_id: int, payload: dict, db: Session = Depends(get_db)):
    standard = db.get(Standard, standard_id)
    if not standard or standard.type != "MATURITY_BASED":
        raise HTTPException(status_code=404, detail="Maturity standard not found")

    area = StandardProcessArea(
        standard_id=standard_id,
        code=payload.get("code"),
        name=payload["name"],
        description=payload.get("description"),
        sort_order=payload.get("sort_order", 0),
    )
    db.add(area)
    db.commit()
    db.refresh(area)
    return area


@router.post("/standards/{standard_id}/practices")
def create_practice(standard_id: int, payload: dict, db: Session = Depends(get_db)):
    practice = StandardPractice(
        standard_id=standard_id,
        process_area_id=payload["process_area_id"],
        level=payload["level"],
        code=payload.get("code"),
        title=payload.get("title"),
        text=payload["text"],
        guidance=payload.get("guidance"),
        sort_order=payload.get("sort_order", 0),
    )
    db.add(practice)
    db.commit()
    db.refresh(practice)
    return practice


@router.post("/standards/{standard_id}/capability-levels")
def create_capability_level(standard_id: int, payload: dict, db: Session = Depends(get_db)):
    level = StandardCapabilityLevel(
        standard_id=standard_id,
        level=payload["level"],
        name=payload["name"],
        description=payload.get("description"),
    )
    db.add(level)
    db.commit()
    db.refresh(level)
    return level


# =========================================================
# ASSESSMENT SESSIONS
# =========================================================

@router.post("/sessions")
def create_session(payload: dict, db: Session = Depends(get_db)):
    session = MaturityAssessmentSession(
        name=payload["name"],
        scope=payload.get("scope"),
        standard_id=payload["standard_id"],
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/sessions")
def list_sessions(db: Session = Depends(get_db)):
    return db.query(MaturityAssessmentSession).order_by(
        MaturityAssessmentSession.id.desc()
    ).all()


# =========================================================
# WORKSPACE PRACTICES
# =========================================================

@router.get("/workspace/{session_id}/practices")
def get_workspace_practices(
    session_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    rows = (
        db.query(MaturityPracticeEvaluation)
        .join(StandardPractice)
        .join(StandardProcessArea)
        .filter(MaturityPracticeEvaluation.session_id == session_id)
        .order_by(StandardProcessArea.sort_order, StandardPractice.code)
        .all()
    )

    result = []

    for r in rows:
        evidences = (
            db.query(
                MaturityEvidence.id,
                MaturityEvidence.title,
                MaturityEvidence.status,
                func.count(MaturityEvidenceFile.id).label("files_count"),
            )
            .outerjoin(
                MaturityEvidenceFile,
                MaturityEvidenceFile.evidence_id == MaturityEvidence.id,
            )
            .filter(MaturityEvidence.practice_id == r.practice_id)
            .group_by(MaturityEvidence.id)
            .all()
        )

        result.append(
            {
                "id": r.id,
                "process_area_id": r.practice.process_area_id,
                "process_area_name": r.practice.process_area.name,
                "practice_code": r.practice.code,
                "practice_title": r.practice.title,
                "evidences": [
                    {
                        "id": e.id,
                        "title": e.title,
                        "status": e.status,
                        "files_count": e.files_count,
                    }
                    for e in evidences
                ],
            }
        )

    return result


# =========================================================
# MATURITY EVIDENCE
# =========================================================

@router.post("/evidences")
def create_maturity_evidence(
    payload: MaturityEvidenceCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    evaluation, workspace = (
        _get_tenant_maturity_evaluation_or_404(
            db,
            payload.practice_evaluation_id,
            user.tenant_id,
        )
    )

    now = datetime.utcnow()

    evidence = MaturityEvidence(
        session_id=workspace.id,
        evaluation_id=evaluation.id,
        practice_id=evaluation.practice_id,
        evidence_type="maturity",
        title=payload.title,
        description=payload.description,
        status="draft",
        created_at=now,
        updated_at=now,
    )

    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    return {"id": evidence.id}


@router.get("/evidences/{evidence_id}/files")
def list_maturity_evidence_files(
    evidence_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    evidence, workspace = (
        _get_tenant_maturity_evidence_or_404(
            db,
            evidence_id,
            user.tenant_id,
        )
    )

    files = (
        db.query(MaturityEvidenceFile)
        .filter(
            MaturityEvidenceFile.evidence_id
            == evidence.id,
        )
        .order_by(
            MaturityEvidenceFile.uploaded_at.desc()
        )
        .all()
    )

    return [
        {
            "id": item.id,
            "file_name": item.file_name,
            "uploaded_at": item.uploaded_at,
            "download_url": (
                f"/maturity/evidences/"
                f"{evidence.id}/files/"
                f"{item.id}/download"
            ),
        }
        for item in files
    ]


@router.post("/evidences/{evidence_id}/files")
def upload_maturity_evidence_file(
    evidence_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    evidence, workspace = (
        _get_tenant_maturity_evidence_or_404(
            db,
            evidence_id,
            user.tenant_id,
        )
    )

    directory = maturity_staging_directory(
        tenant_id=user.tenant_id,
        session_id=workspace.id,
        evidence_id=evidence.id,
    )

    original_name = (
        file.filename
        or "evidence.bin"
    )

    ext = Path(
        original_name
    ).suffix

    stored_name = (
        f"{uuid.uuid4()}{ext}"
    )

    physical_path = (
        directory
        / stored_name
    )

    file_bytes = file.file.read()

    with physical_path.open("wb") as handle:
        handle.write(file_bytes)

    stored_path = to_backend_relative(
        physical_path
    )

    ef = MaturityEvidenceFile(
        evidence_id=evidence.id,
        file_name=original_name,
        file_path=stored_path,
        mime_type=file.content_type,
        file_size=len(file_bytes),
        uploaded_by=user.id,
        uploaded_at=datetime.utcnow(),
    )

    db.add(ef)

    evidence.status = "uploaded"
    evidence.updated_at = datetime.utcnow()

    try:
        db.commit()
        db.refresh(ef)
    except Exception:
        db.rollback()

        try:
            physical_path.unlink(
                missing_ok=True
            )
        except Exception:
            pass

        raise

    return {
        "ok": True,
        "file_id": ef.id,
    }


# =========================================================
# 🔥 DELETE EVIDENCE FILE (ADMIN ONLY)
# =========================================================

@router.delete("/evidences/{evidence_id}/files/{file_id}")
def delete_maturity_evidence_file(
    evidence_id: int,
    file_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if "admin" not in user.roles:
        raise HTTPException(
            status_code=403,
            detail="Admin only",
        )

    file_row, evidence, workspace = (
        _get_tenant_maturity_file_or_404(
            db,
            evidence_id,
            file_id,
            user.tenant_id,
        )
    )

    physical_path = None

    try:
        physical_path = (
            resolve_maturity_file_path(
                file_row.file_path
            )
        )
    except ValueError:
        raise HTTPException(
            status_code=409,
            detail="Invalid evidence storage path",
        )

    db.delete(file_row)
    db.commit()

    try:
        if physical_path.is_file():
            physical_path.unlink()
    except Exception:
        pass

    return {"ok": True}


# =========================================================
# DELETE EVIDENCE (ADMIN ONLY)
# =========================================================

@router.delete("/evidences/{evidence_id}")
def delete_maturity_evidence(
    evidence_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    if "admin" not in user.roles:
        raise HTTPException(status_code=403, detail="Admin only")

    evidence = db.get(MaturityEvidence, evidence_id)
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    file_count = (
        db.query(MaturityEvidenceFile)
        .filter(MaturityEvidenceFile.evidence_id == evidence_id)
        .count()
    )

    if file_count > 0:
        raise HTTPException(
            status_code=409,
            detail="Cannot delete evidence with linked files",
        )

    db.delete(evidence)
    db.commit()
    return {"ok": True}
# =========================================================
# GET PRACTICES (FOR TASK CREATION)
# =========================================================

@router.get("/practices")
def list_practices(
    db: Session = Depends(get_db),
):

    practices = (
        db.query(StandardPractice)
        .order_by(StandardPractice.code)
        .all()
    )

    return [
        {
            "id": p.id,
            "name": f"{p.code} - {p.title}"
        }
        for p in practices
    ]
# =========================================================
# GET WORKSPACE SESSIONS
# =========================================================

from app.core.security import get_current_user
from app.models.user import User
from fastapi.responses import FileResponse
from app.core.evidence_storage import (
    MATURITY_EVIDENCE_ROOT,
    maturity_staging_directory,
    resolve_maturity_file_path,
    to_backend_relative,
)


@router.get("/workspace/sessions")
def list_workspace_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    sessions = (
        db.query(MaturityWorkspaceSession)
        .filter(
            MaturityWorkspaceSession.tenant_id
            == current_user.tenant_id
        )
        .order_by(
            MaturityWorkspaceSession.created_at.desc()
        )
        .all()
    )

    return [
        {
            "id": s.id,
            "standard_id": s.standard_id,
            "name": s.name,
            "scope": s.scope,
            "status": s.status,
            "created_at": s.created_at,
            "process_area_id": s.process_area_id,
        }
        for s in sessions
    ]
# =========================================================
# GET PRACTICE EVIDENCES
# =========================================================

@router.get("/practices/{practice_id}/evidences")
def get_practice_evidences(
    practice_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):

    evidences = (
        db.query(MaturityEvidence)
        .filter(
            MaturityEvidence.practice_id == practice_id
        )
        .order_by(
            MaturityEvidence.updated_at.desc()
        )
        .all()
    )

    result = []

    for e in evidences:

        files_count = (
            db.query(MaturityEvidenceFile)
            .filter(
                MaturityEvidenceFile.evidence_id == e.id
            )
            .count()
        )

        result.append(
            {
                "id": e.id,
                "title": e.title,
                "description": e.description,
                "status": e.status,
                "updated_at": e.updated_at,
                "files_count": files_count,
            }
        )

    return result



@router.get(
    "/evidences/{evidence_id}/files/{file_id}/download"
)
def download_maturity_evidence_file(
    evidence_id: int,
    file_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    file_row, evidence, workspace = (
        _get_tenant_maturity_file_or_404(
            db,
            evidence_id,
            file_id,
            user.tenant_id,
        )
    )

    try:
        physical_path = (
            resolve_maturity_file_path(
                file_row.file_path
            )
        )
    except ValueError:
        raise HTTPException(
            status_code=404,
            detail="Evidence file not found",
        )

    if not physical_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="Evidence file not found",
        )

    return FileResponse(
        path=str(physical_path),
        media_type=(
            file_row.mime_type
            or "application/octet-stream"
        ),
        filename=file_row.file_name,
    )
