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
    q = db.query(StandardVersion).filter(StandardVersion.standard_id == standard_id)
    version = q.filter(StandardVersion.id == version_id).first() if version_id else q.order_by(StandardVersion.id.desc()).first()
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


def _process_payload(db: Session, process: PamProcess) -> Dict[str, Any]:
    group = db.query(PamProcessGroup).filter(PamProcessGroup.id == process.process_group_id).first()
    category = db.query(PamProcessCategory).filter(PamProcessCategory.id == group.category_id).first() if group else None
    outcomes = db.query(PamProcessOutcome).filter(PamProcessOutcome.process_id == process.id).order_by(PamProcessOutcome.sort_order, PamProcessOutcome.id).all()
    practices = db.query(PamBasePractice).filter(PamBasePractice.process_id == process.id).order_by(PamBasePractice.sort_order, PamBasePractice.id).all()
    links = db.query(PamProcessWorkProduct).filter(PamProcessWorkProduct.process_id == process.id).order_by(PamProcessWorkProduct.sort_order, PamProcessWorkProduct.id).all()
    products = []
    for link in links:
        wp = db.query(PamWorkProduct).filter(PamWorkProduct.id == link.work_product_id).first()
        if wp:
            products.append({"id": wp.id, "code": wp.code, "name": wp.name, "description": wp.description, "direction": link.direction})
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
        "outcomes": [{"id": x.id, "code": x.code, "text": x.text} for x in outcomes],
        "base_practices": [{"id": x.id, "code": x.code, "text": x.text, "guidance": x.guidance} for x in practices],
        "work_products": products,
    }


