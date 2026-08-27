from datetime import date
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from fastapi.responses import FileResponse

from app.db.session import get_db
from app.core.security import get_current_user

from app.models.user import User
from app.models.governance_policy import GovernancePolicy
from app.models.governance_procedure import GovernanceProcedure
from app.models.governance_procedure_control import GovernanceProcedureControl
from app.models.governance_document_history import GovernanceDocumentHistory
from app.models.governance_procedure_document import GovernanceProcedureDocument
from app.services.document_storage import document_storage
from app.models.controls import Control

from app.schemas.governance_procedure_schema import GovernanceProcedureCreate, GovernanceProcedureUpdate

from app.schemas.governance_policy_schema import (
    GovernancePolicyCreate,
    GovernancePolicyUpdate,
)


router = APIRouter(
    prefix="/governance",
    tags=["Governance"],
)


# ==========================================================
# LIST POLICIES
# ==========================================================

@router.get("/policies")
def list_policies(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = (
        select(GovernancePolicy)
        .where(
            GovernancePolicy.tenant_id == user.tenant_id,
            GovernancePolicy.is_deleted == False,
        )
        .order_by(
            GovernancePolicy.created_at.desc()
        )
    )

    policies = db.execute(stmt).scalars().all()

    return [
        {
            "id": p.id,
            "policy_code": p.policy_code,
            "title": p.title,
            "description": p.description,
            "category": p.category,
            "status": p.status,
            "version": p.version,

            "owner_id": p.owner_id,
            "approver_id": p.approver_id,

            "effective_date": p.effective_date,
            "review_date": p.review_date,

            "created_at": p.created_at,
            "updated_at": p.updated_at,
        }
        for p in policies
    ]


# ==========================================================
# GET POLICY
# ==========================================================

@router.get("/policies/{policy_id}")
def get_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = select(GovernancePolicy).where(
        GovernancePolicy.id == policy_id,
        GovernancePolicy.tenant_id == user.tenant_id,
        GovernancePolicy.is_deleted == False,
    )

    policy = db.execute(stmt).scalar_one_or_none()

    if not policy:
        raise HTTPException(
            status_code=404,
            detail="Policy not found",
        )

    return policy


# ==========================================================
# CREATE POLICY
# ==========================================================

@router.post("/policies")
def create_policy(
    payload: GovernancePolicyCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    policy = GovernancePolicy(
        tenant_id=user.tenant_id,
        **payload.model_dump(),
    )

    db.add(policy)
    db.commit()
    db.refresh(policy)

    return policy


# ==========================================================
# UPDATE POLICY
# ==========================================================

@router.put("/policies/{policy_id}")
def update_policy(
    policy_id: int,
    payload: GovernancePolicyUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = select(GovernancePolicy).where(
        GovernancePolicy.id == policy_id,
        GovernancePolicy.tenant_id == user.tenant_id,
    )

    policy = db.execute(stmt).scalar_one_or_none()

    if not policy:
        raise HTTPException(
            status_code=404,
            detail="Policy not found",
        )

    for key, value in payload.model_dump(
        exclude_unset=True
    ).items():

        setattr(
            policy,
            key,
            value,
        )

    db.commit()
    db.refresh(policy)

    return policy


# ==========================================================
# SUBMIT FOR REVIEW
# ==========================================================

@router.post("/policies/{policy_id}/submit")
def submit_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    policy = db.execute(
        select(GovernancePolicy).where(
            GovernancePolicy.id == policy_id,
            GovernancePolicy.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()

    if not policy:
        raise HTTPException(
            status_code=404,
            detail="Policy not found",
        )

    policy.status = "under_review"

    db.commit()

    return {
        "status": policy.status
    }


# ==========================================================
# APPROVE POLICY
# ==========================================================

@router.post("/policies/{policy_id}/approve")
def approve_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    policy = db.execute(
        select(GovernancePolicy).where(
            GovernancePolicy.id == policy_id,
            GovernancePolicy.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()

    if not policy:
        raise HTTPException(
            status_code=404,
            detail="Policy not found",
        )

    policy.status = "approved"

    db.commit()

    return {
        "status": policy.status
    }


# ==========================================================
# ARCHIVE POLICY
# ==========================================================

@router.post("/policies/{policy_id}/archive")
def archive_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    policy = db.execute(
        select(GovernancePolicy).where(
            GovernancePolicy.id == policy_id,
            GovernancePolicy.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()

    if not policy:
        raise HTTPException(
            status_code=404,
            detail="Policy not found",
        )

    policy.status = "archived"
    policy.is_deleted = True

    db.commit()

    return {
        "status": policy.status
    }

# ==========================================================
# GOVERNANCE PROCEDURES
# ==========================================================

@router.get("/procedures")
def list_procedures(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    stmt = (
        select(GovernanceProcedure)
        .where(
            GovernanceProcedure.tenant_id == user.tenant_id,
            GovernanceProcedure.is_deleted == False,
        )
        .order_by(
            GovernanceProcedure.created_at.desc()
        )
    )

    procedures = db.execute(stmt).scalars().all()

    return [
        {
            "id": p.id,
            "policy_id": p.policy_id,
            "procedure_code": p.procedure_code,
            "title": p.title,
            "description": p.description,

            "status": p.status,
            "version": p.version,

            "owner_id": p.owner_id,

            "effective_date": p.effective_date,
            "review_date": p.review_date,

            "created_at": p.created_at,
            "updated_at": p.updated_at,
        }
        for p in procedures
    ]


# ==========================================================
# CREATE PROCEDURE
# ==========================================================

@router.post("/procedures")
def create_procedure(
    payload: GovernanceProcedureCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    procedure = GovernanceProcedure(
        tenant_id=user.tenant_id,
        **payload.model_dump(),
    )

    db.add(procedure)
    db.commit()
    db.refresh(procedure)

    return procedure


# ==========================================================
# GET PROCEDURE
# ==========================================================

@router.get("/procedures/{procedure_id}")
def get_procedure(
    procedure_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    procedure = db.execute(
        select(GovernanceProcedure).where(
            GovernanceProcedure.id == procedure_id,
            GovernanceProcedure.tenant_id == user.tenant_id,
            GovernanceProcedure.is_deleted == False,
        )
    ).scalar_one_or_none()

    if not procedure:
        raise HTTPException(
            status_code=404,
            detail="Procedure not found",
        )

    return procedure


# ==========================================================
# UPDATE PROCEDURE
# ==========================================================

@router.put("/procedures/{procedure_id}")
def update_procedure(
    procedure_id: int,
    payload: GovernanceProcedureUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    procedure = db.execute(
        select(GovernanceProcedure).where(
            GovernanceProcedure.id == procedure_id,
            GovernanceProcedure.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()

    if not procedure:
        raise HTTPException(
            status_code=404,
            detail="Procedure not found",
        )

    for key, value in payload.model_dump(
        exclude_unset=True
    ).items():
        setattr(
            procedure,
            key,
            value,
        )

    db.commit()
    db.refresh(procedure)

    return procedure


# ==========================================================
# SUBMIT PROCEDURE
# ==========================================================

@router.post("/procedures/{procedure_id}/submit")
def submit_procedure(
    procedure_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    procedure = db.execute(
        select(GovernanceProcedure).where(
            GovernanceProcedure.id == procedure_id,
            GovernanceProcedure.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()

    if not procedure:
        raise HTTPException(
            status_code=404,
            detail="Procedure not found",
        )

    procedure.status = "under_review"

    db.commit()

    return {
        "status": procedure.status
    }


# ==========================================================
# APPROVE PROCEDURE
# ==========================================================

@router.post("/procedures/{procedure_id}/approve")
def approve_procedure(
    procedure_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    procedure = db.execute(
        select(GovernanceProcedure).where(
            GovernanceProcedure.id == procedure_id,
            GovernanceProcedure.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()

    if not procedure:
        raise HTTPException(
            status_code=404,
            detail="Procedure not found",
        )

    procedure.status = "approved"

    db.commit()

    return {
        "status": procedure.status
    }


# ==========================================================
# ARCHIVE PROCEDURE
# ==========================================================

@router.post("/procedures/{procedure_id}/archive")
def archive_procedure(
    procedure_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    procedure = db.execute(
        select(GovernanceProcedure).where(
            GovernanceProcedure.id == procedure_id,
            GovernanceProcedure.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()

    if not procedure:
        raise HTTPException(
            status_code=404,
            detail="Procedure not found",
        )

    procedure.status = "archived"
    procedure.is_deleted = True

    db.commit()

    return {
        "status": procedure.status
    }


# ==========================================================
# LIST POLICY PROCEDURES
# ==========================================================

@router.get("/policies/{policy_id}/procedures")
def list_policy_procedures(
    policy_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    policy = db.execute(
        select(GovernancePolicy).where(
            GovernancePolicy.id == policy_id,
            GovernancePolicy.tenant_id == user.tenant_id,
            GovernancePolicy.is_deleted == False,
        )
    ).scalar_one_or_none()


    if not policy:
        raise HTTPException(
            status_code=404,
            detail="Policy not found",
        )


    procedures = db.execute(
        select(GovernanceProcedure).where(
            GovernanceProcedure.policy_id == policy_id,
            GovernanceProcedure.tenant_id == user.tenant_id,
            GovernanceProcedure.is_deleted == False,
        )
        .order_by(
            GovernanceProcedure.created_at.desc()
        )
    ).scalars().all()


    return [
        {
            "id": p.id,
            "procedure_code": p.procedure_code,
            "title": p.title,
            "status": p.status,
            "version": p.version,
            "owner_id": p.owner_id,
            "review_date": p.review_date,
        }
        for p in procedures
    ]


# ==========================================================
# LIST PROCEDURE CONTROLS
# ==========================================================

@router.get("/procedures/{procedure_id}/controls")
def list_procedure_controls(
    procedure_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    procedure = db.execute(
        select(GovernanceProcedure).where(
            GovernanceProcedure.id == procedure_id,
            GovernanceProcedure.tenant_id == user.tenant_id,
            GovernanceProcedure.is_deleted == False,
        )
    ).scalar_one_or_none()

    if not procedure:
        raise HTTPException(
            status_code=404,
            detail="Procedure not found",
        )


    links = db.execute(
        select(
            GovernanceProcedureControl,
            Control,
        )
        .join(
            Control,
            Control.id == GovernanceProcedureControl.control_id,
        )
        .where(
            GovernanceProcedureControl.procedure_id == procedure_id,
            GovernanceProcedureControl.tenant_id == user.tenant_id,
        )
    ).all()


    return [
        {
            "id": link.id,
            "control_id": control.id,
            "control_code": control.code,
            "control_title": control.title,
        }
        for link, control in links
    ]


# ==========================================================
# LINK CONTROL TO PROCEDURE
# ==========================================================

@router.post("/procedures/{procedure_id}/controls/{control_id}")
def link_procedure_control(
    procedure_id: int,
    control_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    procedure = db.execute(
        select(GovernanceProcedure).where(
            GovernanceProcedure.id == procedure_id,
            GovernanceProcedure.tenant_id == user.tenant_id,
            GovernanceProcedure.is_deleted == False,
        )
    ).scalar_one_or_none()

    if not procedure:
        raise HTTPException(
            status_code=404,
            detail="Procedure not found",
        )


    control = db.execute(
        select(Control).where(
            Control.id == control_id,
        )
    ).scalar_one_or_none()

    if not control:
        raise HTTPException(
            status_code=404,
            detail="Control not found",
        )


    existing = db.execute(
        select(GovernanceProcedureControl).where(
            GovernanceProcedureControl.procedure_id == procedure_id,
            GovernanceProcedureControl.control_id == control_id,
            GovernanceProcedureControl.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()


    if existing:
        raise HTTPException(
            status_code=400,
            detail="Control already linked",
        )


    link = GovernanceProcedureControl(
        tenant_id=user.tenant_id,
        procedure_id=procedure_id,
        control_id=control_id,
    )


    db.add(link)
    db.commit()
    db.refresh(link)


    return {
        "id": link.id,
        "procedure_id": procedure_id,
        "control_id": control_id,
    }


# ==========================================================
# UNLINK CONTROL FROM PROCEDURE
# ==========================================================

@router.delete("/procedures/{procedure_id}/controls/{control_id}")
def unlink_procedure_control(
    procedure_id: int,
    control_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    link = db.execute(
        select(GovernanceProcedureControl).where(
            GovernanceProcedureControl.procedure_id == procedure_id,
            GovernanceProcedureControl.control_id == control_id,
            GovernanceProcedureControl.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()


    if not link:
        raise HTTPException(
            status_code=404,
            detail="Control link not found",
        )


    db.delete(link)
    db.commit()


    return {
        "status": "removed"
    }




# ==========================================================
# PROCEDURE DOCUMENTS
# ==========================================================

@router.post("/procedures/{procedure_id}/documents")
def upload_procedure_document(
    procedure_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    procedure = db.execute(
        select(GovernanceProcedure).where(
            GovernanceProcedure.id == procedure_id,
            GovernanceProcedure.tenant_id == user.tenant_id,
            GovernanceProcedure.is_deleted == False,
        )
    ).scalar_one_or_none()

    if not procedure:
        raise HTTPException(
            status_code=404,
            detail="Procedure not found",
        )

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="File name is required",
        )

    try:
        target, storage_key, file_size, checksum = document_storage.save_staging(
            tenant_id=user.tenant_id,
            procedure_id=procedure.id,
            source=file.file,
            original_filename=file.filename,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Document storage failed: {exc}",
        )

    existing_documents = db.execute(
        select(GovernanceProcedureDocument)
        .where(
            GovernanceProcedureDocument.tenant_id == user.tenant_id,
            GovernanceProcedureDocument.procedure_id == procedure.id,
        )
        .order_by(
            GovernanceProcedureDocument.uploaded_at.desc()
        )
    ).scalars().all()

    latest_version = 1

    if existing_documents:
        try:
            latest_version = max(
                int(doc.version)
                for doc in existing_documents
            ) + 1
        except Exception:
            latest_version = len(existing_documents) + 1

    for existing_document in existing_documents:

        if not existing_document.is_current:
            continue

        source_path = document_storage.absolute_path(
            existing_document.storage_key
        )

        if source_path.exists():
            try:
                _, archive_storage_key = document_storage.move_to_archive(
                    source_path=source_path,
                    tenant_id=user.tenant_id,
                    procedure_id=procedure.id,
                    version=existing_document.version,
                )

                existing_document.storage_key = archive_storage_key

            except Exception as exc:
                db.rollback()

                try:
                    document_storage.delete(storage_key)
                except Exception:
                    pass

                raise HTTPException(
                    status_code=500,
                    detail=f"Previous document archive failed: {exc}",
                )

        existing_document.is_current = False
        existing_document.is_archived = True
        existing_document.status = "archived"

        from datetime import datetime
        existing_document.archived_at = datetime.utcnow()

    document_version = str(latest_version)

    document = GovernanceProcedureDocument(
        tenant_id=user.tenant_id,
        procedure_id=procedure.id,
        version=document_version,
        file_name=file.filename,
        storage_key=storage_key,
        mime_type=file.content_type,
        file_size=file_size,
        checksum=checksum,
        status="uploaded",
        is_current=True,
        is_archived=False,
        uploaded_by=user.id,
    )

    db.add(document)

    try:
        db.commit()
        db.refresh(document)

    except Exception as exc:
        db.rollback()

        try:
            document_storage.delete(storage_key)
        except Exception:
            pass

        raise HTTPException(
            status_code=500,
            detail=f"Document database save failed: {exc}",
        )

    return {
        "id": document.id,
        "procedure_id": document.procedure_id,
        "version": document.version,
        "file_name": document.file_name,
        "storage_key": document.storage_key,
        "mime_type": document.mime_type,
        "file_size": document.file_size,
        "checksum": document.checksum,
        "status": document.status,
        "is_current": document.is_current,
        "is_archived": document.is_archived,
    }


# ==========================================================
# LIST PROCEDURE DOCUMENTS
# ==========================================================

@router.get("/procedures/{procedure_id}/documents")
def list_procedure_documents(
    procedure_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    procedure = db.execute(
        select(GovernanceProcedure).where(
            GovernanceProcedure.id == procedure_id,
            GovernanceProcedure.tenant_id == user.tenant_id,
            GovernanceProcedure.is_deleted == False,
        )
    ).scalar_one_or_none()

    if not procedure:
        raise HTTPException(
            status_code=404,
            detail="Procedure not found",
        )

    documents = db.execute(
        select(GovernanceProcedureDocument)
        .where(
            GovernanceProcedureDocument.tenant_id == user.tenant_id,
            GovernanceProcedureDocument.procedure_id == procedure.id,
        )
        .order_by(
            GovernanceProcedureDocument.uploaded_at.desc()
        )
    ).scalars().all()

    return [
        {
            "id": document.id,
            "procedure_id": document.procedure_id,
            "version": document.version,
            "file_name": document.file_name,
            "storage_key": document.storage_key,
            "mime_type": document.mime_type,
            "file_size": document.file_size,
            "checksum": document.checksum,
            "status": document.status,
            "is_current": document.is_current,
            "is_archived": document.is_archived,
            "uploaded_by": document.uploaded_by,
            "uploaded_at": document.uploaded_at,
            "archived_at": document.archived_at,
            "reviewer_id": document.reviewer_id,
            "reviewed_at": document.reviewed_at,
            "approved_by": document.approved_by,
            "approved_at": document.approved_at,
            "rejected_by": document.rejected_by,
            "rejected_at": document.rejected_at,
            "review_comment": document.review_comment,
        }
        for document in documents
    ]


# ==========================================================
# DOWNLOAD PROCEDURE DOCUMENT
# ==========================================================

@router.get("/documents/{document_id}/download")
def download_procedure_document(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    document = db.execute(
        select(GovernanceProcedureDocument).where(
            GovernanceProcedureDocument.id == document_id,
            GovernanceProcedureDocument.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    path = document_storage.absolute_path(
        document.storage_key
    )

    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail="Document file not found",
        )

    return FileResponse(
        path=str(path),
        filename=document.file_name,
        media_type=document.mime_type or "application/octet-stream",
    )


# ==========================================================
# DOCUMENT HISTORY
# ==========================================================

@router.get("/documents/{document_id}/history")
def get_document_history(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    document = db.execute(
        select(GovernanceProcedureDocument).where(
            GovernanceProcedureDocument.id == document_id,
            GovernanceProcedureDocument.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    history = db.execute(
        select(GovernanceDocumentHistory)
        .where(
            GovernanceDocumentHistory.document_id == document.id,
        )
        .order_by(
            GovernanceDocumentHistory.created_at.desc()
        )
    ).scalars().all()

    return [
        {
            "id": item.id,
            "document_id": item.document_id,
            "action": item.action,
            "old_status": item.old_status,
            "new_status": item.new_status,
            "comment": item.comment,
            "performed_by": item.performed_by,
            "created_at": item.created_at,
        }
        for item in history
    ]


# ==========================================================
# SUBMIT DOCUMENT FOR REVIEW
# ==========================================================

@router.post("/documents/{document_id}/submit-review")
def submit_document_review(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    document = db.execute(
        select(GovernanceProcedureDocument).where(
            GovernanceProcedureDocument.id == document_id,
            GovernanceProcedureDocument.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    old_status = document.status
    document.status = "under_review"
    document.reviewer_id = user.id

    from datetime import datetime
    document.reviewed_at = datetime.utcnow()

    db.add(
        GovernanceDocumentHistory(
            document_id=document.id,
            action="SUBMIT_REVIEW",
            old_status=old_status,
            new_status=document.status,
            performed_by=user.id,
        )
    )

    db.commit()
    db.refresh(document)

    return {
        "status": document.status,
        "document_id": document.id,
    }


# ==========================================================
# APPROVE DOCUMENT
# ==========================================================

@router.post("/documents/{document_id}/approve")
def approve_document(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    document = db.execute(
        select(GovernanceProcedureDocument).where(
            GovernanceProcedureDocument.id == document_id,
            GovernanceProcedureDocument.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    old_status = document.status
    document.status = "approved"
    document.approved_by = user.id

    from datetime import datetime
    document.approved_at = datetime.utcnow()

    db.add(
        GovernanceDocumentHistory(
            document_id=document.id,
            action="APPROVE",
            old_status=old_status,
            new_status=document.status,
            performed_by=user.id,
        )
    )

    db.commit()
    db.refresh(document)

    return {
        "status": document.status,
        "document_id": document.id,
    }


# ==========================================================
# REJECT DOCUMENT
# ==========================================================

@router.post("/documents/{document_id}/reject")
def reject_document(
    document_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    document = db.execute(
        select(GovernanceProcedureDocument).where(
            GovernanceProcedureDocument.id == document_id,
            GovernanceProcedureDocument.tenant_id == user.tenant_id,
        )
    ).scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found",
        )

    review_comment = payload.get("review_comment")

    old_status = document.status
    document.status = "rejected"
    document.review_comment = review_comment
    document.rejected_by = user.id

    from datetime import datetime
    document.rejected_at = datetime.utcnow()

    db.add(
        GovernanceDocumentHistory(
            document_id=document.id,
            action="REJECT",
            old_status=old_status,
            new_status=document.status,
            comment=review_comment,
            performed_by=user.id,
        )
    )

    db.commit()
    db.refresh(document)

    return {
        "status": document.status,
        "document_id": document.id,
    }







# ==========================================================
# GOVERNANCE DASHBOARD
# ==========================================================

@router.get("/dashboard")
def governance_dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):

    tenant_id = user.tenant_id


    # -----------------------------
    # POLICY SUMMARY
    # -----------------------------

    policy_total = db.execute(
        select(func.count())
        .select_from(GovernancePolicy)
        .where(
            GovernancePolicy.tenant_id == tenant_id,
            GovernancePolicy.is_deleted == False,
        )
    ).scalar() or 0


    policy_rows = db.execute(
        select(
            GovernancePolicy.status,
            func.count()
        )
        .where(
            GovernancePolicy.tenant_id == tenant_id,
            GovernancePolicy.is_deleted == False,
        )
        .group_by(
            GovernancePolicy.status
        )
    ).all()


    policy_summary = {
        "total": policy_total,
        "draft": 0,
        "under_review": 0,
        "approved": 0,
        "expired": 0,
        "archived": 0,
    }


    for status, count in policy_rows:
        if status in policy_summary:
            policy_summary[status] = count



    # -----------------------------
    # PROCEDURE SUMMARY
    # -----------------------------

    procedure_total = db.execute(
        select(func.count())
        .select_from(GovernanceProcedure)
        .where(
            GovernanceProcedure.tenant_id == tenant_id,
            GovernanceProcedure.is_deleted == False,
        )
    ).scalar() or 0



    procedure_rows = db.execute(
        select(
            GovernanceProcedure.status,
            func.count()
        )
        .where(
            GovernanceProcedure.tenant_id == tenant_id,
            GovernanceProcedure.is_deleted == False,
        )
        .group_by(
            GovernanceProcedure.status
        )
    ).all()



    procedure_summary = {
        "total": procedure_total,
        "draft": 0,
        "under_review": 0,
        "approved": 0,
        "archived": 0,
    }


    for status, count in procedure_rows:
        if status in procedure_summary:
            procedure_summary[status] = count



    # -----------------------------
    # DOCUMENT SUMMARY
    # -----------------------------

    document_rows = db.execute(
        select(
            GovernanceProcedureDocument.status,
            func.count()
        )
        .where(
            GovernanceProcedureDocument.tenant_id == tenant_id
        )
        .group_by(
            GovernanceProcedureDocument.status
        )
    ).all()


    document_summary = {
        "total": 0,
        "current": 0,
        "archived": 0,
        "approved": 0,
        "rejected": 0,
    }


    for status, count in document_rows:

        document_summary["total"] += count

        if status == "approved":
            document_summary["approved"] = count

        elif status == "rejected":
            document_summary["rejected"] = count



    document_summary["current"] = db.execute(
        select(func.count())
        .select_from(GovernanceProcedureDocument)
        .where(
            GovernanceProcedureDocument.tenant_id == tenant_id,
            GovernanceProcedureDocument.is_current == True,
        )
    ).scalar() or 0



    document_summary["archived"] = db.execute(
        select(func.count())
        .select_from(GovernanceProcedureDocument)
        .where(
            GovernanceProcedureDocument.tenant_id == tenant_id,
            GovernanceProcedureDocument.is_archived == True,
        )
    ).scalar() or 0



    # -----------------------------
    # UPCOMING REVIEWS
    # -----------------------------

    upcoming_reviews = db.execute(
        select(
            GovernancePolicy.id,
            GovernancePolicy.title,
            GovernancePolicy.review_date,
        )
        .where(
            GovernancePolicy.tenant_id == tenant_id,
            GovernancePolicy.is_deleted == False,
            GovernancePolicy.review_date.is_not(None),
        )
        .order_by(
            GovernancePolicy.review_date.asc()
        )
        .limit(10)
    ).all()



    # -----------------------------
    # ACTIVITY SUMMARY
    # -----------------------------

    activities = db.execute(
        select(
            GovernanceDocumentHistory.id,
            GovernanceDocumentHistory.action,
            GovernanceDocumentHistory.new_status,
            GovernanceDocumentHistory.created_at,

            GovernanceProcedureDocument.file_name,
            GovernanceProcedureDocument.version,

            User.full_name,
        )
        .join(
            GovernanceProcedureDocument,
            GovernanceProcedureDocument.id ==
            GovernanceDocumentHistory.document_id,
        )
        .outerjoin(
            User,
            User.id ==
            GovernanceDocumentHistory.performed_by,
        )
        .where(
            GovernanceProcedureDocument.tenant_id == tenant_id
        )
        .order_by(
            GovernanceDocumentHistory.created_at.desc()
        )
        .limit(10)
    ).all()




    # -----------------------------
    # GOVERNANCE INTELLIGENCE
    # -----------------------------

    policy_health = 0

    if policy_summary["total"] > 0:
        policy_health = round(
            (
                policy_summary["approved"]
                / policy_summary["total"]
            ) * 100
        )


    # -----------------------------
    # DOCUMENT HEALTH
    # -----------------------------

    procedure_total_for_documents = db.execute(
        select(func.count())
        .select_from(GovernanceProcedure)
        .where(
            GovernanceProcedure.tenant_id == tenant_id,
            GovernanceProcedure.is_deleted == False,
        )
    ).scalar() or 0


    procedures_with_current_document = db.execute(
        select(func.count())
        .select_from(
            select(
                GovernanceProcedureDocument.procedure_id
            )
            .where(
                GovernanceProcedureDocument.tenant_id == tenant_id,
                GovernanceProcedureDocument.is_current == True,
                GovernanceProcedureDocument.is_archived == False,
            )
            .group_by(
                GovernanceProcedureDocument.procedure_id
            )
            .subquery()
        )
    ).scalar() or 0


    current_document_total = db.execute(
        select(func.count())
        .select_from(GovernanceProcedureDocument)
        .where(
            GovernanceProcedureDocument.tenant_id == tenant_id,
            GovernanceProcedureDocument.is_current == True,
            GovernanceProcedureDocument.is_archived == False,
        )
    ).scalar() or 0


    current_approved_total = db.execute(
        select(func.count())
        .select_from(GovernanceProcedureDocument)
        .where(
            GovernanceProcedureDocument.tenant_id == tenant_id,
            GovernanceProcedureDocument.is_current == True,
            GovernanceProcedureDocument.is_archived == False,
            GovernanceProcedureDocument.status == "approved",
        )
    ).scalar() or 0


    current_rejected_total = db.execute(
        select(func.count())
        .select_from(GovernanceProcedureDocument)
        .where(
            GovernanceProcedureDocument.tenant_id == tenant_id,
            GovernanceProcedureDocument.is_current == True,
            GovernanceProcedureDocument.is_archived == False,
            GovernanceProcedureDocument.status == "rejected",
        )
    ).scalar() or 0

    document_health_score = 0

    if procedure_total_for_documents > 0:

        current_coverage = (
            procedures_with_current_document
            / procedure_total_for_documents
        ) * 50

        approval_quality = 0

        if current_document_total > 0:
            approval_quality = (
                current_approved_total
                / current_document_total
            ) * 30

        rejection_quality = 0

        if current_document_total > 0:
            rejection_quality = (
                (
                    current_document_total
                    - current_rejected_total
                )
                / current_document_total
            ) * 20

        document_health_score = round(
            max(
                0,
                min(
                    100,
                    current_coverage
                    + approval_quality
                    + rejection_quality
                )
            )
        )


    # -----------------------------
    # REVIEW COMPLIANCE
    # -----------------------------
    # Review health reflects the review-date readiness of all
    # active governance policies.
    #
    # No review date      -> 0
    # Overdue review      -> 0
    # Current/future date -> 100
    #
    # This prevents policies without a review date from being
    # silently excluded and producing an artificial 100% score.

    today = date.today()

    total_active_policies = db.execute(
        select(func.count())
        .select_from(GovernancePolicy)
        .where(
            GovernancePolicy.tenant_id == tenant_id,
            GovernancePolicy.is_deleted == False,
            GovernancePolicy.status != "archived",
        )
    ).scalar() or 0

    compliant_review_policies = db.execute(
        select(func.count())
        .select_from(GovernancePolicy)
        .where(
            GovernancePolicy.tenant_id == tenant_id,
            GovernancePolicy.is_deleted == False,
            GovernancePolicy.status != "archived",
            GovernancePolicy.review_date.is_not(None),
            GovernancePolicy.review_date >= today,
        )
    ).scalar() or 0

    if total_active_policies > 0:
        review_health = round(
            (
                compliant_review_policies
                / total_active_policies
            ) * 100
        )
    else:
        review_health = 0


    # -----------------------------
    # APPROVAL HEALTH
    # -----------------------------

    total_policy_states = (
        policy_summary["draft"]
        + policy_summary["under_review"]
        + policy_summary["approved"]
    )

    if total_policy_states > 0:
        approval_health = round(
            (
                policy_summary["approved"]
                / total_policy_states
            ) * 100
        )
    else:
        approval_health = 0


    # -----------------------------
    # PROCEDURE HEALTH
    # -----------------------------

    procedure_total = procedure_summary["total"]

    if procedure_total > 0:
        procedure_approved = procedure_summary["approved"]

        procedure_health = round(
            (
                procedure_approved
                / procedure_total
            ) * 100
        )
    else:
        procedure_health = 0


    # -----------------------------
    # GOVERNANCE HEALTH
    # -----------------------------
    # Only active dimensions with actual data participate.
    # This prevents an empty governance area from becoming 100.

    health_components = [
        policy_health if policy_summary["total"] > 0 else None,
        procedure_health if procedure_total > 0 else None,
        document_health_score if procedure_total_for_documents > 0 else None,
        review_health if total_active_policies > 0 else None,
        approval_health if total_policy_states > 0 else None,
    ]

    active_health_components = [
        value
        for value in health_components
        if value is not None
    ]

    governance_health = (
        round(
            sum(active_health_components)
            / len(active_health_components)
        )
        if active_health_components
        else 0
    )


    attention_items = []


    if document_summary["rejected"] > 0:

        rejected_count = document_summary["rejected"]

        rejected_label = (
            "document"
            if rejected_count == 1
            else "documents"
        )

        attention_items.append(
            {
                "severity": "high",
                "title": "Rejected Documents",
                "message": (
                    f"{rejected_count} "
                    f"{rejected_label} requires review"
                    if rejected_count == 1
                    else
                    f"{rejected_count} "
                    f"{rejected_label} require review"
                ),
            }
        )


    pending_policy_count = (
        policy_summary["under_review"]
    )

    if pending_policy_count > 0:

        policy_label = (
            "policy"
            if pending_policy_count == 1
            else "policies"
        )

        attention_items.append(
            {
                "severity": "medium",
                "title": "Policies Pending Approval",
                "message": (
                    f"{pending_policy_count} "
                    f"{policy_label} is currently under review"
                    if pending_policy_count == 1
                    else
                    f"{pending_policy_count} "
                    f"{policy_label} are currently under review"
                ),
            }
        )


    if len(upcoming_reviews) > 0:

        review_count = len(upcoming_reviews)

        review_label = (
            "policy review"
            if review_count == 1
            else "policy reviews"
        )

        attention_items.append(
            {
                "severity": "medium",
                "title": "Upcoming Reviews",
                "message": (
                    f"{review_count} "
                    f"{review_label} scheduled"
                ),
            }
        )

    return {
        "policy_summary": policy_summary,
        "procedure_summary": procedure_summary,

        "document_summary": document_summary,

        "health_score": {
            "governance": governance_health,
            "document": document_health_score,
            "policy": policy_health,
            "review": review_health,
            "approval": approval_health,
        },

        "document_health": {
            "score": document_health_score,
            "current": document_summary["current"],
            "approved": document_summary["approved"],
            "rejected": document_summary["rejected"],
            "archived": document_summary["archived"],
        },

        "attention_items": attention_items,

        "upcoming_reviews": [
            {
                "id": item.id,
                "title": item.title,
                "review_date": item.review_date,
            }
            for item in upcoming_reviews
        ],

        "activity_summary": [
            {
                "id": item.id,
                "action": item.action,
                "status": item.new_status,

                "document": item.file_name,

                "version": item.version,

                "performed_by": item.full_name
                if item.full_name
                else "System",

                "created_at": item.created_at,
            }
            for item in activities
        ],
    }









