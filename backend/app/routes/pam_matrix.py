from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.standards import Standard
from app.models.standard_versions import StandardVersion
from app.models.framework_model import FrameworkModel
from app.models.framework_relationship import FrameworkRelationship
from app.models.framework_adoption import FrameworkAdoption, FrameworkAdoptionScope
from app.models.process_pam_mapping import ProcessPamMapping
from app.models.pam_process_category import PamProcessCategory
from app.models.pam_definition import (
    PamProcessGroup,
    PamProcess,
    PamProcessOutcome,
    PamBasePractice,
    PamProcessWorkProduct,
    PamWorkProduct,
)
from app.models.pam_capability import PamCapabilityLevel, PamProcessAttribute
from app.models.matrix_instance import MatrixInstance
from app.models.matrix_row import MatrixRow

router = APIRouter(prefix="/matrix", tags=["PAM Matrix"])


def _tenant(user):
    tenant_id = getattr(user, "tenant_id", None)
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant context is required")
    return tenant_id


def _resolve_version(db: Session, standard_id: int, version_id: Optional[int]):
    standard = db.query(Standard).filter(Standard.id == standard_id).first()
    if not standard:
        raise HTTPException(status_code=404, detail="Standard not found")
    query = db.query(StandardVersion).filter(StandardVersion.standard_id == standard_id)
    version = query.filter(StandardVersion.id == version_id).first() if version_id else query.order_by(StandardVersion.id.desc()).first()
    if not version:
        raise HTTPException(status_code=404, detail="Standard version not found")
    return standard, version


def _model(db: Session, version_id: int, model_type: str):
    return (
        db.query(FrameworkModel)
        .filter(
            FrameworkModel.standard_version_id == version_id,
            FrameworkModel.model_type == model_type,
            FrameworkModel.is_canonical.is_(True),
        )
        .order_by(FrameworkModel.id.asc())
        .first()
    )


def _ensure_pam(db: Session, standard: Standard, version: StandardVersion):
    """Ensure the canonical PAM exists for maturity-based standards."""
    pam = _model(db, version.id, "PAM")
    if pam or standard.code != "ISO15504":
        return pam

    from app.seed.iso15504_2006 import seed_iso15504_2006

    seed_iso15504_2006(db)
    return _model(db, version.id, "PAM")


def _reference_model(db: Session, pam_id: int):
    relation = (
        db.query(FrameworkRelationship)
        .filter(
            FrameworkRelationship.source_model_id == pam_id,
            FrameworkRelationship.relationship_type == "PROCESS_REFERENCE_MODEL",
        )
        .first()
    )
    if relation:
        return db.query(FrameworkModel).filter(FrameworkModel.id == relation.target_model_id).first()

    return db.query(FrameworkModel).filter(FrameworkModel.id == pam_id).first()


def _process_payload(db: Session, process: PamProcess) -> Dict[str, Any]:
    group = db.query(PamProcessGroup).filter(PamProcessGroup.id == process.process_group_id).first()
    category = db.query(PamProcessCategory).filter(PamProcessCategory.id == group.category_id).first() if group else None
    outcomes = db.query(PamProcessOutcome).filter(PamProcessOutcome.process_id == process.id).order_by(PamProcessOutcome.sort_order, PamProcessOutcome.id).all()
    practices = db.query(PamBasePractice).filter(PamBasePractice.process_id == process.id).order_by(PamBasePractice.sort_order, PamBasePractice.id).all()
    links = db.query(PamProcessWorkProduct).filter(PamProcessWorkProduct.process_id == process.id).order_by(PamProcessWorkProduct.sort_order, PamProcessWorkProduct.id).all()
    products = []
    for link in links:
        work_product = db.query(PamWorkProduct).filter(PamWorkProduct.id == link.work_product_id).first()
        if work_product:
            products.append({"id": work_product.id, "code": work_product.code, "name": work_product.name, "description": work_product.description, "direction": link.direction})
    return {
        "id": process.id,
        "code": process.code,
        "name": process.name,
        "purpose": process.purpose,
        "description": process.description,
        "category_id": category.id if category else None,
        "category_code": category.code if category else None,
        "category_name": category.name if category else None,
        "group_id": group.id if group else None,
        "group_code": group.code if group else None,
        "group_name": group.name if group else None,
        "outcomes": [{"id": item.id, "code": item.code, "text": item.text} for item in outcomes],
        "base_practices": [{"id": item.id, "code": item.code, "text": item.text, "guidance": item.guidance} for item in practices],
        "work_products": products,
    }


