# C:\Projects\compliance_app\backend\app\routes\evidence.py

from typing import List
from datetime import datetime
import os
import shutil
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import or_, func, select, text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.evidences import Evidence
from app.models.evidence_files import EvidenceFile
from app.models.evidence_file_history import EvidenceFileHistory
from app.models.task_evidence_link import TaskEvidenceLink
from app.models.risk_evidence_link import RiskEvidenceLink
from app.models.risks import Risk
from app.models.risk_versions import RiskVersion
from app.models.controls import Control
from app.models.requirements import Requirement
from app.models.clauses import Clause
from app.models.standards import Standard

# Optional / guarded imports for maturity-side link routes
try:
    from app.models.maturity_practice_evaluations import MaturityPracticeEvaluation
except Exception:
    MaturityPracticeEvaluation = None

try:
    from app.models.practice_evidence_link import PracticeEvidenceLink
except Exception:
    PracticeEvidenceLink = None


router = APIRouter(
    prefix="/evidences",
    tags=["evidence"]
)


# =====================================================
# REQUEST SCHEMAS
# =====================================================
class RejectEvidenceRequest(BaseModel):
    reason: str | None = None

class LinkEvidenceRequest(BaseModel):
    evidence_id: int

class LinkRiskRequest(BaseModel):
    risk_ids: list[int]

class UnlinkRiskRequest(BaseModel):
    risk_id: int

# =====================================================
# HELPERS
# =====================================================
def _safe_tenant_id(user, evidence: Evidence | None = None) -> int:
    user_tenant = getattr(user, "tenant_id", None)
    evidence_tenant = getattr(evidence, "tenant_id", None) if evidence else None
    tenant_id = user_tenant or evidence_tenant or 1
    return tenant_id


def _evidence_file_ids(db: Session, evidence_id: int) -> list[int]:
    return [
        row[0]
        for row in db.query(EvidenceFile.id)
        .filter(EvidenceFile.evidence_id == evidence_id)
        .all()
    ]

def _linked_risk_ids(db: Session, evidence_id: int):
    return [
        r.risk_id
        for r in (
            db.query(Risk.id.label("risk_id"))
            .join(RiskVersion, Risk.id == RiskVersion.risk_id)
            .join(RiskEvidenceLink, RiskVersion.id == RiskEvidenceLink.risk_version_id)
            .join(EvidenceFile, EvidenceFile.id == RiskEvidenceLink.evidence_file_id)
            .filter(EvidenceFile.evidence_id == evidence_id)
            .group_by(Risk.id)
            .all()
        )
    ]

# =====================================================
# RISK QUERY FOR EVIDENCE
# =====================================================

def _risk_query_for_evidence(
    db: Session,
    evidence_id: int,
):
    return (
        db.query(
            Risk.id.label("risk_id"),
            Risk.title.label("risk_title"),
            Risk.score.label("score"),
            Risk.risk_level.label("risk_level"),
        )
        .join(RiskVersion, Risk.id == RiskVersion.risk_id)
        .join(RiskEvidenceLink, RiskVersion.id == RiskEvidenceLink.risk_version_id)
        .join(EvidenceFile, EvidenceFile.id == RiskEvidenceLink.evidence_file_id)
        .filter(EvidenceFile.evidence_id == evidence_id)
        .group_by(   # ğŸ”¥ DUPLICATE FIX
            Risk.id,
            Risk.title,
            Risk.score,
            Risk.risk_level,
        )
    )

