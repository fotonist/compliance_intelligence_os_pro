from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.framework_adoption import FrameworkAdoption, FrameworkAdoptionScope
from app.models.framework_model import FrameworkModel
from app.models.pam_assessment import PamAssessment, PamAssessmentProcess
from app.models.process import Process
from app.models.process_pam_mapping import ProcessPamMapping
from app.models.standards import Standard
from app.models.standard_versions import StandardVersion

router = APIRouter(prefix="/maturity/assessments", tags=["PAM Assessments"])


def tenant(user):
    value = getattr(user, "tenant_id", None)
    if not value:
        raise HTTPException(status_code=400, detail="Tenant context is required")
    return value


@router.get("")
def list_assessments(db: Session = Depends(get_db), user=Depends(get_current_user)):
    tenant_id = tenant(user)
    assessments = db.query(PamAssessment).filter(PamAssessment.tenant_id == tenant_id).order_by(PamAssessment.id.desc()).all()
    result = []
    for a in assessments:
        standard = db.query(Standard).join(StandardVersion, StandardVersion.standard_id == Standard.id).join(FrameworkModel, FrameworkModel.standard_version_id == StandardVersion.id).filter(FrameworkModel.id == a.framework_model_id).first()
        count = db.query(PamAssessmentProcess).filter(PamAssessmentProcess.assessment_id == a.id, PamAssessmentProcess.in_scope.is_(True)).count()
        result.append({"id": a.id, "name": a.name, "scope": a.scope, "status": a.status, "framework_adoption_id": a.framework_adoption_id, "framework_model_id": a.framework_model_id, "standard_code": standard.code if standard else None, "process_count": count, "created_at": a.created_at})
    return {"items": result}


@router.post("")
def create_assessment(payload: Dict[str, Any], db: Session = Depends(get_db), user=Depends(get_current_user)):
    tenant_id = tenant(user)
    adoption_id = int(payload["framework_adoption_id"])
    adoption = db.query(FrameworkAdoption).filter(FrameworkAdoption.id == adoption_id, FrameworkAdoption.tenant_id == tenant_id, FrameworkAdoption.status == "ACTIVE").first()
    if not adoption:
        raise HTTPException(status_code=409, detail="An active framework adoption is required")

    pam = db.query(FrameworkModel).filter(FrameworkModel.standard_version_id == adoption.standard_version_id, FrameworkModel.model_type == "PAM", FrameworkModel.is_canonical.is_(True)).order_by(FrameworkModel.id).first()
    if not pam:
        raise HTTPException(status_code=409, detail="Canonical PAM is not configured for the adopted version")

    assessment = PamAssessment(
        tenant_id=tenant_id,
        framework_adoption_id=adoption.id,
        framework_model_id=pam.id,
        name=(payload.get("name") or "PAM Assessment").strip(),
        scope=payload.get("scope"),
        status="DRAFT",
        assessor_user_id=getattr(user, "id", None),
        sponsor_user_id=payload.get("sponsor_user_id"),
    )
    db.add(assessment)
    db.flush()

    scoped_ids = [x.process_id for x in db.query(FrameworkAdoptionScope).filter(FrameworkAdoptionScope.adoption_id == adoption.id).all()]
    q = db.query(Process).filter(Process.tenant_id == tenant_id)
    if scoped_ids:
        q = q.filter(Process.id.in_(scoped_ids))
    processes = q.order_by(Process.code).all()

    created = 0
    for process in processes:
        mapping = db.query(ProcessPamMapping).filter(ProcessPamMapping.process_id == process.id, ProcessPamMapping.mapping_type == "PRIMARY").order_by(ProcessPamMapping.id).first()
        if not mapping:
            continue
        pam_process = db.query(FrameworkModel).filter(FrameworkModel.id == pam.id).first()
        if not db.query(PamAssessmentProcess).filter(PamAssessmentProcess.assessment_id == assessment.id, PamAssessmentProcess.tenant_process_id == process.id, PamAssessmentProcess.pam_process_id == mapping.pam_process_id).first():
            db.add(PamAssessmentProcess(assessment_id=assessment.id, tenant_process_id=process.id, pam_process_id=mapping.pam_process_id, in_scope=True, status="NOT_STARTED"))
            created += 1

    db.commit()
    db.refresh(assessment)
    return {"id": assessment.id, "name": assessment.name, "status": assessment.status, "framework_adoption_id": assessment.framework_adoption_id, "framework_model_id": assessment.framework_model_id, "process_count": created}
