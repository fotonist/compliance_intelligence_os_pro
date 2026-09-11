from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.pam_assessment import PamAssessment, PamAssessmentProcess, PamProcessAttributeEvaluation
from app.models.pam_capability import PamCapabilityLevel, PamProcessAttribute, PamGenericPractice, PamGenericResource, PamGenericWorkProduct
from app.models.pam_definition import PamBasePractice, PamProcess, PamProcessWorkProduct, PamWorkProduct
from app.models.pam_indicator_evaluation import PamIndicatorEvaluation
from app.models.framework_model import FrameworkModel
from app.models.framework_relationship import FrameworkRelationship
from app.models.user import User

router = APIRouter(prefix="/maturity/workspace", tags=["PAM Assessment Workspace"])

class AttributeEvaluationRequest(BaseModel):
    rating: str | None = None
    justification: str | None = None
    status: str = "DRAFT"

class IndicatorEvaluationRequest(BaseModel):
    indicator_type: str
    indicator_id: int
    rating: str | None = None
    observation: str | None = None
    justification: str | None = None
    status: str = "DRAFT"

TARGETS = {
    "BASE_PRACTICE": ("base_practice_id", PamBasePractice),
    "WORK_PRODUCT": ("work_product_id", PamWorkProduct),
    "GENERIC_PRACTICE": ("generic_practice_id", PamGenericPractice),
    "GENERIC_RESOURCE": ("generic_resource_id", PamGenericResource),
    "GENERIC_WORK_PRODUCT": ("generic_work_product_id", PamGenericWorkProduct),
}

def _assessment(db, sid, tid):
    return db.query(PamAssessment).filter(PamAssessment.id == sid, PamAssessment.tenant_id == tid).first()

def _cmf(db, assessment):
    rel = db.query(FrameworkRelationship).filter(FrameworkRelationship.source_model_id == assessment.framework_model_id, FrameworkRelationship.relationship_type == "CAPABILITY_MEASUREMENT_FRAMEWORK").first()
    return db.query(FrameworkModel).filter(FrameworkModel.id == rel.target_model_id).first() if rel else None

def _eval(e):
    if not e:
        return None
    return {"id": e.id, "rating": e.rating, "observation": getattr(e, "observation", None), "justification": e.justification, "status": e.status, "evidence_count": len(e.evidence_links), "evaluated_by": e.evaluator_user_id, "evaluated_at": e.evaluated_at}

