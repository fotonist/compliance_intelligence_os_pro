from __future__ import annotations

import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.compliance_tasks import ComplianceTask

router = APIRouter(prefix="/company/tasks", tags=["company_tasks"])
UPLOAD_DIR = "uploads/pending"


@router.get("/my/evidence")
def get_my_tasks_evidence(db: Session = Depends(get_db)):
    sql = text("""
        SELECT DISTINCT ON (e.id)
            e.id, ef.id AS file_id, e.title, e.status, e.created_at,
            t.id AS task_id, c.id AS control_id,
            c.code AS control_code, c.title AS control_title
        FROM evidences e
        JOIN evidence_files ef ON ef.evidence_id = e.id
        JOIN compliance_tasks t
          ON t.control_id = e.control_id AND t.tenant_id = e.tenant_id
        LEFT JOIN controls c ON c.id = t.control_id
        WHERE COALESCE(e.is_deleted, false) = false
        ORDER BY e.id, t.id
    """)
    rows = db.execute(sql).mappings().all()
    result = []
    for row in rows:
        item = dict(row)
        item["control"] = (
            {"id": row["control_id"], "code": row["control_code"], "title": row["control_title"]}
            if row["control_id"] is not None else None
        )
        result.append(item)
    return {"total": len(result), "evidences": result}


@router.get("/{task_id}/evidence")
def get_task_evidence(task_id: int, db: Session = Depends(get_db)):
    task = db.query(ComplianceTask).filter(ComplianceTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    sql = text("""
        SELECT e.id, e.title, e.status, e.created_at
        FROM evidences e
        WHERE e.tenant_id = :tenant_id
          AND e.control_id = :control_id
          AND COALESCE(e.is_deleted, false) = false
        ORDER BY e.created_at DESC
    """)
    rows = db.execute(sql, {"tenant_id": task.tenant_id, "control_id": task.control_id}).mappings().all()
    return {"total": len(rows), "evidences": rows}


@router.post("/{task_id}/evidence/upload")
def upload_task_evidence_file(task_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    task = db.query(ComplianceTask).filter(ComplianceTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not task.control_id:
        raise HTTPException(status_code=400, detail="Task has no control_id")

    standard_id = db.execute(text("""
        SELECT cl.standard_id
        FROM controls ctr
        JOIN requirements req ON req.id = ctr.requirement_id
        JOIN clauses cl ON cl.id = req.clause_id
        WHERE ctr.id = :control_id
    """), {"control_id": task.control_id}).scalar()
    if not standard_id:
        raise HTTPException(status_code=400, detail="Could not resolve standard_id")

    base_path = os.path.join(UPLOAD_DIR, str(task.control_id))
    os.makedirs(base_path, exist_ok=True)
    original_name = file.filename or "uploaded_file"
    ext = original_name.rsplit(".", 1)[-1] if "." in original_name else "bin"
    stored_filename = f"{uuid.uuid4()}.{ext}"
    file_path = os.path.join(base_path, stored_filename)

    try:
        with open(file_path, "wb") as buffer:
            buffer.write(file.file.read())

        evidence_id = db.execute(text("""
            INSERT INTO evidences(title, tenant_id, standard_id, control_id, status, created_at, updated_at)
            VALUES(:title, :tenant_id, :standard_id, :control_id, 'uploaded', now(), now())
            RETURNING id
        """), {
            "title": original_name, "tenant_id": task.tenant_id,
            "standard_id": standard_id, "control_id": task.control_id,
        }).scalar()

        db.execute(text("""
            INSERT INTO evidence_files(
                tenant_id, evidence_id, file_name, file_path,
                mime_type, file_size, version, is_current, status, uploaded_at
            )
            VALUES(
                :tenant_id, :evidence_id, :file_name, :file_path,
                :mime_type, :file_size, 1, TRUE, 'uploaded', now()
            )
        """), {
            "tenant_id": task.tenant_id, "evidence_id": evidence_id,
            "file_name": original_name, "file_path": file_path,
            "mime_type": file.content_type, "file_size": os.path.getsize(file_path),
        })
        db.commit()
        return {"success": True, "task_id": task_id, "evidence_id": evidence_id}
    except Exception:
        db.rollback()
        if os.path.exists(file_path):
            os.remove(file_path)
        raise