def _adoption_pam_process_ids(db: Session, adoption_id: int, pam_id: int):
    """Translate tenant Process scope into canonical PAM process ids."""
    scoped_process_ids = [
        item.process_id
        for item in db.query(FrameworkAdoptionScope)
        .filter(FrameworkAdoptionScope.adoption_id == adoption_id)
        .all()
    ]
    if not scoped_process_ids:
        return []

    mappings = (
        db.query(ProcessPamMapping)
        .filter(
            ProcessPamMapping.process_id.in_(scoped_process_ids),
            ProcessPamMapping.pam_process_id.isnot(None),
        )
        .all()
    )
    valid_pam_ids = {
        item.pam_process_id
        for item in mappings
        if item.pam_process_id
        and item.pam_process
        and item.pam_process.framework_model_id == pam_id
    }
    return sorted(valid_pam_ids)


@router.get("/pam")
def get_pam_matrix(
    standard_id: int = Query(...),
    standard_version_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant(user)
    standard, version = _resolve_version(db, standard_id, standard_version_id)
    pam = _ensure_pam(db, standard, version)
    cmf = _model(db, version.id, "CMF")
    if not pam:
        raise HTTPException(status_code=409, detail="Canonical PAM is not configured for this framework version")

    reference = _reference_model(db, pam.id)
    categories = db.query(PamProcessCategory).filter(PamProcessCategory.framework_model_id == pam.id).order_by(PamProcessCategory.sort_order, PamProcessCategory.id).all()
    groups = db.query(PamProcessGroup).join(PamProcessCategory, PamProcessGroup.category_id == PamProcessCategory.id).filter(PamProcessCategory.framework_model_id == pam.id).order_by(PamProcessGroup.category_id, PamProcessGroup.sort_order, PamProcessGroup.id).all()
    processes = db.query(PamProcess).filter(PamProcess.framework_model_id == pam.id).order_by(PamProcess.process_group_id, PamProcess.sort_order, PamProcess.id).all()

    category_payload = []
    for category in categories:
        group_payload = []
        for group in [item for item in groups if item.category_id == category.id]:
            group_payload.append({
                "id": group.id,
                "code": group.code,
                "name": group.name,
                "description": group.description,
                "processes": [_process_payload(db, process) for process in processes if process.process_group_id == group.id],
            })
        category_payload.append({"id": category.id, "code": category.code, "name": category.name, "description": category.description, "groups": group_payload})

    levels = []
    attributes = []
    if cmf:
        level_rows = db.query(PamCapabilityLevel).filter(PamCapabilityLevel.framework_model_id == cmf.id).order_by(PamCapabilityLevel.level, PamCapabilityLevel.id).all()
        levels = [{"id": item.id, "level": item.level, "code": item.code, "name": item.name, "description": item.description} for item in level_rows]
        if level_rows:
            attrs = db.query(PamProcessAttribute).filter(PamProcessAttribute.capability_level_id.in_([item.id for item in level_rows])).order_by(PamProcessAttribute.capability_level_id, PamProcessAttribute.sort_order, PamProcessAttribute.id).all()
            attributes = [{"id": item.id, "capability_level_id": item.capability_level_id, "code": item.code, "name": item.name, "description": item.description} for item in attrs]

    adoption = db.query(FrameworkAdoption).filter(
        FrameworkAdoption.tenant_id == tenant_id,
        FrameworkAdoption.standard_id == standard_id,
        FrameworkAdoption.standard_version_id == version.id,
        FrameworkAdoption.status == "ACTIVE",
    ).order_by(FrameworkAdoption.id.desc()).first()
    process_ids = _adoption_pam_process_ids(db, adoption.id, pam.id) if adoption else []

    return {
        "mode": "pam",
        "standard": {"id": standard.id, "code": standard.code, "title": standard.title, "type": standard.type},
        "version": {"id": version.id, "version_code": version.version_code, "status": version.status},
        "framework_model": {"id": pam.id, "code": pam.code, "name": pam.name, "model_type": pam.model_type},
        "reference_model": ({"id": reference.id, "code": reference.code, "name": reference.name, "model_type": reference.model_type} if reference else None),
        "capability_measurement_framework": ({"id": cmf.id, "code": cmf.code, "name": cmf.name, "model_type": cmf.model_type} if cmf else None),
        "adoption": ({"id": adoption.id, "status": adoption.status, "applicability": adoption.applicability, "effective_date": adoption.effective_date, "process_ids": process_ids} if adoption else None),
        "categories": category_payload,
        "capability_levels": levels,
        "process_attributes": attributes,
        "counts": {"categories": len(categories), "groups": len(groups), "processes": len(processes)},
    }


@router.post("/pam/generate")
def generate_pam_matrix(body: Dict[str, Any] = Body(...), db: Session = Depends(get_db), user=Depends(get_current_user)):
    tenant_id = _tenant(user)
    try:
        standard_id = int(body["standard_id"])
        version_id = int(body["standard_version_id"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(status_code=422, detail="standard_id and standard_version_id are required")

    standard, version = _resolve_version(db, standard_id, version_id)
    pam = _ensure_pam(db, standard, version)
    if not pam:
        raise HTTPException(status_code=409, detail="Canonical PAM is not configured for this framework version")
    cmf = _model(db, version.id, "CMF")
    reference = _reference_model(db, pam.id)

    adoption = db.query(FrameworkAdoption).filter(
        FrameworkAdoption.tenant_id == tenant_id,
        FrameworkAdoption.standard_id == standard_id,
        FrameworkAdoption.standard_version_id == version.id,
        FrameworkAdoption.status == "ACTIVE",
    ).order_by(FrameworkAdoption.id.desc()).first()

    requested_ids = body.get("process_ids")
    all_processes = db.query(PamProcess).filter(PamProcess.framework_model_id == pam.id).order_by(PamProcess.process_group_id, PamProcess.sort_order, PamProcess.id).all()
    if requested_ids is None:
        processes = all_processes
    else:
        try:
            selected_ids = {int(value) for value in requested_ids}
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="process_ids must contain numeric process ids")
        if not selected_ids:
            raise HTTPException(status_code=422, detail="At least one process must be selected")
        processes = [process for process in all_processes if process.id in selected_ids]
        if len(processes) != len(selected_ids):
            raise HTTPException(status_code=422, detail="One or more selected processes are not part of the canonical PAM")

    columns = body.get("columns")
    if columns is not None and not isinstance(columns, list):
        raise HTTPException(status_code=422, detail="columns must be an array")

    instance = MatrixInstance(
        tenant_id=tenant_id,
        standard_id=standard_id,
        standard_version_id=version.id,
        framework_model_id=pam.id,
        reference_model_id=reference.id if reference else None,
        capability_framework_id=cmf.id if cmf else None,
        framework_adoption_id=adoption.id if adoption else None,
        status="generated",
        column_snapshot=columns,
        created_by=getattr(user, "id", None),
    )
    db.add(instance)
    db.flush()

    for process in processes:
        group = db.query(PamProcessGroup).filter(PamProcessGroup.id == process.process_group_id).first()
        category = db.query(PamProcessCategory).filter(PamProcessCategory.id == group.category_id).first() if group else None
        db.add(MatrixRow(
            tenant_id=tenant_id,
            instance_id=instance.id,
            standard_id=standard_id,
            framework_model_id=pam.id,
            pam_process_category_id=category.id if category else None,
            pam_process_group_id=group.id if group else None,
            pam_process_id=process.id,
            mode="pam",
            row_key=process.code,
            payload=_process_payload(db, process),
        ))

    db.commit()
    db.refresh(instance)
    return {
        "status": "ok",
        "matrix_instance_id": instance.id,
        "matrix_instance_status": instance.status,
        "row_count": len(processes),
        "standard_id": standard_id,
        "standard_version_id": version.id,
        "framework_adoption_id": instance.framework_adoption_id,
    }


@router.get("/pam/instances")
def list_pam_instances(standard_id: Optional[int] = Query(default=None), db: Session = Depends(get_db), user=Depends(get_current_user)):
    tenant_id = _tenant(user)
    query = db.query(MatrixInstance).filter(MatrixInstance.tenant_id == tenant_id)
    if standard_id:
        query = query.filter(MatrixInstance.standard_id == standard_id)
    result = []
    for instance in query.order_by(MatrixInstance.id.desc()).all():
        standard = db.query(Standard).filter(Standard.id == instance.standard_id).first()
        version = db.query(StandardVersion).filter(StandardVersion.id == instance.standard_version_id).first()
        pam = db.query(FrameworkModel).filter(FrameworkModel.id == instance.framework_model_id).first() if instance.framework_model_id else None
        result.append({"id": instance.id, "standard_id": instance.standard_id, "standard_code": standard.code if standard else None, "standard_version_id": instance.standard_version_id, "standard_version_code": version.version_code if version else None, "status": instance.status, "framework_model": ({"id": pam.id, "code": pam.code, "name": pam.name} if pam else None), "framework_adoption_id": instance.framework_adoption_id, "created_by": instance.created_by, "created_at": instance.created_at})
    return {"items": result}


@router.get("/pam/instances/{instance_id}")
def get_pam_instance(instance_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    tenant_id = _tenant(user)
    instance = db.query(MatrixInstance).filter(MatrixInstance.id == instance_id, MatrixInstance.tenant_id == tenant_id).first()
    if not instance:
        raise HTTPException(status_code=404, detail="Matrix instance not found")
    standard = db.query(Standard).filter(Standard.id == instance.standard_id).first()
    version = db.query(StandardVersion).filter(StandardVersion.id == instance.standard_version_id).first()
    pam = db.query(FrameworkModel).filter(FrameworkModel.id == instance.framework_model_id).first() if instance.framework_model_id else None
    count = db.query(func.count(MatrixRow.id)).filter(MatrixRow.instance_id == instance_id, MatrixRow.tenant_id == tenant_id).scalar() or 0
    return {"id": instance.id, "status": instance.status, "standard_id": instance.standard_id, "standard_code": standard.code if standard else None, "standard_version_id": instance.standard_version_id, "standard_version_code": version.version_code if version else None, "framework_model": ({"id": pam.id, "code": pam.code, "name": pam.name} if pam else None), "framework_adoption_id": instance.framework_adoption_id, "row_count": count, "created_by": instance.created_by, "created_at": instance.created_at}


@router.get("/pam/instances/{instance_id}/rows")
def get_pam_instance_rows(instance_id: int, limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0), db: Session = Depends(get_db), user=Depends(get_current_user)):
    tenant_id = _tenant(user)
    if not db.query(MatrixInstance).filter(MatrixInstance.id == instance_id, MatrixInstance.tenant_id == tenant_id).first():
        raise HTTPException(status_code=404, detail="Matrix instance not found")
    query = db.query(MatrixRow).filter(MatrixRow.instance_id == instance_id, MatrixRow.tenant_id == tenant_id).order_by(MatrixRow.id)
    total = query.count()
    return {"items": [{"id": row.id, "row_key": row.row_key, "category_id": row.pam_process_category_id, "group_id": row.pam_process_group_id, "pam_process_id": row.pam_process_id, "mode": row.mode, "payload": row.payload} for row in query.offset(offset).limit(limit).all()], "total": total, "limit": limit, "offset": offset}