# =====================================================
# CREATE EVIDENCE (CONTROL / MATURITY)
# =====================================================
def create_evidence(
    payload: dict,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    assessment_type = payload.get("assessment_type", "control")

    if assessment_type not in ["control", "maturity"]:
        raise HTTPException(
            status_code=400,
            detail="assessment_type must be 'control' or 'maturity'",
        )

    title = payload.get("title")
    if not title:
        raise HTTPException(status_code=400, detail="title is required")

    status = str(payload.get("status", "draft")).lower().strip()
    allowed_statuses = [
        "draft",
        "uploaded",
        "waiting_approval",
        "approved",
        "rejected",
    ]

    if status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"status must be one of {allowed_statuses}",
        )

    evidence = Evidence(
        tenant_id=_safe_tenant_id(user),
        title=title,
        description=payload.get("description"),
        assessment_type=assessment_type,
        status=status,
        is_deleted=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    if assessment_type == "control":
        control_id = payload.get("control_id")
        if not control_id:
            raise HTTPException(
                status_code=400,
                detail="control_id is required for control evidences",
            )

        control = db.query(Control).filter(Control.id == control_id).first()
        if not control:
            raise HTTPException(status_code=404, detail="Control not found")

        evidence.control_id = control_id

    if assessment_type == "maturity":
        standard_id = payload.get("standard_id")
        if not standard_id:
            raise HTTPException(
                status_code=400,
                detail="standard_id is required for maturity evidences",
            )
        evidence.standard_id = standard_id

    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    return {
        "id": evidence.id,
        "title": evidence.title,
        "assessment_type": evidence.assessment_type,
        "status": evidence.status,
        "control_id": evidence.control_id,
        "standard_id": evidence.standard_id,
    }


# =====================================================
# ALIAS: TRAILING SLASH SUPPORT
# =====================================================
@router.post("/")
def create_evidence_slash(
    payload: dict,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return create_evidence(payload, db, user)


# =====================================================
# CREATE + UPLOAD DIRECTLY FROM CONTROL
# =====================================================
@router.post("/controls/{control_id}/upload")
def upload_evidence_with_file(
    control_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    control = db.query(Control).filter(Control.id == control_id).first()
    if not control:
        raise HTTPException(status_code=404, detail="Control not found")

    tenant_id = _safe_tenant_id(user)

    evidence = Evidence(
        tenant_id=tenant_id,
        title=file.filename,
        assessment_type="control",
        status="uploaded",
        control_id=control_id,
        is_deleted=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    base_path = f"uploads/pending/{evidence.id}"
    os.makedirs(base_path, exist_ok=True)

    ext = os.path.splitext(file.filename)[1]
    file_uuid = f"{uuid.uuid4().hex}{ext}"
    file_path = f"{base_path}/{file_uuid}"

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    ef = EvidenceFile(
        tenant_id=tenant_id,
        evidence_id=evidence.id,
        version=1,
        uploaded_by=user.id,
        uploaded_at=datetime.utcnow(),
        file_name=file.filename,
        file_path=file_path,
        mime_type=file.content_type,
        file_size=os.path.getsize(file_path),
        status="uploaded",
    )

    db.add(ef)
    db.commit()

    return {
        "evidence_id": evidence.id,
        "control_id": control_id,
        "file_uploaded": True,
    }


# --------------------------------------------------
# EVIDENCE LINK (GUARDED â€“ FINAL)
# --------------------------------------------------
@router.post("/evaluations/{evaluation_id}/evidence")
def link_evidence_to_maturity_practice(
    evaluation_id: int,
    payload: dict,
    db: Session = Depends(get_db),
):
    if MaturityPracticeEvaluation is None or PracticeEvidenceLink is None:
        raise HTTPException(
            status_code=501,
            detail="Maturity evidence linking is not available in this environment",
        )

    evaluation = db.get(MaturityPracticeEvaluation, evaluation_id)
    if not evaluation:
        raise HTTPException(status_code=404, detail="Practice evaluation not found")

    evidence_id = payload.get("evidence_id")
    if not evidence_id:
        raise HTTPException(status_code=400, detail="evidence_id is required")

    evidence = db.get(Evidence, evidence_id)
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    if evidence.assessment_type != "maturity":
        raise HTTPException(
            status_code=400,
            detail="Only maturity evidences can be linked to maturity practices",
        )

    existing = (
        db.query(PracticeEvidenceLink)
        .filter(
            PracticeEvidenceLink.practice_evaluation_id == evaluation_id,
            PracticeEvidenceLink.evidence_id == evidence_id,
        )
        .first()
    )

    if existing:
        return existing

    link = PracticeEvidenceLink(
        practice_evaluation_id=evaluation_id,
        evidence_id=evidence_id,
    )

    db.add(link)
    db.commit()
    db.refresh(link)

    return link


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

    if "rejected" in statuses:
        return "partially_achieved"

    if all(s == "approved" for s in statuses):
        return "achieved"

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

    files = (
        db.query(EvidenceFile)
        .filter(EvidenceFile.evidence_id == evidence_id)
        .order_by(EvidenceFile.version.desc())
        .all()
    )

    risk_rows = _risk_query_for_evidence(db, evidence_id).all()

    return {
        "evidence": {
            "id": evidence.id,
            "title": evidence.title,
            "description": evidence.description,
            "status": calculate_evidence_status(
                db=db,
                evidence_id=evidence.id,
                fallback=evidence.status or "draft",
            ) if files else (evidence.status or "no_files"),
            "approval_status": getattr(evidence, "approval_status", None),
            "control_id": evidence.control_id,
            "requirement_id": evidence.requirement_id,
            "assessment_type": evidence.assessment_type,
            "created_at": getattr(evidence, "created_at", None),
        },
        "risks": [
            {
                "risk_id": r.risk_id,
                "risk_title": r.risk_title,
                "score": r.score,
                "risk_level": r.risk_level,
            }
            for r in risk_rows
        ],
        "files": [
            {
                "id": f.id,
                "file_name": f.file_name,
                "filename": f.file_name,
                "status": f.status,
                "version": f.version,
                "uploaded_at": f.uploaded_at,
            }
            for f in files
        ],
    }

# =====================================================
# PENDING EVIDENCES
# =====================================================
@router.get("/pending")
def get_pending_evidence(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    rows = (
        db.query(
            EvidenceFile.id.label("file_id"),
            EvidenceFile.evidence_id,
            EvidenceFile.file_name,
            EvidenceFile.uploaded_at,
            Evidence.title,

            Evidence.control_id,
            Control.code.label("control_code"),
            Control.title.label("control_title"),
        )
        .join(Evidence, Evidence.id == EvidenceFile.evidence_id)
        .outerjoin(Control, Control.id == Evidence.control_id)
        .filter(
            Evidence.approval_status == "PENDING_REVIEW",
            Evidence.is_deleted == False,
        )
        .order_by(EvidenceFile.uploaded_at.desc())
        .all()
    )

    return {
        "items": [
            {
                "file_id": r.file_id,
                "evidence_id": r.evidence_id,
                "title": r.title,
                "file_name": r.file_name,
                "uploaded_at": r.uploaded_at,
                "control": {
                    "id": r.control_id,
                    "code": r.control_code,
                    "title": r.control_title,
                } if r.control_id else None,
            }
            for r in rows
        ]
    }
# -------------------------------------------------------------------
# ORPHAN EVIDENCES (NO RISK LINK)
# -------------------------------------------------------------------
@router.get("/orphan")
def get_orphan_evidences(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    rows = db.execute(
        text(
            """
            SELECT
                e.id,
                e.title,
                e.status,
                e.control_id,
                e.created_at
            FROM evidences e
            LEFT JOIN evidence_files ef
                ON ef.evidence_id = e.id
            LEFT JOIN risk_evidence_link rel
                ON rel.evidence_file_id = ef.id
            WHERE rel.id IS NULL
              AND e.is_deleted = false
            ORDER BY e.created_at DESC
            """
        )
    ).mappings().all()

    return {
        "items": rows
    }


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
                fallback=e.status or "draft",
            ),
            "coverage": calculate_coverage_status(
                db=db,
                evidence_id=e.id,
            ),
        }
        for e in evidences
    ]


# =====================================================
# EVIDENCE DETAIL (ALIAS FOR UI)
# =====================================================
@router.get("/{evidence_id}")
def get_evidence_detail_alias(
    evidence_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return get_evidence_detail(evidence_id, db, user)


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
            "filename": f.file_name,
            "version": f.version,
            "status": f.status,
            "uploaded_at": f.uploaded_at,
            "mime_type": f.mime_type,
            "file_size": f.file_size,
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

    tenant_id = _safe_tenant_id(user, evidence)

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
        file_path = f"{base_path}/{file_uuid}"

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        ef = EvidenceFile(
            tenant_id=tenant_id,
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
        raise HTTPException(
            status_code=404,
            detail="File not found"
        )

    old_status = f.status

    f.status = "approved"
    f.approved_by = user.id
    f.approved_at = datetime.utcnow()

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

    return {"success": True}

@router.post("/files/{file_id}/reject")
def reject_file(
    file_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    f = db.query(EvidenceFile).filter(EvidenceFile.id == file_id).first()

    if not f:
        raise HTTPException(
            status_code=404,
            detail="File not found"
        )

    old_status = f.status

    f.status = "rejected"
    f.rejected_by = user.id if hasattr(f, "rejected_by") else None
    f.rejected_at = datetime.utcnow() if hasattr(f, "rejected_at") else None

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

    return {"success": True}

@router.post("/files/{file_id}/rollback")
def rollback_file(
    file_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    f = db.query(EvidenceFile).filter(EvidenceFile.id == file_id).first()

    if not f:
        raise HTTPException(
            status_code=404,
            detail="File not found"
        )

    old_status = f.status

    f.status = "uploaded"

    if hasattr(f, "approved_by"):
        f.approved_by = None

    if hasattr(f, "approved_at"):
        f.approved_at = None

    if hasattr(f, "submitted_by"):
        f.submitted_by = None

    if hasattr(f, "submitted_at"):
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

    return {"success": True}

# =====================================================
# EVIDENCE LIST (PAGINATED)
# =====================================================
@router.get("")
@router.get("/")
def evidences_paged(
    page: int = 1,
    page_size: int = 10,
    control_id: int | None = None,
    task_id: int | None = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    offset = (page - 1) * page_size

    base_filter = [
        Evidence.tenant_id == user.tenant_id,
        Evidence.is_deleted == False,
    ]

    if control_id is not None:
        base_filter.append(
            Evidence.control_id == control_id
        )

    if task_id is not None:
        task_evidence_ids = (
            db.query(TaskEvidenceLink.evidence_id)
            .filter(
                TaskEvidenceLink.task_id == task_id,
                TaskEvidenceLink.tenant_id == user.tenant_id,
            )
        )
        base_filter.append(
            Evidence.id.in_(task_evidence_ids)
        )
    page_ids_sq = (
        db.query(Evidence.id.label("evidence_id"))
        .filter(*base_filter)
        .order_by(Evidence.id.desc())
        .offset(offset)
        .limit(page_size)
        .subquery()
    )

    file_count_sq = (
        select(func.count(EvidenceFile.id))
        .where(EvidenceFile.evidence_id == Evidence.id)
        .correlate(Evidence)
        .scalar_subquery()
    )

    risk_count_sq = (
        select(func.count(func.distinct(RiskEvidenceLink.id)))
        .select_from(RiskEvidenceLink)
        .join(EvidenceFile, EvidenceFile.id == RiskEvidenceLink.evidence_file_id)
        .where(EvidenceFile.evidence_id == Evidence.id)
        .correlate(Evidence)
        .scalar_subquery()
    )

    rows = (
        db.query(
            Evidence.id.label("evidence_id"),
            Evidence.title.label("evidence_title"),
            Evidence.status.label("evidence_status"),
            Evidence.assessment_type.label("assessment_type"),
            Evidence.control_id.label("control_id"),
            Evidence.requirement_id.label("requirement_id"),
            Evidence.standard_id.label("standard_id"),
            file_count_sq.label("files_count"),
            risk_count_sq.label("related_risks_count"),
            Control.code.label("control_code"),
            Control.title.label("control_title"),
            Requirement.code.label("requirement_code"),
            Requirement.title.label("requirement_title"),
            Standard.code.label("standard_code"),
            Standard.title.label("standard_title"),
        )
        .join(page_ids_sq, page_ids_sq.c.evidence_id == Evidence.id)
        .outerjoin(Control, Evidence.control_id == Control.id)
        .outerjoin(Requirement, Control.requirement_id == Requirement.id)
        .outerjoin(Clause, Requirement.clause_id == Clause.id)
        .outerjoin(
            Standard,
            or_(
                Clause.standard_id == Standard.id,
                Evidence.standard_id == Standard.id,
            ),
        )
        .order_by(Evidence.id.desc())
        .all()
    )

    page_evidence_ids = [r.evidence_id for r in rows]

    task_links_by_evidence: dict[int, list[int]] = {}

    if page_evidence_ids:
        task_links = (
            db.query(
                TaskEvidenceLink.evidence_id,
                TaskEvidenceLink.task_id,
            )
            .filter(
                TaskEvidenceLink.tenant_id == user.tenant_id,
                TaskEvidenceLink.evidence_id.in_(page_evidence_ids),
            )
            .all()
        )

        for evidence_id, linked_task_id in task_links:
            task_links_by_evidence.setdefault(evidence_id, []).append(
                linked_task_id
            )
    seen: set[int] = set()
    items = []

    for r in rows:
        if r.evidence_id in seen:
            continue
        seen.add(r.evidence_id)

        coverage = calculate_coverage_status(db=db, evidence_id=r.evidence_id)
        derived_status = calculate_evidence_status(
            db=db,
            evidence_id=r.evidence_id,
            fallback=r.evidence_status or "draft",
        )

        items.append(
            {
                "id": r.evidence_id,
                "title": r.evidence_title,
                "control_id": r.control_id,
                "requirement_id": r.requirement_id,
                "standard_id": r.standard_id,
                "assessment_type": r.assessment_type,
                "evidence_id": r.evidence_id,
                "evidence_title": r.evidence_title,
                "status": derived_status,
                "files_count": r.files_count or 0,
                "related_risks_count": r.related_risks_count or 0,
                "task_ids": sorted(set(task_links_by_evidence.get(r.evidence_id, []))),
                "coverage": coverage,
                "coverage_status": coverage,
                "standard": {"code": r.standard_code, "title": r.standard_title},
                "requirement": {"code": r.requirement_code, "title": r.requirement_title},
                "control": {"code": r.control_code, "title": r.control_title},
            }
        )

    total = (
        db.query(func.count(Evidence.id))
        .filter(*base_filter)
        .scalar()
    )

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }




# ------------------------------------------
# LINK EVIDENCE WITH CONTROL
# -------------------------------------------
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

    control = db.query(Control).filter(Control.id == control_id).first()
    if not control:
        raise HTTPException(status_code=404, detail="Control not found")

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

    raise HTTPException(
        status_code=400,
        detail="Unlinking evidence from control is disabled because evidence must remain bound to a control",
    )


# =====================================================
# LINK RISK TO EVIDENCE
# =====================================================
def link_risk_to_evidence_direct(
    evidence_id: int,
    payload: LinkRiskRequest,
    db: Session,
    user,
):
    print("ğŸ”¥ LINK START", evidence_id, payload.risk_ids)

    evidence = db.query(Evidence).filter(Evidence.id == evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    file_ids = _evidence_file_ids(db, evidence_id)
    print("ğŸ”¥ FILE IDS:", file_ids)

    if not file_ids:
        raise HTTPException(status_code=400, detail="No files found for this evidence")

    linked = []

    for risk_id in payload.risk_ids:
        print("ğŸ‘‰ processing risk:", risk_id)

        rv = (
            db.query(RiskVersion)
            .filter(RiskVersion.risk_id == risk_id)
            .order_by(RiskVersion.id.desc())
            .first()
        )

        print("ğŸ‘‰ risk_version:", rv.id if rv else None)

        if not rv:
            continue

        inserted_for_this_risk = False

        for file_id in file_ids:
            exists = (
                db.query(RiskEvidenceLink)
                .filter(
                    RiskEvidenceLink.evidence_file_id == file_id,
                    RiskEvidenceLink.risk_version_id == rv.id,
                )
                .first()
            )

            print("   file:", file_id, "exists:", bool(exists))

            if exists:
                continue

            new_link = RiskEvidenceLink(
                tenant_id=user.tenant_id,
                evidence_file_id=file_id,
                risk_version_id=rv.id,
            )

            db.add(new_link)
            inserted_for_this_risk = True
            print("   âœ… INSERT", file_id, rv.id)

        if inserted_for_this_risk:
            linked.append(risk_id)

    db.commit()
    print("ğŸ”¥ COMMIT DONE")

    return {"linked": linked}


@router.post("/{evidence_id}/link-risk")
def link_risk_to_evidence(
    evidence_id: int,
    payload: LinkRiskRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    return link_risk_to_evidence_direct(evidence_id, payload, db, user)


# =====================================================
# RISK UNLINK
# =====================================================
@router.post("/{evidence_id}/unlink-risk")
def unlink_risk_from_evidence(
    evidence_id: int,
    payload: UnlinkRiskRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    file_ids = _evidence_file_ids(db, evidence_id)

    if not file_ids:
        raise HTTPException(status_code=404, detail="No files found for this evidence")

    deleted = (
        db.query(RiskEvidenceLink)
        .filter(
            RiskEvidenceLink.evidence_file_id.in_(file_ids),
            RiskEvidenceLink.risk_version_id.in_(
                select(RiskVersion.id).where(RiskVersion.risk_id == payload.risk_id)
            ),
        )
        .delete(synchronize_session=False)
    )

    if deleted == 0:
        raise HTTPException(status_code=404, detail="Link not found")

    db.commit()
    return {"unlinked": payload.risk_id}


# =====================================================
# DELETE EVIDENCE
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

    file_ids = _evidence_file_ids(db, evidence_id)

    if file_ids:
        db.query(RiskEvidenceLink).filter(
            RiskEvidenceLink.evidence_file_id.in_(file_ids)
        ).delete(synchronize_session=False)

    db.query(EvidenceFile).filter(
        EvidenceFile.evidence_id == evidence_id
    ).delete(synchronize_session=False)

    db.delete(evidence)
    db.commit()

    return {"deleted": evidence_id}




# -------------------------------------------------------------------
# APPROVE EVIDENCE (LATEST FILE)
# -------------------------------------------------------------------
@router.post("/{evidence_id}/approve")
def approve_evidence(
    evidence_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    evidence = (
        db.query(Evidence)
        .filter(Evidence.id == evidence_id)
        .first()
    )

    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    latest_file = (
        db.query(EvidenceFile)
        .filter(EvidenceFile.evidence_id == evidence_id)
        .order_by(EvidenceFile.version.desc())
        .first()
    )

    if not latest_file:
        raise HTTPException(status_code=404, detail="Evidence file not found")

    # Pending -> Evidence Library
    old_path = latest_file.file_path

    new_dir = os.path.join(
        "uploads",
        "evidences",
        str(evidence.id),
    )
    os.makedirs(new_dir, exist_ok=True)

    new_path = os.path.join(
        new_dir,
        os.path.basename(old_path),
    )

    if old_path and os.path.exists(old_path):
        shutil.move(old_path, new_path)
        latest_file.file_path = new_path

    latest_file.status = "approved"
    latest_file.approved_by = user.id
    latest_file.approved_at = datetime.utcnow()

    evidence.status = "approved"
    evidence.approval_status = "APPROVED"

    db.commit()

    return {"approved": evidence_id}

# -------------------------------------------------------------------
# REJECT EVIDENCE (LATEST FILE)
# -------------------------------------------------------------------
@router.post("/{evidence_id}/reject")
def reject_evidence(
    evidence_id: int,
    payload: RejectEvidenceRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    evidence = (
        db.query(Evidence)
        .filter(Evidence.id == evidence_id)
        .first()
    )

    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")

    latest_file = (
        db.query(EvidenceFile)
        .filter(EvidenceFile.evidence_id == evidence_id)
        .order_by(EvidenceFile.version.desc())
        .first()
    )

    if latest_file:
        if latest_file.file_path and os.path.exists(latest_file.file_path):
            os.remove(latest_file.file_path)

        latest_file.status = "rejected"

        if hasattr(latest_file, "rejection_reason"):
            latest_file.rejection_reason = payload.reason

        if hasattr(latest_file, "rejected_by"):
            latest_file.rejected_by = user.id

        if hasattr(latest_file, "rejected_at"):
            latest_file.rejected_at = datetime.utcnow()

    evidence.status = "rejected"
    evidence.approval_status = "REJECTED"

    db.commit()

    return {"rejected": evidence_id}

# =====================================================
# GET RISKS FOR EVIDENCE
# =====================================================
@router.get("/{evidence_id}/risks")
def get_risks_for_evidence(
    evidence_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    rows = _risk_query_for_evidence(db, evidence_id).all()

    return [
        {
            "risk_id": r.risk_id,
            "risk_title": r.risk_title,
            "score": getattr(r, "score", None),
            "risk_level": getattr(r, "risk_level", None),
        }
        for r in rows
    ]
# =====================================================
# GET AVAILABLE RISKS
# =====================================================

@router.get("/{evidence_id}/available-risks")
def get_available_risks(
    evidence_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    # ğŸ”¥ already linked riskleri bul
    linked_ids = [
        r.risk_id
        for r in (
            db.query(Risk.id.label("risk_id"))
            .join(RiskVersion, Risk.id == RiskVersion.risk_id)
            .join(RiskEvidenceLink, RiskVersion.id == RiskEvidenceLink.risk_version_id)
            .join(EvidenceFile, EvidenceFile.id == RiskEvidenceLink.evidence_file_id)
            .filter(EvidenceFile.evidence_id == evidence_id)
            .group_by(Risk.id)
            .all()
        )
    ]

    # ğŸ”¥ sadece linklenmemiÅŸleri getir
    risks = (
        db.query(Risk)
        .filter(~Risk.id.in_(linked_ids))
        .all()
    )

    return risks
