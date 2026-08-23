# =========================================================
# IMPORTS
# =========================================================

import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Body
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.compliance_tasks import ComplianceTask
from app.models.standard_practice import StandardPractice
from app.models.evidence_files import EvidenceFile
from app.models.evidences import Evidence
from app.models.task_evidence_link import TaskEvidenceLink


# =========================================================
# CONSTANTS
# =========================================================

UPLOAD_DIR = "uploads/pending"


# =========================================================
# ROUTER
# =========================================================

router = APIRouter(
    prefix="/company/tasks",
    tags=["company_tasks"],
)


# =========================================================
# GET MY TASKS
# =========================================================

@router.get("/my")
def get_my_tasks(db: Session = Depends(get_db)):
    tasks = (
        db.query(ComplianceTask)
        .order_by(ComplianceTask.created_at.desc())
        .all()
    )

    return {
        "total": len(tasks),
        "tasks": tasks,
    }


# =========================================================
# GET MY TASKS EVIDENCE
# =========================================================

@router.get("/my/evidence")
def get_my_tasks_evidence(db: Session = Depends(get_db)):
    sql = text(
        """
       SELECT
    e.id,
    ef.id AS file_id,
    e.title,
    e.status,
    e.approval_status,
    e.created_at,
    tel.task_id,
    c.id    AS control_id,
    c.code  AS control_code,
    c.title AS control_title
FROM evidences e
 JOIN evidence_files ef
       ON ef.evidence_id = e.id
        JOIN task_evidence_links tel
            ON tel.evidence_id = e.id
        JOIN compliance_tasks t
            ON t.id = tel.task_id
        LEFT JOIN controls c
            ON c.id = t.control_id
        WHERE COALESCE(e.is_deleted,false)=false
        ORDER BY e.created_at DESC
        """
    )

    rows = db.execute(sql).mappings().all()
    result = []

    for r in rows:
        item = dict(r)
        item["file_id"] = r["file_id"]

        if r["control_id"]:
            item["control"] = {
                "id": r["control_id"],
                "code": r["control_code"],
                "title": r["control_title"],
            }
        else:
            item["control"] = None

        result.append(item)

    return {
        "total": len(result),
        "evidences": result,
    }


# =========================================================
# ADD EVIDENCE VIA /my/evidence
# =========================================================