@router.get("/pam")
def get_pam_matrix(
    standard_id: int = Query(...),
    standard_version_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    tenant_id = _tenant(user)
    standard, version = _resolve_version(db, standard_id, standard_version_id)
    pam = _model(db, version.id, "PAM")
    cmf = _model(db, version.id, "CMF")
    if not pam:
        raise HTTPException(status_code=409, detail="Canonical PAM is not configured for this framework version")

    reference = None
    rel = db.query(FrameworkRelationship).filter(
        FrameworkRelationship.source_model_id == pam.id,
        FrameworkRelationship.relationship_type == "PROCESS_REFERENCE_MODEL",
    ).first()
    if rel:
        target = db.query(FrameworkModel).filter(FrameworkModel.id == rel.target_model_id).first()
        if target:
            reference = {"id": target.id, "code": target.code, "name": target.name, "model_type": target.model_type}

    categories = db.query(PamProcessCategory).filter(PamProcessCategory.framework_model_id == pam.id).order_by(PamProcessCategory.sort_order, PamProcessCategory.id).all()
    groups = db.query(PamProcessGroup).join(PamProcessCategory, PamProcessGroup.category_id == PamProcessCategory.id).filter(PamProcessCategory.framework_model_id == pam.id).order_by(PamProcessGroup.category_id, PamProcessGroup.sort_order, PamProcessGroup.id).all()
    processes = db.query(PamProcess).filter(PamProcess.framework_model_id == pam.id).order_by(PamProcess.process_group_id, PamProcess.sort_order, PamProcess.id).all()

    category_payload = []
    for category in categories:
        group_payload = []
        for group in [g for g in groups if g.category_id == category.id]:
            group_payload.append({
                "id": group.id,
                "code": group.code,
                "name": group.name,
                "description": group.description,
                "processes": [_process_payload(db, p) for p in processes if p.process_group_id == group.id],
            })
        category_payload.append({"id": category.id, "code": category.code, "name": category.name, "description": category.description, "groups": group_payload})

    levels = []
    attributes = []
    if cmf:
        level_rows = db.query(PamCapabilityLevel).filter(PamCapabilityLevel.framework_model_id == cmf.id).order_by(PamCapabilityLevel.level, PamCapabilityLevel.id).all()
        levels = [{"id": x.id, "level": x.level, "code": x.code, "name": x.name, "description": x.description} for x in level_rows]
        if level_rows:
            attrs = db.query(PamProcessAttribute).filter(PamProcessAttribute.capability_level_id.in_([x.id for x in level_rows])).order_by(PamProcessAttribute.capability_level_id, PamProcessAttribute.sort_order, PamProcessAttribute.id).all()
            attributes = [{"id": x.id, "capability_level_id": x.capability_level_id, "code": x.code, "name": x.name, "description": x.description} for x in attrs]

    adoption = db.query(FrameworkAdoption).filter(
        FrameworkAdoption.tenant_id == tenant_id,
        FrameworkAdoption.standard_id == standard_id,
        FrameworkAdoption.standard_version_id == version.id,
        FrameworkAdoption.status == "ACTIVE",
    ).order_by(FrameworkAdoption.id.desc()).first()
    process_ids = []
    if adoption:
        process_ids = [x.process_id for x in db.query(FrameworkAdoptionScope).filter(FrameworkAdoptionScope.adoption_id == adoption.id).order_by(FrameworkAdoptionScope.process_id).all()]

    return {
        "mode": "pam",
        "standard": {"id": standard.id, "code": standard.code, "title": standard.title, "type": standard.type},
        "version": {"id": version.id, "version_code": version.version_code, "status": version.status},
        "framework_model": {"id": pam.id, "code": pam.code, "name": pam.name, "model_type": pam.model_type},
        "reference_model": reference,
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
    standard_id = int(body["standard_id"])
    version_id = int(body["standard_version_id"])
    standard, version = _resolve_version(db, standard_id, version_id)
    pam = _model(db, version.id, "PAM")
    if not pam:
        raise HTTPException(status_code=409, detail="Canonical PAM is not configured for this framework version")
    cmf = _model(db, version.id, "CMF")
    adoption = db.query(FrameworkAdoption).filter(
        FrameworkAdoption.tenant_id == tenant_id,
        FrameworkAdoption.standard_id == standard_id,
        FrameworkAdoption.standard_version_id == version.id,
        FrameworkAdoption.status == "ACTIVE",
    ).order_by(FrameworkAdoption.id.desc()).first()
    if not adoption:
        raise HTTPException(status_code=409, detail="An active framework adoption is required before generating a matrix instance")

    inst = MatrixInstance(
        tenant_id=tenant_id,
        standard_id=standard_id,
        standard_version_id=version.id,
        framework_model_id=pam.id,
        reference_model_id=None,
        capability_framework_id=cmf.id if cmf else None,
        framework_adoption_id=adoption.id,
        status="generated",
        column_snapshot=None,
        created_by=getattr(user, "id", None),
    )
    db.add(inst)
    db.flush()
    processes = db.query(PamProcess).filter(PamProcess.framework_model_id == pam.id).order_by(PamProcess.process_group_id, PamProcess.sort_order, PamProcess.id).all()
    for process in processes:
        group = db.query(PamProcessGroup).filter(PamProcessGroup.id == process.process_group_id).first()
        category = db.query(PamProcessCategory).filter(PamProcessCategory.id == group.category_id).first() if group else None
        db.add(MatrixRow(
            tenant_id=tenant_id,
            instance_id=inst.id,
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
    db.refresh(inst)
    return {"status": "ok", "matrix_instance_id": inst.id, "matrix_instance_status": inst.status, "row_count": len(processes), "standard_id": standard_id, "standard_version_id": version.id}


@router.get("/pam/instances")
def list_pam_instances(standard_id: Optional[int] = Query(default=None), db: Session = Depends(get_db), user=Depends(get_current_user)):
    tenant_id = _tenant(user)
    q = db.query(MatrixInstance).filter(MatrixInstance.tenant_id == tenant_id)
    if standard_id:
        q = q.filter(MatrixInstance.standard_id == standard_id)
    result = []
    for inst in q.order_by(MatrixInstance.id.desc()).all():
        standard = db.query(Standard).filter(Standard.id == inst.standard_id).first()
        version = db.query(StandardVersion).filter(StandardVersion.id == inst.standard_version_id).first()
        pam = db.query(FrameworkModel).filter(FrameworkModel.id == inst.framework_model_id).first() if inst.framework_model_id else None
        result.append({"id": inst.id, "standard_id": inst.standard_id, "standard_code": standard.code if standard else None, "standard_version_id": inst.standard_version_id, "standard_version_code": version.version_code if version else None, "status": inst.status, "framework_model": ({"id": pam.id, "code": pam.code, "name": pam.name} if pam else None), "framework_adoption_id": inst.framework_adoption_id, "created_by": inst.created_by, "created_at": inst.created_at})
    return {"items": result}


@router.get("/pam/instances/{instance_id}")
def get_pam_instance(instance_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    tenant_id = _tenant(user)
    inst = db.query(MatrixInstance).filter(MatrixInstance.id == instance_id, MatrixInstance.tenant_id == tenant_id).first()
    if not inst:
        raise HTTPException(status_code=404, detail="Matrix instance not found")
    standard = db.query(Standard).filter(Standard.id == inst.standard_id).first()
    version = db.query(StandardVersion).filter(StandardVersion.id == inst.standard_version_id).first()
    pam = db.query(FrameworkModel).filter(FrameworkModel.id == inst.framework_model_id).first() if inst.framework_model_id else None
    count = db.query(func.count(MatrixRow.id)).filter(MatrixRow.instance_id == instance_id, MatrixRow.tenant_id == tenant_id).scalar() or 0
    return {"id": inst.id, "status": inst.status, "standard_id": inst.standard_id, "standard_code": standard.code if standard else None, "standard_version_id": inst.standard_version_id, "standard_version_code": version.version_code if version else None, "framework_model": ({"id": pam.id, "code": pam.code, "name": pam.name} if pam else None), "framework_adoption_id": inst.framework_adoption_id, "row_count": count, "created_by": inst.created_by, "created_at": inst.created_at}


@router.get("/pam/instances/{instance_id}/rows")
def get_pam_instance_rows(instance_id: int, limit: int = Query(default=100, ge=1, le=500), offset: int = Query(default=0, ge=0), db: Session = Depends(get_db), user=Depends(get_current_user)):
    tenant_id = _tenant(user)
    if not db.query(MatrixInstance).filter(MatrixInstance.id == instance_id, MatrixInstance.tenant_id == tenant_id).first():
        raise HTTPException(status_code=404, detail="Matrix instance not found")
    q = db.query(MatrixRow).filter(MatrixRow.instance_id == instance_id, MatrixRow.tenant_id == tenant_id).order_by(MatrixRow.id)
    return {"items": [{"id": r.id, "row_key": r.row_key, "category_id": r.pam_process_category_id, "group_id": r.pam_process_group_id, "pam_process_id": r.pam_process_id, "payload": r.payload} for r in q.offset(offset).limit(limit).all()], "total": q.count()}