@router.get("/{session_id}")
def get_workspace(session_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    assessment = _assessment(db, session_id, current_user.tenant_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="PAM assessment not found")
    cmf = _cmf(db, assessment)
    levels = db.query(PamCapabilityLevel).filter(PamCapabilityLevel.framework_model_id == cmf.id).order_by(PamCapabilityLevel.level, PamCapabilityLevel.id).all() if cmf else []
    attributes = db.query(PamProcessAttribute).filter(PamProcessAttribute.capability_level_id.in_([x.id for x in levels])).order_by(PamProcessAttribute.capability_level_id, PamProcessAttribute.sort_order, PamProcessAttribute.id).all() if levels else []
    aps = db.query(PamAssessmentProcess).options(
        joinedload(PamAssessmentProcess.tenant_process),
        joinedload(PamAssessmentProcess.pam_process).joinedload(PamProcess.process_group),
        joinedload(PamAssessmentProcess.pam_process).joinedload(PamProcess.outcomes),
        joinedload(PamAssessmentProcess.pam_process).joinedload(PamProcess.base_practices),
        joinedload(PamAssessmentProcess.pam_process).joinedload(PamProcess.work_products).joinedload(PamProcessWorkProduct.work_product),
        joinedload(PamAssessmentProcess.attribute_evaluations),
        joinedload(PamAssessmentProcess.indicator_evaluations).joinedload(PamIndicatorEvaluation.evidence_links),
    ).filter(PamAssessmentProcess.assessment_id == assessment.id, PamAssessmentProcess.in_scope.is_(True)).order_by(PamAssessmentProcess.id).all()
    result = []
    for ap in aps:
        p = ap.pam_process
        evs = {x.process_attribute_id: x for x in ap.attribute_evaluations}
        inds = {}
        for x in ap.indicator_evaluations:
            for kind, (field, _) in TARGETS.items():
                target_id = getattr(x, field, None)
                if target_id: inds[(kind, target_id)] = x
        attr_payload = []
        for a in attributes:
            attr_payload.append({
                "id": a.id, "code": a.code, "name": a.name, "description": a.description,
                "capability_level": {"id": a.capability_level.id, "level": a.capability_level.level, "code": a.capability_level.code, "name": a.capability_level.name, "description": a.capability_level.description},
                "evaluation": _eval(evs.get(a.id)),
                "generic_practices": [{"id": x.id, "code": x.code, "text": x.text, "guidance": x.guidance, "evaluation": _eval(inds.get(("GENERIC_PRACTICE", x.id)))} for x in sorted(a.generic_practices, key=lambda z: (z.sort_order, z.code or ""))],
                "generic_resources": [{"id": x.id, "code": x.code, "text": x.text, "guidance": x.guidance, "evaluation": _eval(inds.get(("GENERIC_RESOURCE", x.id)))} for x in sorted(a.generic_resources, key=lambda z: (z.sort_order, z.code or ""))],
                "generic_work_products": [{"id": x.id, "code": x.code, "text": x.text, "guidance": x.guidance, "evaluation": _eval(inds.get(("GENERIC_WORK_PRODUCT", x.id)))} for x in sorted(a.generic_work_products, key=lambda z: (z.sort_order, z.code or ""))],
            })
        result.append({
            "assessment_process_id": ap.id, "tenant_process_id": ap.tenant_process_id, "pam_process_id": p.id,
            "tenant_process": ({"id": ap.tenant_process.id, "code": ap.tenant_process.code, "name": ap.tenant_process.name, "type": ap.tenant_process.type, "owner": ap.tenant_process.owner, "status": ap.tenant_process.status} if ap.tenant_process else None),
            "code": p.code, "name": p.name, "purpose": p.purpose, "description": p.description,
            "process_group": {"id": p.process_group.id, "code": p.process_group.code, "name": p.process_group.name},
            "outcomes": [{"id": x.id, "code": x.code, "text": x.text} for x in sorted(p.outcomes, key=lambda z: (z.sort_order, z.code or ""))],
            "base_practices": [{"id": x.id, "code": x.code, "text": x.text, "guidance": x.guidance, "evaluation": _eval(inds.get(("BASE_PRACTICE", x.id)))} for x in sorted(p.base_practices, key=lambda z: (z.sort_order, z.code or ""))],
            "work_products": [{"id": x.work_product.id, "code": x.work_product.code, "name": x.work_product.name, "description": x.work_product.description, "direction": x.direction, "evaluation": _eval(inds.get(("WORK_PRODUCT", x.work_product.id)))} for x in sorted(p.work_products, key=lambda z: (z.sort_order, z.work_product.code if z.work_product else "")) if x.work_product],
            "target_capability_level": ap.target_capability_level, "status": ap.status, "attributes": attr_payload,
        })
    return {
        "assessment": {"id": assessment.id, "name": assessment.name, "scope": assessment.scope, "status": assessment.status, "framework_adoption_id": assessment.framework_adoption_id, "framework_model_id": assessment.framework_model_id, "assessor_user_id": assessment.assessor_user_id, "sponsor_user_id": assessment.sponsor_user_id, "created_at": assessment.created_at, "updated_at": assessment.updated_at},
        "summary": {"processes_in_scope": len(aps), "assessed_processes": sum(1 for x in aps if any(e.rating or e.justification for e in x.attribute_evaluations)), "attributes_evaluated": sum(1 for x in aps for e in x.attribute_evaluations if e.rating or e.justification), "attributes_total": len(attributes) * len(aps)},
        "capability_levels": [{"id": x.id, "level": x.level, "code": x.code, "name": x.name, "description": x.description, "attributes": [{"id": a.id, "code": a.code, "name": a.name, "description": a.description} for a in sorted(x.attributes, key=lambda z: (z.sort_order, z.code or ""))]} for x in levels],
        "processes": result,
    }

@router.put("/{session_id}/processes/{assessment_process_id}/attributes/{attribute_id}")
def save_attribute(session_id: int, assessment_process_id: int, attribute_id: int, payload: AttributeEvaluationRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    assessment = _assessment(db, session_id, current_user.tenant_id)
    if not assessment: raise HTTPException(status_code=404, detail="PAM assessment not found")
    ap = db.query(PamAssessmentProcess).filter(PamAssessmentProcess.id == assessment_process_id, PamAssessmentProcess.assessment_id == assessment.id, PamAssessmentProcess.in_scope.is_(True)).first()
    if not ap: raise HTTPException(status_code=404, detail="Assessment process not found")
    cmf = _cmf(db, assessment)
    if not cmf: raise HTTPException(status_code=409, detail="Capability measurement framework is not configured")
    attribute = db.query(PamProcessAttribute).join(PamCapabilityLevel).filter(PamProcessAttribute.id == attribute_id, PamCapabilityLevel.framework_model_id == cmf.id).first()
    if not attribute: raise HTTPException(status_code=404, detail="Process attribute not found")
    ev = db.query(PamProcessAttributeEvaluation).filter(PamProcessAttributeEvaluation.assessment_process_id == ap.id, PamProcessAttributeEvaluation.process_attribute_id == attribute.id).first()
    if not ev: ev = PamProcessAttributeEvaluation(assessment_process_id=ap.id, process_attribute_id=attribute.id); db.add(ev)
    ev.rating = payload.rating; ev.justification = payload.justification; ev.status = payload.status; ev.evaluated_by = current_user.id; ev.evaluated_at = datetime.utcnow(); ap.status = "IN_PROGRESS"
    db.commit(); db.refresh(ev)
    return {"id": ev.id, "rating": ev.rating, "justification": ev.justification, "status": ev.status, "evaluated_by": ev.evaluated_by, "evaluated_at": ev.evaluated_at}

@router.put("/{session_id}/processes/{assessment_process_id}/indicators")
def save_indicator(session_id: int, assessment_process_id: int, payload: IndicatorEvaluationRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    assessment = _assessment(db, session_id, current_user.tenant_id)
    if not assessment: raise HTTPException(status_code=404, detail="PAM assessment not found")
    ap = db.query(PamAssessmentProcess).filter(PamAssessmentProcess.id == assessment_process_id, PamAssessmentProcess.assessment_id == assessment.id, PamAssessmentProcess.in_scope.is_(True)).first()
    if not ap: raise HTTPException(status_code=404, detail="Assessment process not found")
    kind = payload.indicator_type.strip().upper(); config = TARGETS.get(kind)
    if not config: raise HTTPException(status_code=422, detail="Unsupported PAM indicator type")
    field, model = config; target = db.query(model).filter(model.id == payload.indicator_id).first()
    if not target: raise HTTPException(status_code=404, detail="PAM indicator not found")
    if kind == "BASE_PRACTICE": valid = db.query(PamBasePractice).filter(PamBasePractice.id == target.id, PamBasePractice.process_id == ap.pam_process_id).first()
    elif kind == "WORK_PRODUCT": valid = db.query(PamWorkProduct).join(PamProcessWorkProduct, PamProcessWorkProduct.work_product_id == PamWorkProduct.id).filter(PamWorkProduct.id == target.id, PamProcessWorkProduct.process_id == ap.pam_process_id).first()
    else:
        cmf = _cmf(db, assessment); valid = None
        if cmf:
            attr = db.query(PamProcessAttribute).filter(PamProcessAttribute.id == target.process_attribute_id).join(PamCapabilityLevel).filter(PamCapabilityLevel.framework_model_id == cmf.id).first()
            valid = target if attr else None
    if not valid: raise HTTPException(status_code=400, detail="Indicator is outside the assessment process scope")
    ev = db.query(PamIndicatorEvaluation).filter(PamIndicatorEvaluation.assessment_process_id == ap.id, getattr(PamIndicatorEvaluation, field) == target.id).first()
    if not ev: ev = PamIndicatorEvaluation(assessment_process_id=ap.id, indicator_type=kind, **{field: target.id}); db.add(ev)
    ev.rating = payload.rating; ev.observation = payload.observation; ev.justification = payload.justification; ev.status = payload.status; ev.evaluator_user_id = current_user.id; ev.evaluated_at = datetime.utcnow(); ap.status = "IN_PROGRESS"
    db.commit(); db.refresh(ev)
    return {"id": ev.id, "rating": ev.rating, "observation": ev.observation, "justification": ev.justification, "status": ev.status, "evidence_count": len(ev.evidence_links), "evaluated_by": ev.evaluator_user_id, "evaluated_at": ev.evaluated_at}