@router.post("/my/evidence")
async def add_my_task_evidence(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    raw_task_id = payload.get("task_id")
    title = (payload.get("title") or "").strip()

    if not raw_task_id:
        raise HTTPException(status_code=400, detail="task_id required")

    task_id = int(raw_task_id)

    task = (
        db.query(ComplianceTask)
        .filter(ComplianceTask.id == task_id)
        .first()
    )

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not task.control_id:
        raise HTTPException(
            status_code=400,
            detail="Task has no control_id. Evidence requires linked control.",
        )

    tenant_id = task.tenant_id or 1
    control_id = task.control_id

    standard_id = getattr(task, "standard_id", None)

    if not standard_id:
        standard_id = db.execute(
            text(
                """
                SELECT c.standard_id
            FROM controls ctr
            JOIN requirements r
                ON r.id = ctr.requirement_id
            JOIN clauses c
                ON c.id = r.clause_id
            WHERE ctr.id = :control_id
                """
            ),
            {"control_id": control_id},
        ).scalar()

    if not standard_id:
        raise HTTPException(
            status_code=400,
            detail="Could not resolve standard_id for this task/control.",
        )

    evidence_id = db.execute(
        text(
            """
            INSERT INTO evidences(
                title,
                tenant_id,
                standard_id,
                control_id,
                status,
                approval_status,
                uploaded_at,
                created_at,
                updated_at
            )
          VALUES(
    :title,
    :tenant_id,
    :standard_id,
    :control_id,
    'uploaded',
    'PENDING_REVIEW',
    now(),
    now(),
    now()
)
            RETURNING id
            """
        ),
        {
            "title": title,
            "tenant_id": tenant_id,
            "standard_id": standard_id,
            "control_id": control_id,
        },
    ).scalar()

    db.flush()

    db.execute(
        text(
            """
            INSERT INTO task_evidence_links(
                tenant_id,
                task_id,
                evidence_id
            )
            VALUES(
                :tenant_id,
                :task_id,
                :evidence_id
            )
            """
        ),
        {
            "tenant_id": tenant_id,
            "task_id": task_id,
            "evidence_id": evidence_id,
        },
    )

    db.commit()

    return {
        "success": True,
        "task_id": task_id,
        "evidence_id": evidence_id,
    }


# =========================================================
# GET TASKS BY PROCESS
# =========================================================
@router.get("/process/{process_id}")
def get_tasks_by_process(
    process_id: int,
    db: Session = Depends(get_db),
):
    tasks = (
        db.query(ComplianceTask)
        .filter(ComplianceTask.process_id == process_id)
        .order_by(ComplianceTask.created_at.desc())
        .all()
    )

    result = []

    for task in tasks:
        item = task.__dict__.copy()
        item.pop("_sa_instance_state", None)

        result.append(item)

    return {
        "total": len(result),
        "tasks": result,
    }


# =========================================================
# GET TASK
# =========================================================

@router.get("/{task_id}")
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = (
        db.query(ComplianceTask)
        .filter(ComplianceTask.id == task_id)
        .first()
    )

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return task


# =========================================================
# UPDATE TASK
# =========================================================

@router.put("/{task_id}")
def update_task(
    task_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    task = (
        db.query(ComplianceTask)
        .filter(ComplianceTask.id == task_id)
        .first()
    )

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    status = payload.get("status")
    description = payload.get("description")
    owner_role = payload.get("owner_role")

    if status:
        task.status = status

    if description is not None:
        task.description = description

    if owner_role is not None:
        task.owner_role = owner_role

    db.commit()
    db.refresh(task)

    return task


# =========================================================
# CLOSE TASK
# =========================================================

@router.post("/{task_id}/close")
def close_task(task_id: int, db: Session = Depends(get_db)):
    task = (
        db.query(ComplianceTask)
        .filter(ComplianceTask.id == task_id)
        .first()
    )

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.status = "CLOSED"

    db.commit()

    return {"success": True}


# =========================================================
# GET TASK EVIDENCE
# =========================================================

@router.get("/{task_id}/evidence")
def get_task_evidence(task_id: int, db: Session = Depends(get_db)):
    sql = text(
        """
        SELECT
            e.id,
            e.title,
            e.status,
            e.approval_status,
            e.valid_until,
            e.created_at
        FROM evidences e
        JOIN task_evidence_links tel
            ON tel.evidence_id = e.id
        WHERE tel.task_id = :task_id
        AND COALESCE(e.is_deleted,false)=false
        ORDER BY e.created_at DESC
        """
    )

    rows = db.execute(sql, {"task_id": task_id}).mappings().all()

    return {
        "total": len(rows),
        "evidences": rows,
    }


# =========================================================
# EVIDENCE FILE UPLOAD
# =========================================================

@router.post("/{task_id}/evidence/upload")
def upload_task_evidence_file(
    task_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    task = (
        db.query(ComplianceTask)
        .filter(ComplianceTask.id == task_id)
        .first()
    )

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not task.control_id:
        raise HTTPException(
            status_code=400,
            detail="Task has no control_id. Evidence upload requires linked control.",
        )

    tenant_id = task.tenant_id or 1
    control_id = task.control_id

    standard_id = db.execute(
        text(
            """
            SELECT c.standard_id
            FROM controls ctr
            JOIN requirements r 
                ON r.id = ctr.requirement_id
            JOIN clauses c 
                ON c.id = r.clause_id
            WHERE ctr.id = :control_id
            """
        ),
        {
            "control_id": control_id
        },
    ).scalar()

    if not standard_id:
        raise HTTPException(
            status_code=400,
            detail="Could not resolve standard_id for this task/control.",
        )

    base_path = os.path.join(
        UPLOAD_DIR,
        str(control_id),
    )

    os.makedirs(
        base_path,
        exist_ok=True,
    )

    original_name = file.filename or "uploaded_file"

    ext = (
        original_name.split(".")[-1]
        if "." in original_name
        else "bin"
    )

    stored_filename = f"{uuid.uuid4()}.{ext}"

    file_path = os.path.join(
        base_path,
        stored_filename,
    )

    try:

        with open(file_path, "wb") as buffer:
            buffer.write(file.file.read())


        evidence = Evidence(
            title=original_name,
            tenant_id=tenant_id,
            standard_id=standard_id,
            control_id=control_id,
            status="uploaded",
        )

        db.add(evidence)

        db.flush()


        evidence_file = EvidenceFile(
            tenant_id=tenant_id,
            evidence_id=evidence.id,
            file_name=original_name,
            file_path=file_path,
            mime_type=file.content_type,
            file_size=os.path.getsize(file_path),
            version=1,
            status="uploaded",
            uploaded_at=datetime.utcnow(),
        )

        db.add(evidence_file)


        task_link = TaskEvidenceLink(
            tenant_id=tenant_id,
            task_id=task_id,
            evidence_id=evidence.id,
        )

        db.add(task_link)


        db.commit()


        return {
            "success": True,
            "evidence_id": evidence.id,
            "file": stored_filename,
            "path": file_path,
        }


    except Exception:
        db.rollback()

        if os.path.exists(file_path):
            os.remove(file_path)

        raise

# =========================================================
# CREATE TASK
# =========================================================

@router.post("")
def create_task(
    payload: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    title = (payload.get("title") or "").strip()
    description = payload.get("description")

    owner_role = payload.get("owner_role")
    process_id = payload.get("process_id")
    control_id = payload.get("control_id")
    priority_score = payload.get("priority_score")
    due_date = payload.get("due_date")

    if not title:
        raise HTTPException(status_code=400, detail="title required")

    if not process_id:
        raise HTTPException(status_code=400, detail="process_id required")

    task = ComplianceTask(
        tenant_id=current_user.tenant_id,
        title=title,
        description=description,
        owner_role=owner_role,
        process_id=int(process_id),
        control_id=int(control_id) if control_id else None,
        priority_score=int(priority_score) if priority_score else None,
        due_date=due_date,
        status="OPEN",
        source_type="manual",
        source_id=None,
    )

    db.add(task)
    db.commit()
    db.refresh(task)

    return {
        "success": True,
        "task": task,
    }
    






